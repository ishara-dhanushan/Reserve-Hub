import { z } from "zod";

// Require an explicit UTC designator or timezone offset.
// PostgreSQL stores reservation timestamps with millisecond precision.
const reservationDateTimeSchema = z.iso
  .datetime({ offset: true })
  .refine(
    (value) => Number.isFinite(Date.parse(value)),
    "Please provide a valid date and time.",
  )
  .refine(
    (value) => !/\.\d{4,}(?:Z|[+-]\d{2}:\d{2})$/i.test(value),
    "Date and time must have at most three fractional second digits.",
  );

// Reuse the same date fields for availability checks and creation.
const reservationIntervalFields = {
  startAt: reservationDateTimeSchema,
  endAt: reservationDateTimeSchema,
};

// Both operations require a future interval with a valid duration.
// The current time is checked when validation runs, not at module load.
function validateFutureInterval(
  interval: { startAt: string; endAt: string },
  context: z.RefinementCtx,
): void {
  const startAt = Date.parse(interval.startAt);
  const endAt = Date.parse(interval.endAt);

  if (startAt <= Date.now()) {
    context.addIssue({
      code: "custom",
      path: ["startAt"],
      message: "Start time must be in the future.",
    });
  }

  if (endAt <= startAt) {
    context.addIssue({
      code: "custom",
      path: ["endAt"],
      message: "End time must be later than start time.",
    });
  }
}

// GET /api/resources/[resourceId]/availability
// The resourceId path parameter is validated separately by the handler.
export const availabilityQuerySchema = z
  .strictObject({
    ...reservationIntervalFields,
  })
  .superRefine(validateFutureInterval);

export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;

// POST /api/reservations
// userId and status are intentionally excluded from client input.
// The server derives userId from the session and sets CONFIRMED.
export const createReservationSchema = z
  .strictObject({
    resourceId: z.uuid(),

    purpose: z.string().trim().min(3).max(200),

    ...reservationIntervalFields,
  })
  .superRefine(validateFutureInterval);

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

// PATCH /api/reservations/[reservationId]
// Only purpose and interval can be updated; other fields are immutable.
// Supports partial updates; single timestamps are validated against existing values.
export const updateReservationSchema = z
  .strictObject({
    purpose: z.string().trim().min(3).max(200).optional(),
    startAt: reservationDateTimeSchema.optional(),
    endAt: reservationDateTimeSchema.optional(),
  })
  .refine(
    (input) =>
      input.purpose !== undefined ||
      input.startAt !== undefined ||
      input.endAt !== undefined,
    {
      message: "Provide at least one reservation field to update.",
    },
  );

export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
