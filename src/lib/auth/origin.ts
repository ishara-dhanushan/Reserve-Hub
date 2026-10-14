import "server-only";

// Require browser mutations to originate from the current application origin.
// Requests with a missing or mismatched Origin are rejected.
export function hasValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
