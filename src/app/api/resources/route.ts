import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { hasValidOrigin } from "@/lib/auth/origin";
import { listResources, createResource } from "@/lib/services/resources";
import { createResourceSchema } from "@/lib/validators/resources";

const noStoreHeaders = {
  "Cache-Control": "no-store",
} as const;

// GET /api/resources
export async function GET(): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401, headers: noStoreHeaders },
      );
    }

    const resources = await listResources();

    return NextResponse.json({ resources }, { headers: noStoreHeaders });
  } catch (error: unknown) {
    console.error("Failed to list resources:", error);

    return NextResponse.json(
      { error: "Unable to load resources." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

// POST /api/resources
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401, headers: noStoreHeaders },
      );
    }

    if (!hasValidOrigin(request)) {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403, headers: noStoreHeaders },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const parsed = createResourceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide valid resource details." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const resource = await createResource(parsed.data, user.id);

    return NextResponse.json(
      { resource },
      { status: 201, headers: noStoreHeaders },
    );
  } catch (error: unknown) {
    console.error("Resource creation failed:", error);

    return NextResponse.json(
      { error: "Unable to create resource." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
