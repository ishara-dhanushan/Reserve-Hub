import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE_NAME = "reservehub_session";
export const SESSION_MAX_AGE = 12 * 60 * 60;

const ISSUER = "reservehub";
const AUDIENCE = "reservehub-web";
const ALGORITHM = "HS256";

function getSigningKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 UTF-8 bytes.");
  }

  return new TextEncoder().encode(secret);
}

// The token carries only the user's ID, not passwords or private data.
export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSigningKey());
}

export async function verifySessionToken(
  token: string,
): Promise<string | null> {
  const key = getSigningKey();

  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    return typeof payload.sub === "string" && payload.sub.length > 0
      ? payload.sub
      : null;
  } catch {
    // Invalid, expired, or tampered tokens are not valid sessions.
    return null;
  }
}
