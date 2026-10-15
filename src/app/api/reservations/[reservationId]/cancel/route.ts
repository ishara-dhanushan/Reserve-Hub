import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasValidOrigin } from "@/lib/auth/origin";
import { getCurrentUser } from "@/lib/auth/session";
import { cancelReservation } from "@/lib/services/reservations";
import type {
  CancelReservationResponse,
  ReservationErrorResponse,
} from "@/lib/types/reservations";

const noStoreHeaders = {
  "Cache-Control": "no-store",
} as const;

// Return predictable JSON errors without exposing internal details.
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

// POST /api/reservations/[reservationId]/cancel
// Only the creator may cancel a future confirmed reservation.
export async function POST(
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

    // Apply the existing Origin protection to this mutation.
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

    const result = await cancelReservation(parsedId.data, user.id);

    switch (result.status) {
      case "cancelled": {
        if (!result.reservation) {
          throw new Error("Cancellation returned no reservation.");
        }

        const responseBody: CancelReservationResponse = {
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
          "You can only cancel reservations you created.",
          403,
          "RESERVATION_FORBIDDEN",
        );

      case "not-editable":
        return errorResponse(
          "Only future confirmed reservations can be cancelled.",
          409,
          "RESERVATION_NOT_EDITABLE",
        );
    }
  } catch (error: unknown) {
    console.error("Reservation cancellation failed:", error);

    return errorResponse(
      "Unable to cancel reservation. Please try again.",
      500,
      "RESERVATION_CANCELLATION_FAILED",
    );
  }
}
