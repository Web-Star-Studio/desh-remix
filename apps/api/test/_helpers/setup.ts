import { Buffer } from "node:buffer";
import { vi } from "vitest";

// Replace the Cognito verifier with a JWT-payload decoder so tests can mint
// "tokens" without standing up a real user pool. The auth plugin still gates
// on alg=RS256 + isCognitoConfigured(), so test tokens must be RS256-shaped.
vi.mock("../../src/auth/cognito-jwt.js", () => ({
  isCognitoConfigured: () => true,
  verifyCognitoJwt: vi.fn(async (token: string) => {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) throw new Error("malformed test token");
    const decoded = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    ) as { sub?: string; email?: string };
    if (!decoded.sub) throw new Error("test token missing sub");
    return { sub: decoded.sub, email: decoded.email };
  }),
}));
