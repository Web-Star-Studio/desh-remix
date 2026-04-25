import { CognitoJwtVerifier } from "aws-jwt-verify";
import { env } from "../config/env.js";

export interface CognitoJwtPayload {
  sub: string;
  email?: string;
  username?: string;
}

let cachedVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!env.COGNITO_USER_POOL_ID || !env.COGNITO_CLIENT_ID) {
    return null;
  }
  cachedVerifier ??= CognitoJwtVerifier.create({
    userPoolId: env.COGNITO_USER_POOL_ID,
    clientId: env.COGNITO_CLIENT_ID,
    tokenUse: "access",
  });
  return cachedVerifier;
}

export async function verifyCognitoJwt(token: string): Promise<CognitoJwtPayload> {
  const verifier = getVerifier();
  if (!verifier) {
    throw new Error("Cognito is not configured (COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID)");
  }
  const payload = await verifier.verify(token);
  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    username: typeof payload.username === "string" ? payload.username : undefined,
  };
}

export function isCognitoConfigured(): boolean {
  return Boolean(env.COGNITO_USER_POOL_ID && env.COGNITO_CLIENT_ID);
}
