import { Buffer } from "node:buffer";

// Construct an RS256-shaped JWT whose payload encodes the synthetic user.
// The vitest setup at `_helpers/setup.ts` mocks `verifyCognitoJwt` to read
// the payload directly, so no real Cognito user pool is needed.
export async function signTestToken(opts: { sub: string; email: string }): Promise<string> {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: opts.sub, email: opts.email })).toString("base64url");
  return `${header}.${payload}.test-signature`;
}

export function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}
