import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { hasValidOrigin } from "@/lib/auth/origin";
import {
  getReservationById,
  updateReservation,
} from "@/lib/services/reservations";
import type {
  ReservationDetailResponse,
  ReservationErrorResponse,
  UpdateReservationResponse,
} from "@/lib/types/reservations";
import { updateReservationSchema } from "@/lib/validators/reservations";

const noStoreHeaders = {
  "Cache-Control": "no-store",
} as const;

// Return predictable, sanitized JSON errors.
function errorResponse(
  message: string,
  status: number,
  code: string,
): NextResponse {
  const body: ReservationErrorResponse = {
    error: message,
    code,
  };

  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders,
  });
}

// GET /api/reservations/[reservationId]
// Any authenticated user may view a reservation.
export async function GET(
  _request: Request,
  context: {
    params: Promise<{ reservationId: string }>;
  },
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Authentication required.", 401, "AUTH_REQUIRED");
    }

    const { reservationId } = await context.params;

    const parsedId = z.uuid().safeParse(reservationId);

    if (!parsedId.success) {
      return errorResponse(
        "Invalid reservation ID.",
        400,
        "INVALID_RESERVATION_ID",
      );
    }

    const reservation = await getReservationById(parsedId.data);

    if (!reservation) {
      return errorResponse(
        "Reservation not found.",
        404,
        "RESERVATION_NOT_FOUND",
      );
    }

    const body: ReservationDetailResponse = {
      reservation,
    };

    return NextResponse.json(body, {
      status: 200,
      headers: noStoreHeaders,
    });
  } catch (error: unknown) {
    console.error("Failed to retrieve reservation:", error);

    return errorResponse(
      "Unable to retrieve reservation.",
      500,
      "RESERVATION_DETAIL_FAILED",
    );
  }
}

// PATCH /api/reservations/[reservationId]
// Only the creator may edit a future confirmed reservation.
export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ reservationId: string }>;
  },
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Authentication required.", 401, "AUTH_REQUIRED");
    }

    // Preserve the Origin protection used by existing mutation APIs.
    if (!hasValidOrigin(request)) {
      return errorResponse(
        "Invalid request origin.",
        403,
        "INVALID_REQUEST_ORIGIN",
      );
    }

    const { reservationId } = await context.params;
    const parsedId = z.uuid().safeParse(reservationId);

    if (!parsedId.success) {
      return errorResponse(
        "Invalid reservation ID.",
        400,
        "INVALID_RESERVATION_ID",
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON request body.", 400, "INVALID_JSON");
    }

    // Reject ownership, status, resource, and identifier modifications.
    const parsed = updateReservationSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "Please provide valid reservation update details.",
        400,
        "INVALID_RESERVATION_UPDATE",
      );
    }

    const result = await updateReservation(parsedId.data, parsed.data, user.id);

    switch (result.status) {
      case "updated": {
        if (!result.reservation) {
          throw new Error("Reservation update returned no reservation.");
        }

        const responseBody: UpdateReservationResponse = {
          reservation: result.reservation,
        };

        return NextResponse.json(responseBody, {
          status: 200,
          headers: noStoreHeaders,
        });
      }

      case "not-found":
        return errorResponse(
          "Reservation not found.",
          404,
          "RESERVATION_NOT_FOUND",
        );

      case "forbidden":
        return errorResponse(
          "You can only edit reservations you created.",
          403,
          "RESERVATION_FORBIDDEN",
        );

      case "not-editable":
        return errorResponse(
          "Only future confirmed reservations can be edited.",
          409,
          "RESERVATION_NOT_EDITABLE",
        );

      case "inactive":
        return errorResponse(
          "This resource is inactive and cannot be rescheduled.",
          409,
          "RESOURCE_INACTIVE",
        );

      case "conflict":
        return errorResponse(
          "This resource is already reserved during the selected time.",
          409,
          "RESERVATION_CONFLICT",
        );

      case "invalid-time":
        return errorResponse(
          "The reservation must start in the future and end after its start time.",
          400,
          "INVALID_INTERVAL",
        );
    }
  } catch (error: unknown) {
    console.error("Reservation update failed:", error);

    return errorResponse(
      "Unable to update reservation. Please try again.",
      500,
      "RESERVATION_UPDATE_FAILED",
    );
  }
}
