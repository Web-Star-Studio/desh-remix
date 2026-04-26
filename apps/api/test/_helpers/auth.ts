import { SignJWT } from "jose";

const encoder = new TextEncoder();

// Crafts an HS256 token shaped like a Supabase JWT. The auth plugin's
// fallback path verifies these against SUPABASE_JWT_SECRET (set in the
// global test setup), so test requests can authenticate as any synthetic
// user without standing up Cognito.
export async function signTestToken(opts: { sub: string; email: string }): Promise<string> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error("SUPABASE_JWT_SECRET not set in test env");
  return new SignJWT({ email: opts.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(opts.sub)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(encoder.encode(secret));
}

export function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}
