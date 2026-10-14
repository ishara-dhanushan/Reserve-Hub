import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { hasValidOrigin } from "@/lib/auth/origin";
import {
  getResourceById,
  hasResourceReservationHistory,
  updateResource,
  deleteResource,
  DuplicateResourceError,
} from "@/lib/services/resources";
import { updateResourceSchema } from "@/lib/validators/resources";

const noStoreHeaders = {
  "Cache-Control": "no-store",
} as const;

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: noStoreHeaders },
  );
}

// GET /api/resources/[resourceId]
export async function GET(
  _request: Request,
  context: {
    params: Promise<{ resourceId: string }>;
  },
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Authentication required.", 401);
    }

    const { resourceId } = await context.params;
    const parsed = z.uuid().safeParse(resourceId);

    if (!parsed.success) {
      return errorResponse("Invalid resource ID.", 400);
    }

    const resource = await getResourceById(parsed.data);

    if (!resource) {
      return errorResponse("Resource not found.", 404);
    }

    const hasReservationHistory = await hasResourceReservationHistory(
      resource.id,
    );

    return NextResponse.json(
      { resource, hasReservationHistory },
      { headers: noStoreHeaders },
    );
  } catch (error: unknown) {
    console.error("Failed to retrieve resource:", error);
    return errorResponse("Unable to retrieve resource.", 500);
  }
}

// PATCH /api/resources/[resourceId]
export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ resourceId: string }>;
  },
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Authentication required.", 401);
    }

    if (!hasValidOrigin(request)) {
      return errorResponse("Invalid request origin.", 403);
    }

    const { resourceId } = await context.params;
    const parsedId = z.uuid().safeParse(resourceId);

    if (!parsedId.success) {
      return errorResponse("Invalid resource ID.", 400);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON request body.", 400);
    }

    const parsed = updateResourceSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Please provide valid resource details.", 400);
    }

    const result = await updateResource(parsedId.data, parsed.data);

    if (result.status === "not-found") {
      return errorResponse("Resource not found.", 404);
    }

    if (result.status === "blocked") {
      return errorResponse(
        "Resource cannot be deactivated while confirmed reservations are ongoing or upcoming.",
        409,
      );
    }

    return NextResponse.json(
      { resource: result.resource },
      { headers: noStoreHeaders },
    );
  } catch (error: unknown) {
    if (error instanceof DuplicateResourceError) {
      return errorResponse(error.message, 409);
    }

    console.error("Resource update failed:", error);
    return errorResponse("Unable to update resource.", 500);
  }
}

// DELETE /api/resources/[resourceId]
export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{ resourceId: string }>;
  },
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Authentication required.", 401);
    }

    if (!hasValidOrigin(request)) {
      return errorResponse("Invalid request origin.", 403);
    }

    const { resourceId } = await context.params;
    const parsed = z.uuid().safeParse(resourceId);

    if (!parsed.success) {
      return errorResponse("Invalid resource ID.", 400);
    }

    const result = await deleteResource(parsed.data);

    if (result === "not-found") {
      return errorResponse("Resource not found.", 404);
    }

    if (result === "blocked") {
      return errorResponse(
        "Resource has reservation history and cannot be permanently deleted. Consider deactivating it instead.",
        409,
      );
    }

    return new NextResponse(null, {
      status: 204,
      headers: noStoreHeaders,
    });
  } catch (error: unknown) {
    console.error("Resource deletion failed:", error);
    return errorResponse("Unable to delete resource.", 500);
  }
}
