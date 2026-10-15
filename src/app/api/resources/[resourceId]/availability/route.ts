import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getResourceAvailability } from "@/lib/services/reservations";
import type { ReservationErrorResponse } from "@/lib/types/reservations";
import { availabilityQuerySchema } from "@/lib/validators/reservations";

const noStoreHeaders = {
  "Cache-Control": "no-store",
} as const;

// Return consistent JSON errors without exposing internal details.
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

// GET /api/resources/[resourceId]/availability
export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ resourceId: string }>;
  },
): Promise<NextResponse> {
  try {
    // Availability information is visible to authenticated users only.
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Authentication required.", 401, "AUTH_REQUIRED");
    }

    // Validate the dynamic resource identifier.
    const { resourceId } = await context.params;
    const parsedId = z.uuid().safeParse(resourceId);

    if (!parsedId.success) {
      return errorResponse("Invalid resource ID.", 400, "INVALID_RESOURCE_ID");
    }

    const searchParams = request.nextUrl.searchParams;

    // Require exactly one value for each time parameter.
    // Duplicate parameters must not introduce ambiguous requests.
    if (
      searchParams.getAll("startAt").length !== 1 ||
      searchParams.getAll("endAt").length !== 1
    ) {
      return errorResponse(
        "Please provide one startAt and one endAt value.",
        400,
        "INVALID_INTERVAL",
      );
    }

    // Convert the URL parameters into an object for strict Zod validation.
    const query = Object.fromEntries(searchParams.entries());
    const parsedQuery = availabilityQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      return errorResponse(
        "Please provide a valid future reservation interval.",
        400,
        "INVALID_INTERVAL",
      );
    }

    // Delegate resource and overlap checks to the service layer.
    const result = await getResourceAvailability(
      parsedId.data,
      parsedQuery.data,
    );

    if (result.status === "not-found") {
      return errorResponse("Resource not found.", 404, "RESOURCE_NOT_FOUND");
    }

    if (!result.availability) {
      throw new Error("Availability check returned no result.");
    }

    // The availability result is advisory; POST validates again.
    return NextResponse.json(result.availability, {
      status: 200,
      headers: noStoreHeaders,
    });
  } catch (error: unknown) {
    console.error("Failed to check resource availability:", error);

    return errorResponse(
      "Unable to check resource availability.",
      500,
      "AVAILABILITY_CHECK_FAILED",
    );
  }
}
