import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasValidOrigin } from "@/lib/auth/origin";
import {
  createReservation,
  listReservations,
} from "@/lib/services/reservations";
import type {
  CreateReservationResponse,
  ReservationErrorResponse,
  ReservationListResponse,
} from "@/lib/types/reservations";
import { createReservationSchema } from "@/lib/validators/reservations";

const noStoreHeaders = {
  "Cache-Control": "no-store",
} as const;

// Return safe, predictable JSON errors to the frontend.
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

// GET /api/reservations
// Returns all reservations by default, with an optional current-user filter.
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Authentication required.", 401, "AUTH_REQUIRED");
    }

    const searchParams = request.nextUrl.searchParams;
    const scopeValues = searchParams.getAll("scope");

    // Reject unsupported and duplicate query parameters.
    const hasUnexpectedParameters = Array.from(searchParams.keys()).some(
      (key) => key !== "scope",
    );

    if (hasUnexpectedParameters || scopeValues.length > 1) {
      return errorResponse(
        "Invalid reservation list query.",
        400,
        "INVALID_QUERY",
      );
    }

    const scope = scopeValues[0] ?? "all";

    if (scope !== "all" && scope !== "mine") {
      return errorResponse("Scope must be all or mine.", 400, "INVALID_SCOPE");
    }

    const reservations = await listReservations(scope, user.id);

    const body: ReservationListResponse = {
      reservations,
    };

    return NextResponse.json(body, {
      status: 200,
      headers: noStoreHeaders,
    });
  } catch (error: unknown) {
    console.error("Failed to retrieve reservations:", error);

    return errorResponse(
      "Unable to retrieve reservations.",
      500,
      "RESERVATION_LIST_FAILED",
    );
  }
}

// POST /api/reservations
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // The authenticated session determines the reservation creator.
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Authentication required.", 401, "AUTH_REQUIRED");
    }

    // Apply the existing CSRF origin protection used by resource APIs.
    if (!hasValidOrigin(request)) {
      return errorResponse(
        "Invalid request origin.",
        403,
        "INVALID_REQUEST_ORIGIN",
      );
    }

    // Read the JSON request body safely.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON request body.", 400, "INVALID_JSON");
    }

    // Validate the complete request before accessing the database.
    // This strict schema rejects client-supplied userId and status.
    const parsed = createReservationSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "Please provide valid reservation details.",
        400,
        "INVALID_RESERVATION",
      );
    }

    // Use the verified session user ID, never a client-supplied owner.
    const result = await createReservation(parsed.data, user.id);

    switch (result.status) {
      case "created": {
        const responseBody: CreateReservationResponse = {
          reservation: result.reservation,
        };

        return NextResponse.json(responseBody, {
          status: 201,
          headers: noStoreHeaders,
        });
      }

      case "not-found":
        return errorResponse("Resource not found.", 404, "RESOURCE_NOT_FOUND");

      case "inactive":
        return errorResponse(
          "This resource is inactive and cannot be reserved.",
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
    // Unexpected database errors are logged on the server only.
    // Recognized overlap errors are translated by the service to 409.
    console.error("Reservation creation failed:", error);

    return errorResponse(
      "Unable to create reservation. Please try again.",
      500,
      "RESERVATION_CREATION_FAILED",
    );
  }
}
