import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { hasValidOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators/auth";

// Detect unique-email violations without exposing database internals.
function isDuplicateEmailError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const databaseError = error as {
    code?: unknown;
    cause?: unknown;
  };

  if (databaseError.code === "P2002" || databaseError.code === "23505") {
    return true;
  }

  return databaseError.cause
    ? isDuplicateEmailError(databaseError.cause)
    : false;
}

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please provide valid registration details." },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    // Registration intentionally does not create a login session.
    return NextResponse.json({ user }, { status: 201 });
  } catch (error: unknown) {
    // Handle concurrent requests registering the same normalized email.
    if (isDuplicateEmailError(error)) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    console.error("Registration failed:", error);

    return NextResponse.json(
      { error: "Unable to create your account." },
      { status: 500 },
    );
  }
}
