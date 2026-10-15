import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import bcrypt from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { config, parse } from "dotenv";

// Load the application's EXISTING environment files. No separate test env is needed.
// The script always uses TEST_DATABASE_URL for all database writes.
config({ path: [".env.local", ".env"], quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const applicationDatabaseUrl = process.env.DATABASE_URL;
const baseUrl = "http://localhost:3100";
const target = new URL(baseUrl);

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is missing from .env.local or .env.");
}

// Treat pooled and direct Neon hostnames as the same database identity.
function databaseIdentity(value: string): string {
  const url = new URL(value);

  if (!["postgresql:", "postgres:"].includes(url.protocol)) {
    throw new Error("Database URLs must use the PostgreSQL protocol.");
  }

  return `${url.hostname.replace("-pooler.", ".")}:${url.port}${url.pathname}`;
}

const testIdentity = databaseIdentity(testDatabaseUrl);

// Check the normal application database, including file configurations.
// These guards prevent the test runner from modifying the ordinary database.
if (
  applicationDatabaseUrl &&
  databaseIdentity(applicationDatabaseUrl) === testIdentity
) {
  throw new Error("TEST_DATABASE_URL must not point to DATABASE_URL.");
}

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) {
    continue;
  }

  const configured = parse(readFileSync(file));

  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = configured[key];

    if (url && databaseIdentity(url) === testIdentity) {
      throw new Error(
        `TEST_DATABASE_URL matches ${key} in ${file}; refusing test writes.`,
      );
    }
  }
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must contain at least 32 characters.");
}

// Launch the real Next.js API on a dedicated local port with DATABASE_URL
// overridden ONLY in the child process. Normal application config stays intact.
async function stopTestServer(server: ChildProcess): Promise<void> {
  if (!server.pid || server.exitCode !== null || server.signalCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn(
        "taskkill",
        ["/PID", String(server.pid), "/T", "/F"],
        { stdio: "ignore" },
      );
      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
    });
  } else {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }

  await Promise.race([
    new Promise<void>((resolve) => server.once("exit", () => resolve())),
    delay(5000),
  ]);
}

async function startTestServer(): Promise<ChildProcess> {
  // Refuse to reuse an already-running server whose database is unknown.
  const portOccupied = await fetch(new URL("/api/auth/me", target), {
    signal: AbortSignal.timeout(1500),
  }).then(
    () => true,
    () => false,
  );

  if (portOccupied) {
    throw new Error(
      "Port 3100 is already in use. Stop that server before running tests.",
    );
  }

  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "-p", "3100"],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    },
  );

  server.stdout?.pipe(process.stdout);
  server.stderr?.pipe(process.stderr);

  let startupError: Error | null = null;
  server.once("error", (error) => {
    startupError = error;
  });

  try {
    const deadline = Date.now() + 90000;

    while (Date.now() < deadline) {
      if (startupError) {
        throw startupError;
      }

      if (server.exitCode !== null || server.signalCode !== null) {
        throw new Error("The Next.js test server exited during startup.");
      }

      const ready = await fetch(new URL("/api/auth/me", target), {
        signal: AbortSignal.timeout(2000),
      }).then(
        (response) => response.status === 401,
        () => false,
      );

      if (ready) {
        console.log("Test API server ready on http://localhost:3100");
        return server;
      }

      await delay(700);
    }

    throw new Error("Timed out waiting for the Next.js test server.");
  } catch (error) {
    await stopTestServer(server);
    throw error;
  }
}

const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: testDatabaseUrl }),
});
const userIds: string[] = [];
const resourceIds: string[] = [];

// Stable future timestamps, rounded to a minute.
const baseTime = Math.ceil((Date.now() + 72 * 3600000) / 60000) * 60000;
const at = (minutes: number): string =>
  new Date(baseTime + minutes * 60000).toISOString();

function booking(resourceId: string, from: number, to: number) {
  return {
    resourceId,
    purpose: "Reservation integration test",
    startAt: at(from),
    endAt: at(to),
  };
}

function availabilityPath(resourceId: string, from: number, to: number) {
  const query = new URLSearchParams({ startAt: at(from), endAt: at(to) });
  return `/api/resources/${resourceId}/availability?${query}`;
}

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH";
  cookie?: string;
  body?: unknown;
  origin?: string | null;
};

async function api(path: string, options: ApiOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.cookie) {
    headers.Cookie = options.cookie;
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.method && options.method !== "GET" && options.origin !== null) {
    headers.Origin = options.origin ?? target.origin;
  }
  return fetch(new URL(path, target), {
    // Never let a hung database transaction stall the entire test indefinitely.
    signal: AbortSignal.timeout(45000),
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
}

async function expectStatus(response: Response, status: number, label: string) {
  const actual = response.status;
  if (actual !== status) {
    const body = await response.text();
    throw new Error(`${label}: expected ${status}, got ${actual}: ${body}`);
  }
  console.log(`PASS: ${label} (${status})`);
}

async function makeUser(name: string, hash: string) {
  const user = await db.user.create({
    data: {
      name,
      email: `reservation-test-${randomUUID()}@example.invalid`,
      passwordHash: hash,
    },
  });
  userIds.push(user.id);
  return user;
}

async function makeResource(creatorId: string, active = true) {
  const resource = await db.resource.create({
    data: {
      name: `Reservation ${randomUUID()}`,
      type: "MEETING_ROOM",
      location: "Reservation Integration Test",
      createdById: creatorId,
      isActive: active,
    },
  });
  resourceIds.push(resource.id);
  return resource;
}

async function login(email: string, password: string): Promise<string> {
  const response = await api("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });

  await expectStatus(response, 200, `Login ${email}`);

  const cookie = response.headers.get("set-cookie")?.split(";")[0];

  if (!cookie?.startsWith("reservehub_session=")) {
    throw new Error("Login response did not contain a valid session cookie.");
  }

  return cookie;
}

async function testWorkflow(): Promise<void> {
  // Verify the intended local Next.js server is running before creating fixtures.
  await expectStatus(
    await api("/api/auth/me"),
    401,
    "Test server authentication endpoint",
  );

  const password = "Reservation-Test-Password-123";
  const hash = await bcrypt.hash(password, 10);
  const alice = await makeUser("Reservation Test Alice", hash);
  const bob = await makeUser("Reservation Test Bob", hash);
  const roomA = await makeResource(alice.id);
  const roomB = await makeResource(alice.id);
  const inactiveRoom = await makeResource(alice.id, false);

  await expectStatus(
    await api(availabilityPath(roomA.id, 0, 60)),
    401,
    "Anonymous availability",
  );
  await expectStatus(
    await api("/api/reservations", {
      method: "POST",
      body: booking(roomA.id, 0, 60),
    }),
    401,
    "Anonymous reservation",
  );

  const aliceCookie = await login(alice.email, password);
  const bobCookie = await login(bob.email, password);

  const free = await api(availabilityPath(roomA.id, 0, 60), {
    cookie: aliceCookie,
  });
  await expectStatus(free, 200, "Free interval lookup");
  assert.deepEqual(await free.json(), { available: true, reason: null });

  const first = await api("/api/reservations", {
    method: "POST",
    cookie: aliceCookie,
    body: booking(roomA.id, 0, 60),
  });
  await expectStatus(first, 201, "Reservation created");
  const firstResult = (await first.json()) as {
    reservation: { id: string; userId: string; status: string };
  };
  assert.equal(firstResult.reservation.userId, alice.id);
  assert.equal(firstResult.reservation.status, "CONFIRMED");
  const stored = await db.reservation.findUniqueOrThrow({
    where: { id: firstResult.reservation.id },
  });
  assert.equal(stored.userId, alice.id);
  assert.equal(stored.status, "CONFIRMED");

  const occupied = await api(availabilityPath(roomA.id, 30, 90), {
    cookie: bobCookie,
  });
  await expectStatus(occupied, 200, "Occupied interval lookup");
  assert.deepEqual(await occupied.json(), {
    available: false,
    reason: "CONFLICT",
  });

  const duplicate = await api("/api/reservations", {
    method: "POST",
    cookie: bobCookie,
    body: booking(roomA.id, 30, 90),
  });
  await expectStatus(duplicate, 409, "Overlapping interval rejected");
  const duplicateBody = (await duplicate.json()) as { code: string };
  assert.equal(duplicateBody.code, "RESERVATION_CONFLICT");

  await expectStatus(
    await api("/api/reservations", {
      method: "POST",
      cookie: bobCookie,
      body: booking(roomA.id, 60, 120),
    }),
    201,
    "Adjacent interval accepted",
  );
  await expectStatus(
    await api("/api/reservations", {
      method: "POST",
      cookie: bobCookie,
      body: booking(roomB.id, 0, 60),
    }),
    201,
    "Different resource accepted",
  );

  // Seed a cancelled reservation directly to isolate availability behavior.
  await db.reservation.create({
    data: {
      userId: alice.id,
      resourceId: roomA.id,
      purpose: "Cancelled booking fixture",
      startAt: new Date(at(180)),
      endAt: new Date(at(240)),
      status: "CANCELLED",
    },
  });
  const cancelledAvailability = await api(
    availabilityPath(roomA.id, 180, 240),
    { cookie: aliceCookie },
  );
  await expectStatus(cancelledAvailability, 200, "Cancelled interval lookup");
  assert.deepEqual(await cancelledAvailability.json(), {
    available: true,
    reason: null,
  });
  await expectStatus(
    await api("/api/reservations", {
      method: "POST",
      cookie: aliceCookie,
      body: booking(roomA.id, 180, 240),
    }),
    201,
    "Cancelled interval reusable",
  );

  // Availability endpoint rejects missing, duplicate, and malformed inputs.
  const invalidAvailabilityRequests = [
    `/api/resources/${roomA.id}/availability?startAt=${encodeURIComponent(at(0))}`,
    `/api/resources/${roomA.id}/availability?startAt=${encodeURIComponent(at(0))}&endAt=${encodeURIComponent(at(60))}&endAt=${encodeURIComponent(at(90))}`,
    `/api/resources/${roomA.id}/availability?startAt=invalid&endAt=${encodeURIComponent(at(60))}`,
  ];

  for (const path of invalidAvailabilityRequests) {
    await expectStatus(
      await api(path, { cookie: aliceCookie }),
      400,
      "Invalid availability query rejected",
    );
  }

  await expectStatus(
    await api(availabilityPath(randomUUID(), 0, 60), { cookie: aliceCookie }),
    404,
    "Unknown resource availability rejected",
  );

  const badCases: Array<[string, unknown, number]> = [
    [
      "Spoofed creator rejected",
      { ...booking(roomA.id, 240, 300), userId: bob.id },
      400,
    ],
    [
      "Spoofed status rejected",
      { ...booking(roomA.id, 240, 300), status: "CANCELLED" },
      400,
    ],
    ["Reversed interval rejected", booking(roomA.id, 300, 240), 400],
    ["Zero-length interval rejected", booking(roomA.id, 300, 300), 400],
    ["Unknown resource rejected", booking(randomUUID(), 240, 300), 404],
    ["Invalid resource UUID rejected", booking("not-a-uuid", 240, 300), 400],
    [
      "Short purpose rejected",
      { ...booking(roomA.id, 240, 300), purpose: "x" },
      400,
    ],
    [
      "Timezone-free input rejected",
      { ...booking(roomA.id, 240, 300), startAt: at(240).replace("Z", "") },
      400,
    ],
    [
      "Past interval rejected",
      {
        ...booking(roomA.id, 240, 300),
        startAt: new Date(Date.now() - 60000).toISOString(),
      },
      400,
    ],
  ];
  for (const [label, body, expected] of badCases) {
    await expectStatus(
      await api("/api/reservations", {
        method: "POST",
        cookie: aliceCookie,
        body,
      }),
      expected,
      label,
    );
  }

  await expectStatus(
    await api("/api/reservations", {
      method: "POST",
      cookie: aliceCookie,
      origin: null,
      body: booking(roomA.id, 240, 300),
    }),
    403,
    "Missing Origin rejected",
  );

  const inactive = await api(availabilityPath(inactiveRoom.id, 0, 60), {
    cookie: aliceCookie,
  });
  await expectStatus(inactive, 200, "Inactive resource availability");
  assert.deepEqual(await inactive.json(), {
    available: false,
    reason: "INACTIVE",
  });
  await expectStatus(
    await api("/api/reservations", {
      method: "POST",
      cookie: aliceCookie,
      body: booking(inactiveRoom.id, 0, 60),
    }),
    409,
    "Inactive resource booking rejected",
  );

  // Multiple runs avoid assuming one scheduling outcome proves concurrency.
  for (let i = 0; i < 3; i++) {
    const raceRoom = await makeResource(alice.id);
    const [one, two] = await Promise.all([
      api("/api/reservations", {
        method: "POST",
        cookie: aliceCookie,
        body: booking(raceRoom.id, 0, 60),
      }),
      api("/api/reservations", {
        method: "POST",
        cookie: bobCookie,
        body: booking(raceRoom.id, 30, 90),
      }),
    ]);
    assert.deepEqual(
      [one.status, two.status].sort((a, b) => a - b),
      [201, 409],
      `Concurrent booking statuses: ${one.status}, ${two.status}`,
    );
    assert.equal(
      await db.reservation.count({
        where: { resourceId: raceRoom.id, status: "CONFIRMED" },
      }),
      1,
    );
    console.log(`PASS: Concurrent overlap round ${i + 1}`);
  }

  for (let i = 0; i < 3; i++) {
    const raceRoom = await makeResource(alice.id);
    const [bookResult, deactivateResult] = await Promise.all([
      api("/api/reservations", {
        method: "POST",
        cookie: aliceCookie,
        body: booking(raceRoom.id, 0, 60),
      }),
      api(`/api/resources/${raceRoom.id}`, {
        method: "PATCH",
        cookie: bobCookie,
        body: { isActive: false },
      }),
    ]);
    const bookingWins =
      bookResult.status === 201 && deactivateResult.status === 409;

    const deactivationWins =
      bookResult.status === 409 && deactivateResult.status === 200;
    assert.ok(
      bookingWins || deactivationWins,
      `Unexpected booking/deactivation response: ${bookResult.status}/${deactivateResult.status}`,
    );
    const resource = await db.resource.findUniqueOrThrow({
      where: { id: raceRoom.id },
    });
    const bookings = await db.reservation.count({
      where: { resourceId: raceRoom.id, status: "CONFIRMED" },
    });
    assert.equal(resource.isActive, bookingWins);
    assert.equal(bookings, bookingWins ? 1 : 0);
    console.log(`PASS: Booking/deactivation race round ${i + 1}`);
  }

  // The offset representation must encode exactly the same UTC instant.
  const utcStart = at(480);
  const utcEnd = at(540);
  const inColombo = (utc: string) =>
    new Date(new Date(utc).getTime() + 330 * 60000)
      .toISOString()
      .replace("Z", "+05:30");
  const offsetResponse = await api("/api/reservations", {
    method: "POST",
    cookie: aliceCookie,
    body: {
      resourceId: roomB.id,
      purpose: "Sri Lanka offset test",
      startAt: inColombo(utcStart),
      endAt: inColombo(utcEnd),
    },
  });
  await expectStatus(offsetResponse, 201, "Sri Lanka offset booking");
  const offsetBody = (await offsetResponse.json()) as {
    reservation: { startAt: string; endAt: string };
  };
  assert.equal(offsetBody.reservation.startAt, utcStart);
  assert.equal(offsetBody.reservation.endAt, utcEnd);
  console.log("PASS: UTC instant preserved across +05:30 offset");

  // Verify history, ownership, editing, cancellation, and concurrency.
  await testReservationManagement(
    alice.id,
    alice.name,
    bob.id,
    aliceCookie,
    bobCookie,
  );
}

// Verify the reservation history, editing, and cancellation APIs.
// Reuse the test database, authenticated users, and cleanup from testWorkflow().
async function testReservationManagement(
  aliceId: string,
  aliceName: string,
  bobId: string,
  aliceCookie: string,
  bobCookie: string,
): Promise<void> {
  type PublicReservation = {
    id: string;
    userId: string;
    resourceId: string;
    purpose: string;
    startAt: string;
    endAt: string;
    status: string;
    creator: Record<string, unknown>;
    resource: Record<string, unknown>;
  };

  const room = await makeResource(aliceId);
  const otherRoom = await makeResource(bobId);
  const aliceBooking = await db.reservation.create({
    data: {
      userId: aliceId,
      resourceId: room.id,
      purpose: "Reservation history test",
      startAt: new Date(at(720)),
      endAt: new Date(at(780)),
    },
  });
  const bobBooking = await db.reservation.create({
    data: {
      userId: bobId,
      resourceId: otherRoom.id,
      purpose: "Other user reservation",
      startAt: new Date(at(720)),
      endAt: new Date(at(780)),
    },
  });

  const detailPath = `/api/reservations/${aliceBooking.id}`;
  const cancelPath = (id: string) => `/api/reservations/${id}/cancel`;

  // Any authenticated user can view organization-wide reservations.
  await expectStatus(await api("/api/reservations"), 401, "Anonymous history");
  const all = await api("/api/reservations", { cookie: bobCookie });
  await expectStatus(all, 200, "All reservations visible to another user");
  const allBody = (await all.json()) as { reservations: PublicReservation[] };
  const visibleAlice = allBody.reservations.find(
    (reservation) => reservation.id === aliceBooking.id,
  );
  assert.ok(visibleAlice);
  assert.equal(visibleAlice.creator.name, aliceName);
  assert.equal(visibleAlice.resource.name, room.name);
  assert.deepEqual(Object.keys(visibleAlice.creator), ["name"]);
  assert.equal("passwordHash" in visibleAlice, false);
  assert.equal("email" in visibleAlice.creator, false);
  assert.ok(allBody.reservations.some((r) => r.id === bobBooking.id));

  const mine = await api("/api/reservations?scope=mine", { cookie: bobCookie });
  await expectStatus(mine, 200, "Mine filter");
  const mineBody = (await mine.json()) as { reservations: PublicReservation[] };
  assert.ok(mineBody.reservations.some((r) => r.id === bobBooking.id));
  assert.ok(mineBody.reservations.every((r) => r.userId === bobId));
  await expectStatus(
    await api("/api/reservations?scope=unknown", { cookie: bobCookie }),
    400,
    "Invalid history scope",
  );
  await expectStatus(
    await api("/api/reservations?scope=mine&scope=all", {
      cookie: bobCookie,
    }),
    400,
    "Duplicate history scope",
  );

  await expectStatus(
    await api(detailPath),
    401,
    "Anonymous reservation detail",
  );
  const detail = await api(detailPath, { cookie: bobCookie });
  await expectStatus(detail, 200, "Another user can view reservation details");
  const detailBody = (await detail.json()) as {
    reservation: PublicReservation;
  };
  assert.equal(detailBody.reservation.id, aliceBooking.id);
  assert.deepEqual(Object.keys(detailBody.reservation.creator), ["name"]);
  assert.equal("email" in detailBody.reservation.creator, false);
  assert.equal("passwordHash" in detailBody.reservation.creator, false);
  await expectStatus(
    await api(`/api/reservations/${randomUUID()}`, { cookie: aliceCookie }),
    404,
    "Missing reservation detail",
  );
  await expectStatus(
    await api("/api/reservations/invalid-id", { cookie: aliceCookie }),
    400,
    "Invalid reservation detail ID",
  );

  // Owner-only edits must be authorized by the API, not just the UI.
  await expectStatus(
    await api(detailPath, {
      method: "PATCH",
      body: { purpose: "Unauthorized update" },
    }),
    401,
    "Anonymous edit",
  );
  await expectStatus(
    await api(detailPath, {
      method: "PATCH",
      cookie: bobCookie,
      body: { purpose: "Unauthorized update" },
    }),
    403,
    "Non-owner edit",
  );
  await expectStatus(
    await api(detailPath, {
      method: "PATCH",
      cookie: aliceCookie,
      origin: null,
      body: { purpose: "Missing origin" },
    }),
    403,
    "Edit without Origin",
  );
  await expectStatus(
    await api(`/api/reservations/${randomUUID()}`, {
      method: "PATCH",
      cookie: aliceCookie,
      body: { purpose: "Unknown booking" },
    }),
    404,
    "Edit missing reservation",
  );
  await expectStatus(
    await api("/api/reservations/invalid-id", {
      method: "PATCH",
      cookie: aliceCookie,
      body: { purpose: "Bad identifier" },
    }),
    400,
    "Edit invalid reservation ID",
  );

  const invalidUpdates: Array<[string, unknown]> = [
    ["Reject empty update", {}],
    ["Reject spoofed owner", { userId: bobId }],
    ["Reject resource reassignment", { resourceId: otherRoom.id }],
    ["Reject status modification", { status: "CANCELLED" }],
    ["Reject immutable identifier", { id: randomUUID() }],
    ["Reject short purpose", { purpose: "x" }],
    ["Reject timezone-free date", { startAt: at(810).replace("Z", "") }],
  ];
  for (const [label, body] of invalidUpdates) {
    await expectStatus(
      await api(detailPath, {
        method: "PATCH",
        cookie: aliceCookie,
        body,
      }),
      400,
      label,
    );
  }
  assert.equal(
    (
      await db.reservation.findUniqueOrThrow({
        where: { id: aliceBooking.id },
      })
    ).purpose,
    aliceBooking.purpose,
  );

  const purposeEdit = await api(detailPath, {
    method: "PATCH",
    cookie: aliceCookie,
    body: { purpose: "Updated meeting purpose" },
  });
  await expectStatus(purposeEdit, 200, "Owner updates purpose");
  const purposeResult = (await purposeEdit.json()) as {
    reservation: { purpose: string; userId: string; resourceId: string };
  };
  assert.equal(purposeResult.reservation.purpose, "Updated meeting purpose");
  assert.equal(purposeResult.reservation.userId, aliceId);
  assert.equal(purposeResult.reservation.resourceId, room.id);

  const competitor = await db.reservation.create({
    data: {
      userId: bobId,
      resourceId: room.id,
      purpose: "Existing overlapping booking",
      startAt: new Date(at(900)),
      endAt: new Date(at(960)),
    },
  });
  const reschedule = await api(detailPath, {
    method: "PATCH",
    cookie: aliceCookie,
    body: { startAt: at(810), endAt: at(870) },
  });
  await expectStatus(reschedule, 200, "Owner reschedules to a free interval");
  assert.equal(
    (
      await db.reservation.findUniqueOrThrow({
        where: { id: aliceBooking.id },
      })
    ).startAt.toISOString(),
    at(810),
  );

  const partialEdit = await api(detailPath, {
    method: "PATCH",
    cookie: aliceCookie,
    body: { endAt: at(850) },
  });
  await expectStatus(partialEdit, 200, "Owner edits only end time");

  const beforeConflict = await db.reservation.findUniqueOrThrow({
    where: { id: aliceBooking.id },
  });
  const overlappingEdit = await api(detailPath, {
    method: "PATCH",
    cookie: aliceCookie,
    body: { startAt: at(920), endAt: at(980) },
  });
  await expectStatus(overlappingEdit, 409, "Overlapping reschedule rejected");
  const conflictBody = (await overlappingEdit.json()) as { code: string };
  assert.equal(conflictBody.code, "RESERVATION_CONFLICT");
  const afterConflict = await db.reservation.findUniqueOrThrow({
    where: { id: aliceBooking.id },
  });
  assert.deepEqual(afterConflict, beforeConflict);
  assert.equal(competitor.status, "CONFIRMED");

  await expectStatus(
    await api(detailPath, {
      method: "PATCH",
      cookie: aliceCookie,
      body: { startAt: at(840), endAt: at(840) },
    }),
    400,
    "Invalid edit interval rejected",
  );
  assert.deepEqual(
    await db.reservation.findUniqueOrThrow({
      where: { id: aliceBooking.id },
    }),
    beforeConflict,
  );

  // Cancellation preserves the record and makes its interval reusable.
  const toCancel = await db.reservation.create({
    data: {
      userId: aliceId,
      resourceId: room.id,
      purpose: "Cancellation history fixture",
      startAt: new Date(at(1080)),
      endAt: new Date(at(1140)),
    },
  });
  await expectStatus(
    await api(cancelPath(toCancel.id), { method: "POST" }),
    401,
    "Anonymous cancellation",
  );
  await expectStatus(
    await api(cancelPath(toCancel.id), {
      method: "POST",
      cookie: bobCookie,
    }),
    403,
    "Non-owner cancellation",
  );
  await expectStatus(
    await api(cancelPath(toCancel.id), {
      method: "POST",
      cookie: aliceCookie,
      origin: null,
    }),
    403,
    "Cancellation without Origin",
  );
  await expectStatus(
    await api(cancelPath(randomUUID()), {
      method: "POST",
      cookie: aliceCookie,
    }),
    404,
    "Cancel unknown reservation",
  );
  await expectStatus(
    await api("/api/reservations/invalid-id/cancel", {
      method: "POST",
      cookie: aliceCookie,
    }),
    400,
    "Cancel invalid reservation ID",
  );

  const cancel = await api(cancelPath(toCancel.id), {
    method: "POST",
    cookie: aliceCookie,
  });
  await expectStatus(cancel, 200, "Owner cancels future booking");
  const cancelBody = (await cancel.json()) as {
    reservation: { id: string; status: string; userId: string };
  };
  assert.equal(cancelBody.reservation.id, toCancel.id);
  assert.equal(cancelBody.reservation.userId, aliceId);
  assert.equal(cancelBody.reservation.status, "CANCELLED");
  const cancelled = await db.reservation.findUniqueOrThrow({
    where: { id: toCancel.id },
  });
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.purpose, toCancel.purpose);
  assert.equal(cancelled.startAt.getTime(), toCancel.startAt.getTime());
  assert.equal(cancelled.endAt.getTime(), toCancel.endAt.getTime());
  await expectStatus(
    await api(cancelPath(toCancel.id), { method: "POST", cookie: aliceCookie }),
    409,
    "Repeated cancellation rejected",
  );
  await expectStatus(
    await api(detailPath, { cookie: aliceCookie }),
    200,
    "Edited reservation remains readable",
  );
  const cancelledDetail = await api(`/api/reservations/${toCancel.id}`, {
    cookie: bobCookie,
  });
  await expectStatus(
    cancelledDetail,
    200,
    "Cancelled booking remains in history",
  );
  assert.equal(
    ((await cancelledDetail.json()) as { reservation: { status: string } })
      .reservation.status,
    "CANCELLED",
  );
  const released = await api(availabilityPath(room.id, 1080, 1140), {
    cookie: bobCookie,
  });
  await expectStatus(released, 200, "Cancelled interval availability");
  assert.deepEqual(await released.json(), { available: true, reason: null });
  await expectStatus(
    await api("/api/reservations", {
      method: "POST",
      cookie: bobCookie,
      body: booking(room.id, 1080, 1140),
    }),
    201,
    "Cancelled interval can be booked again",
  );

  // Derived lifecycle states are read-only once the start time has passed.
  const now = Date.now();
  const ineligible = [
    {
      label: "Ongoing",
      startAt: new Date(now - 3600000),
      endAt: new Date(now + 3600000),
      status: "CONFIRMED" as const,
    },
    {
      label: "Completed",
      startAt: new Date(now - 3 * 3600000),
      endAt: new Date(now - 2 * 3600000),
      status: "CONFIRMED" as const,
    },
    {
      label: "Cancelled",
      startAt: new Date(at(1200)),
      endAt: new Date(at(1260)),
      status: "CANCELLED" as const,
    },
  ];
  for (const item of ineligible) {
    const record = await db.reservation.create({
      data: {
        userId: aliceId,
        resourceId: room.id,
        purpose: `${item.label} mutation fixture`,
        startAt: item.startAt,
        endAt: item.endAt,
        status: item.status,
      },
    });
    await expectStatus(
      await api(`/api/reservations/${record.id}`, {
        method: "PATCH",
        cookie: aliceCookie,
        body: { purpose: "Forbidden change" },
      }),
      409,
      `${item.label} edit rejected`,
    );
    await expectStatus(
      await api(cancelPath(record.id), {
        method: "POST",
        cookie: aliceCookie,
      }),
      409,
      `${item.label} cancellation rejected`,
    );
    const unchanged = await db.reservation.findUniqueOrThrow({
      where: { id: record.id },
    });
    assert.equal(unchanged.purpose, record.purpose);
    assert.equal(unchanged.status, record.status);
  }

  // Serial transactions must prevent simultaneous cancellations from both winning.
  for (let round = 0; round < 3; round++) {
    const raceRoom = await makeResource(aliceId);
    const record = await db.reservation.create({
      data: {
        userId: aliceId,
        resourceId: raceRoom.id,
        purpose: "Double cancellation fixture",
        startAt: new Date(at(1320)),
        endAt: new Date(at(1380)),
      },
    });
    const [first, second] = await Promise.all([
      api(cancelPath(record.id), { method: "POST", cookie: aliceCookie }),
      api(cancelPath(record.id), { method: "POST", cookie: aliceCookie }),
    ]);
    assert.deepEqual(
      [first.status, second.status].sort((a, b) => a - b),
      [200, 409],
      `Double cancellation round ${round + 1}`,
    );
    assert.equal(
      (
        await db.reservation.findUniqueOrThrow({
          where: { id: record.id },
        })
      ).status,
      "CANCELLED",
    );
    console.log(`PASS: Double cancellation race round ${round + 1}`);
  }

  // Rescheduling and creating an overlapping booking must remain exclusive.
  for (let round = 0; round < 3; round++) {
    const raceRoom = await makeResource(aliceId);
    const record = await db.reservation.create({
      data: {
        userId: aliceId,
        resourceId: raceRoom.id,
        purpose: "Reschedule/booking race fixture",
        startAt: new Date(at(1440)),
        endAt: new Date(at(1500)),
      },
    });
    const [edit, create] = await Promise.all([
      api(`/api/reservations/${record.id}`, {
        method: "PATCH",
        cookie: aliceCookie,
        body: { startAt: at(1560), endAt: at(1620) },
      }),
      api("/api/reservations", {
        method: "POST",
        cookie: bobCookie,
        body: booking(raceRoom.id, 1590, 1650),
      }),
    ]);
    assert.ok(
      (edit.status === 200 && create.status === 409) ||
        (edit.status === 409 && create.status === 201),
      `Unexpected rescheduling/booking race: ${edit.status}/${create.status}`,
    );
    assert.equal(
      await db.reservation.count({
        where: {
          resourceId: raceRoom.id,
          status: "CONFIRMED",
          startAt: { lt: new Date(at(1650)) },
          endAt: { gt: new Date(at(1560)) },
        },
      }),
      1,
    );
    console.log(`PASS: Rescheduling/booking race round ${round + 1}`);
  }

  // Editing followed by cancellation can both succeed serially.
  // If cancellation commits first, the edit must be rejected.
  for (let round = 0; round < 3; round++) {
    const raceRoom = await makeResource(aliceId);
    const record = await db.reservation.create({
      data: {
        userId: aliceId,
        resourceId: raceRoom.id,
        purpose: "Edit/cancel race fixture",
        startAt: new Date(at(1740)),
        endAt: new Date(at(1800)),
      },
    });
    const [edit, cancelResult] = await Promise.all([
      api(`/api/reservations/${record.id}`, {
        method: "PATCH",
        cookie: aliceCookie,
        body: { purpose: "Updated before cancellation" },
      }),
      api(cancelPath(record.id), { method: "POST", cookie: aliceCookie }),
    ]);
    assert.equal(cancelResult.status, 200);
    assert.ok(
      edit.status === 200 || edit.status === 409,
      `Unexpected edit/cancel race result: ${edit.status}`,
    );
    const current = await db.reservation.findUniqueOrThrow({
      where: { id: record.id },
    });
    assert.equal(current.status, "CANCELLED");
    assert.equal(
      current.purpose,
      edit.status === 200 ? "Updated before cancellation" : record.purpose,
    );
    console.log(`PASS: Edit/cancel race round ${round + 1}`);
  }
}

async function main(): Promise<void> {
  let server: ChildProcess | undefined;

  try {
    server = await startTestServer();
    await testWorkflow();
  } finally {
    try {
      // Only delete reservations, resources and users created by this run.
      if (resourceIds.length) {
        await db.reservation.deleteMany({
          where: { resourceId: { in: resourceIds } },
        });
        await db.resource.deleteMany({ where: { id: { in: resourceIds } } });
      }
      if (userIds.length) {
        await db.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      await db.$disconnect();

      if (server) {
        await stopTestServer(server);
      }
    }
  }

  console.log("All reservation workflow tests passed.");
}

void main().catch((error: unknown) => {
  console.error("Reservation workflow tests failed:", error);
  process.exitCode = 1;
});
