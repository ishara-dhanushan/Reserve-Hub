import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

function createClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });
}

const db = createClient();

// Use a separate database client for concurrent writes.
const dbConcurrent = createClient();

const baseTime = Date.now() + 48 * 60 * 60 * 1000;
const at = (minutes: number) => new Date(baseTime + minutes * 60_000);

async function main(): Promise<void> {
  let userId: string | undefined;

  try {
    const user = await db.user.create({
      data: {
        name: "Integrity Test User",
        email: `integrity-test-${randomUUID()}@example.invalid`,
        passwordHash: "integration-test-fixture",
      },
    });

    userId = user.id;

    const roomA = await db.resource.create({
      data: {
        name: "Integrity Room A",
        type: "MEETING_ROOM",
        location: "Integration Test",
        createdById: user.id,
      },
    });

    const roomB = await db.resource.create({
      data: {
        name: "Integrity Room B",
        type: "MEETING_ROOM",
        location: "Integration Test",
        createdById: user.id,
      },
    });

    // Create real records through Prisma to test the PostgreSQL constraints.
    const book = (
      client: PrismaClient,
      resourceId: string,
      start: number,
      end: number,
      status: "CONFIRMED" | "CANCELLED" = "CONFIRMED",
    ) =>
      client.reservation.create({
        data: {
          userId: user.id,
          resourceId,
          purpose: "Database Integrity Test",
          startAt: at(start),
          endAt: at(end),
          status,
        },
      });

    // Test 1: Overlapping confirmed bookings must be rejected.
    await book(db, roomA.id, 0, 60);
    await assert.rejects(book(db, roomA.id, 30, 90));
    console.log("PASS: Overlap rejected");

    // Test 2: Adjacent bookings must be accepted.
    // Retain the booking ID for the invalid-update test.
    const adjacentBooking = await book(db, roomA.id, 60, 120);
    console.log("PASS: Adjacent booking accepted");

    // Test 3: Cancelled reservations do not block availability.
    await book(db, roomA.id, 180, 240, "CANCELLED");
    await book(db, roomA.id, 180, 240);
    console.log("PASS: Cancelled slot reusable");

    // Test 4: Different resources can use identical time intervals.
    await book(db, roomB.id, 0, 60);
    console.log("PASS: Different resource accepted");

    // Test 5: Simultaneous overlapping inserts cannot both succeed.
    const results = await Promise.allSettled([
      book(db, roomA.id, 300, 360),
      book(dbConcurrent, roomA.id, 330, 390),
    ]);

    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );

    assert.equal(
      results.filter((result) => result.status === "rejected").length,
      1,
    );

    console.log("PASS: Concurrent overlap prevented");

    // Test 6: Zero-length and reversed intervals must be rejected.
    await assert.rejects(book(db, roomA.id, 480, 480));
    await assert.rejects(book(db, roomA.id, 490, 480));

    // The CHECK constraint must also prevent invalid updates.
    await assert.rejects(
      db.reservation.update({
        where: { id: adjacentBooking.id },
        data: { endAt: at(60) },
      }),
    );

    // A rejected update must preserve the existing reservation.
    const unchangedBooking = await db.reservation.findUnique({
      where: { id: adjacentBooking.id },
    });

    assert.equal(unchangedBooking?.endAt.getTime(), at(120).getTime());

    console.log("PASS: Invalid inserts and updates rejected");

    console.log("All booking integrity tests passed.");
  } finally {
    // Delete only records owned by this temporary test user.
    // Respect the restrictive Reservation -> Resource/User foreign keys.
    try {
      if (userId) {
        await db.reservation.deleteMany({ where: { userId } });
        await db.resource.deleteMany({ where: { createdById: userId } });
        await db.user.delete({ where: { id: userId } });
      }
    } finally {
      await Promise.allSettled([db.$disconnect(), dbConcurrent.$disconnect()]);
    }
  }
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error: unknown) {
    console.error("Booking integrity tests failed:", error);
    process.exitCode = 1;
  }
}

void run();
