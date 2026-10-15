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
  UpdateReservationInput,
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
export interface AvailabilityResult {
  status: "checked" | "not-found";
  availability?: ResourceAvailabilityResponse;
}

export interface CreateReservationResult {
  status: "created" | "not-found" | "inactive" | "conflict" | "invalid-time";
  reservation?: ReservationDTO;
}

// Outcomes handled by the reservation update API.
export interface UpdateReservationResult {
  status:
    | "updated"
    | "not-found"
    | "forbidden"
    | "not-editable"
    | "inactive"
    | "conflict"
    | "invalid-time";
  reservation?: ReservationDTO;
}

// Outcomes handled by the reservation cancellation API.
export interface CancelReservationResult {
  status: "cancelled" | "not-found" | "forbidden" | "not-editable";
  reservation?: ReservationDTO;
}

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

// Update the purpose and/or interval of a creator-owned future reservation.
// All eligibility and conflict checks are performed inside a transaction.
export async function updateReservation(
  reservationId: string,
  input: UpdateReservationInput,
  authenticatedUserId: string,
): Promise<UpdateReservationResult> {
  // Read the immutable resource identifier to establish lock order.
  // No authorization decision is made from this preliminary read.
  const locator = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { resourceId: true },
  });

  if (!locator) {
    return { status: "not-found" };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Lock Resource first, matching reservation creation and
      // resource lifecycle operations.
      const lockedResources = await tx.$queryRaw<
        Array<{ id: string; isActive: boolean }>
      >`
        SELECT "id", "isActive"
        FROM "Resource"
        WHERE "id" = ${locator.resourceId}::uuid
        FOR UPDATE
      `;

      const resource = lockedResources[0];

      if (!resource) {
        return { status: "not-found" } as const;
      }

      // Lock the reservation after locking its Resource row.
      // This prevents another compliant mutation from changing
      // the reservation while eligibility is being checked.
      const lockedReservations = await tx.$queryRaw<
        Array<{
          id: string;
          userId: string;
          resourceId: string;
          status: "CONFIRMED" | "CANCELLED";
          startAt: Date;
          endAt: Date;
        }>
      >`
        SELECT
          "id",
          "userId",
          "resourceId",
          "status",
          "startAt",
          "endAt"
        FROM "Reservation"
        WHERE "id" = ${reservationId}::uuid
        FOR UPDATE
      `;

      const existing = lockedReservations[0];

      if (!existing) {
        return { status: "not-found" } as const;
      }

      // The resource association is immutable through ReserveHub APIs.
      if (existing.resourceId !== resource.id) {
        return { status: "not-editable" } as const;
      }

      // Only the authenticated creator may modify this reservation.
      if (existing.userId !== authenticatedUserId) {
        return { status: "forbidden" } as const;
      }

      const now = Date.now();
      const originalStartAt = new Date(existing.startAt);
      const originalEndAt = new Date(existing.endAt);

      // The original reservation must still be future and confirmed.
      // Ongoing, completed, and cancelled records are read-only.
      if (existing.status !== "CONFIRMED" || originalStartAt.getTime() <= now) {
        return { status: "not-editable" } as const;
      }

      // Future confirmed bookings require an active resource.
      if (!resource.isActive) {
        return { status: "inactive" } as const;
      }

      // Retain unchanged values for partial updates.
      const startAt =
        input.startAt !== undefined ? new Date(input.startAt) : originalStartAt;

      const endAt =
        input.endAt !== undefined ? new Date(input.endAt) : originalEndAt;

      // Validate the complete interval after applying supplied changes.
      if (
        !Number.isFinite(startAt.getTime()) ||
        !Number.isFinite(endAt.getTime()) ||
        startAt.getTime() <= now ||
        endAt.getTime() <= startAt.getTime()
      ) {
        return { status: "invalid-time" } as const;
      }

      // Exclude the current reservation when checking overlap.
      // Cancelled reservations do not block an interval.
      const conflict = await tx.reservation.findFirst({
        where: {
          id: { not: existing.id },
          resourceId: existing.resourceId,
          status: "CONFIRMED",
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
        select: { id: true },
      });

      if (conflict) {
        return { status: "conflict" } as const;
      }

      // Only mutable fields are included.
      // Never update userId, resourceId, status, id, or createdAt.
      const updated = await tx.reservation.update({
        where: { id: existing.id },
        data: {
          ...(input.purpose !== undefined && {
            purpose: input.purpose,
          }),
          ...(input.startAt !== undefined && {
            startAt,
          }),
          ...(input.endAt !== undefined && {
            endAt,
          }),
        },
        select: reservationSelect,
      });

      return {
        status: "updated",
        reservation: toReservationDTO(updated),
      } as const;
    });
  } catch (error: unknown) {
    // PostgreSQL remains the final overlap-prevention guarantee.
    // A failed transaction preserves the original reservation.
    if (isReservationOverlapError(error)) {
      return { status: "conflict" };
    }

    throw error;
  }
}

// Cancel a creator-owned future confirmed reservation.
// Keep the reservation record and release its booked interval.
export async function cancelReservation(
  reservationId: string,
  authenticatedUserId: string,
): Promise<CancelReservationResult> {
  // Read the immutable resource ID to maintain the existing lock order.
  const locator = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { resourceId: true },
  });

  if (!locator) {
    return { status: "not-found" };
  }

  return prisma.$transaction(async (tx) => {
    // Lock the resource before locking its reservation.
    // This matches booking creation, rescheduling, and lifecycle operations.
    const lockedResources = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Resource"
      WHERE "id" = ${locator.resourceId}::uuid
      FOR UPDATE
    `;

    if (lockedResources.length === 0) {
      return { status: "not-found" } as const;
    }

    // Lock the reservation and read its latest state.
    const lockedReservations = await tx.$queryRaw<
      Array<{
        id: string;
        userId: string;
        resourceId: string;
        status: "CONFIRMED" | "CANCELLED";
        startAt: Date;
      }>
    >`
      SELECT "id", "userId", "resourceId", "status", "startAt"
      FROM "Reservation"
      WHERE "id" = ${reservationId}::uuid
      FOR UPDATE
    `;

    const existing = lockedReservations[0];

    if (!existing) {
      return { status: "not-found" } as const;
    }

    // Do not proceed if the immutable resource association changed.
    if (existing.resourceId !== locator.resourceId) {
      return { status: "not-found" } as const;
    }

    // Only the original creator may cancel the reservation.
    if (existing.userId !== authenticatedUserId) {
      return { status: "forbidden" } as const;
    }

    // Ongoing, completed, and cancelled reservations are not cancellable.
    if (
      existing.status !== "CONFIRMED" ||
      new Date(existing.startAt).getTime() <= Date.now()
    ) {
      return { status: "not-editable" } as const;
    }

    // Preserve the reservation and change only its stored status.
    const cancelled = await tx.reservation.update({
      where: { id: existing.id },
      data: { status: "CANCELLED" },
      select: reservationSelect,
    });

    return {
      status: "cancelled",
      reservation: toReservationDTO(cancelled),
    } as const;
  });
}
