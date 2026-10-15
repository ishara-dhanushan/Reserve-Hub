import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ReservationDTO,
  ReservationWithDetailsDTO,
  ResourceAvailabilityResponse,
} from "@/lib/types/reservations";
import type {
  AvailabilityQueryInput,
  CreateReservationInput,
} from "@/lib/validators/reservations";

// Select only fields that are allowed in the reservation API response.
const reservationSelect = {
  id: true,
  userId: true,
  resourceId: true,
  purpose: true,
  startAt: true,
  endAt: true,
  status: true,
  createdAt: true,
} as const satisfies Prisma.ReservationSelect;

type ReservationRecord = Prisma.ReservationGetPayload<{
  select: typeof reservationSelect;
}>;

// The API handler converts these outcomes into HTTP responses.
export type AvailabilityResult =
  | { status: "not-found" }
  | {
      status: "checked";
      availability: ResourceAvailabilityResponse;
    };

export type CreateReservationResult =
  | { status: "created"; reservation: ReservationDTO }
  | {
      status: "not-found" | "inactive" | "conflict" | "invalid-time";
    };

// Convert database Date objects into browser-safe ISO strings.
function toReservationDTO(reservation: ReservationRecord): ReservationDTO {
  return {
    id: reservation.id,
    userId: reservation.userId,
    resourceId: reservation.resourceId,
    purpose: reservation.purpose,
    startAt: reservation.startAt.toISOString(),
    endAt: reservation.endAt.toISOString(),
    status: reservation.status,
    createdAt: reservation.createdAt.toISOString(),
  };
}

// Select only the fields required by reservation history and details.
// Never fetch User.passwordHash or User.email for booking views.
const reservationWithDetailsSelect = {
  ...reservationSelect,
  user: {
    select: {
      name: true,
    },
  },
  resource: {
    select: {
      name: true,
      type: true,
      location: true,
      isActive: true,
    },
  },
} as const satisfies Prisma.ReservationSelect;

type ReservationWithDetailsRecord = Prisma.ReservationGetPayload<{
  select: typeof reservationWithDetailsSelect;
}>;

// Serialize the selected database record into a public API response.
function toReservationWithDetailsDTO(
  reservation: ReservationWithDetailsRecord,
): ReservationWithDetailsDTO {
  return {
    ...toReservationDTO(reservation),
    creator: {
      name: reservation.user.name,
    },
    resource: {
      name: reservation.resource.name,
      type: reservation.resource.type,
      location: reservation.resource.location,
      isActive: reservation.resource.isActive,
    },
  };
}

// Detect the PostgreSQL exclusion-constraint error (SQLSTATE 23P01).
// Prisma 7 and the Neon adapter may wrap this code in error metadata.
function isReservationOverlapError(error: unknown): boolean {
  const pending: unknown[] = [error];
  const visited = new Set<object>();

  while (pending.length > 0) {
    const current = pending.pop();

    if (
      typeof current !== "object" ||
      current === null ||
      visited.has(current)
    ) {
      continue;
    }

    visited.add(current);

    const details = current as Record<string, unknown>;

    // Native PostgreSQL errors or nested driver-adapter errors.
    if (
      details.code === "23P01" ||
      details.originalCode === "23P01" ||
      details.sqlState === "23P01"
    ) {
      return true;
    }

    // Some Prisma errors retain the SQLSTATE only in their message.
    // Restrict this fallback to known database error wrappers.
    if (
      (details.code === "P2004" ||
        details.code === "P2010" ||
        details.code === "P2039") &&
      typeof details.message === "string" &&
      /\b23P01\b/.test(details.message)
    ) {
      return true;
    }

    pending.push(details.cause, details.meta, details.driverAdapterError);
  }

  return false;
}

// Check availability for an already-validated future interval.
// This is advisory: a booking can be created before the caller submits.
export async function getResourceAvailability(
  resourceId: string,
  input: AvailabilityQueryInput,
): Promise<AvailabilityResult> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: { id: true, isActive: true },
  });

  if (!resource) {
    return { status: "not-found" };
  }

  if (!resource.isActive) {
    return {
      status: "checked",
      availability: {
        available: false,
        reason: "INACTIVE",
      },
    };
  }

  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  // Half-open intervals [startAt, endAt) allow adjacent bookings.
  // Cancelled bookings do not block a resource.
  const conflictingReservation = await prisma.reservation.findFirst({
    where: {
      resourceId,
      status: "CONFIRMED",
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true },
  });

  if (conflictingReservation) {
    return {
      status: "checked",
      availability: {
        available: false,
        reason: "CONFLICT",
      },
    };
  }

  return {
    status: "checked",
    availability: {
      available: true,
      reason: null,
    },
  };
}

// Create a reservation with the identity supplied by the verified session.
// The service never reads userId or status from the client request.
export async function createReservation(
  input: CreateReservationInput,
  authenticatedUserId: string,
): Promise<CreateReservationResult> {
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  try {
    return await prisma.$transaction(async (tx) => {
      // Lock the same Resource row used by RH-06 lifecycle operations.
      // The lock remains held until this transaction commits or rolls back.
      const lockedResources = await tx.$queryRaw<
        Array<{ id: string; isActive: boolean }>
      >`
        SELECT "id", "isActive"
        FROM "Resource"
        WHERE "id" = ${input.resourceId}::uuid
        FOR UPDATE
      `;

      const resource = lockedResources[0];

      if (!resource) {
        return { status: "not-found" } as const;
      }

      if (!resource.isActive) {
        return { status: "inactive" } as const;
      }

      // Recheck the time after acquiring the lock. An interval may
      // become invalid while the transaction waits for another writer.
      if (
        !Number.isFinite(startAt.getTime()) ||
        !Number.isFinite(endAt.getTime()) ||
        startAt.getTime() <= Date.now() ||
        endAt.getTime() <= startAt.getTime()
      ) {
        return { status: "invalid-time" } as const;
      }

      // Provide a clear conflict result before attempting insertion.
      // The database exclusion constraint is still the final guarantee.
      const conflict = await tx.reservation.findFirst({
        where: {
          resourceId: resource.id,
          status: "CONFIRMED",
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
        select: { id: true },
      });

      if (conflict) {
        return { status: "conflict" } as const;
      }

      // Explicitly assign the authenticated owner and confirmed status.
      const reservation = await tx.reservation.create({
        data: {
          userId: authenticatedUserId,
          resourceId: resource.id,
          purpose: input.purpose,
          startAt,
          endAt,
          status: "CONFIRMED",
        },
        select: reservationSelect,
      });

      return {
        status: "created",
        reservation: toReservationDTO(reservation),
      } as const;
    });
  } catch (error: unknown) {
    // PostgreSQL exclusion violations can still occur if another
    // writer does not follow the application-level locking protocol.
    if (isReservationOverlapError(error)) {
      return { status: "conflict" };
    }

    // Unexpected database failures must not be disguised as conflicts.
    // Step 3 will log them server-side and return a sanitized HTTP 500.
    throw error;
  }
}

// List reservation history for authenticated users.
// By default, every reservation is visible, regardless of creator.
// The optional "mine" scope filters by the authenticated user's ID.
export async function listReservations(
  scope: "all" | "mine",
  authenticatedUserId: string,
): Promise<ReservationWithDetailsDTO[]> {
  const reservations = await prisma.reservation.findMany({
    where: scope === "mine" ? { userId: authenticatedUserId } : undefined,
    select: reservationWithDetailsSelect,
    orderBy: [{ startAt: "desc" }, { id: "asc" }],
  });

  return reservations.map(toReservationWithDetailsDTO);
}

// Retrieve a single reservation with safe creator and resource details.
// Ownership restrictions apply to mutations, not read operations.
export async function getReservationById(
  reservationId: string,
): Promise<ReservationWithDetailsDTO | null> {
  const reservation = await prisma.reservation.findUnique({
    where: {
      id: reservationId,
    },
    select: reservationWithDetailsSelect,
  });

  if (!reservation) {
    return null;
  }

  return toReservationWithDetailsDTO(reservation);
}
