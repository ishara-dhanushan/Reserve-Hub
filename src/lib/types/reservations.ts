import type { ReservationStatus, ResourceType } from "@/generated/prisma/enums";

/**
 * JSON representation of a reservation returned by the API.
 * Dates are serialized as ISO-8601 strings rather than Date objects.
 */
export type ReservationDTO = {
  id: string;
  userId: string;
  resourceId: string;
  purpose: string;
  startAt: string;
  endAt: string;
  status: ReservationStatus;
  createdAt: string;
};

/**
 * Availability is advisory. The creation API must independently
 * enforce resource eligibility and database overlap constraints.
 */
export type ResourceAvailabilityResponse =
  | {
      available: true;
      reason: null;
    }
  | {
      available: false;
      reason: "INACTIVE" | "CONFLICT";
    };

/** Successful POST /api/reservations response (HTTP 201). */
export type CreateReservationResponse = {
  reservation: ReservationDTO;
};

/** Safe API error payload containing no database details. */
export type ReservationErrorResponse = {
  error: string;
  code?: string;
};

/**
 * Public reservation information for history and detail views.
 * Nested user data contains only the creator's display name.
 */
export type ReservationWithDetailsDTO = ReservationDTO & {
  creator: {
    name: string;
  };
  resource: {
    name: string;
    type: ResourceType;
    location: string;
    isActive: boolean;
  };
};

/** GET /api/reservations response. */
export type ReservationListResponse = {
  reservations: ReservationWithDetailsDTO[];
};

/** GET /api/reservations/[reservationId] response. */
export type ReservationDetailResponse = {
  reservation: ReservationWithDetailsDTO;
};
