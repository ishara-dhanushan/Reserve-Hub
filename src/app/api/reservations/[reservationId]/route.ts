import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getReservationById } from "@/lib/services/reservations";
import type {
  ReservationDetailResponse,
  ReservationErrorResponse,
} from "@/lib/types/reservations";

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
