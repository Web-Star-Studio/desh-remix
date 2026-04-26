import { fetchAuthSession } from "aws-amplify/auth";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3001";
const isDev = import.meta.env.DEV;

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API ${status}`);
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const session = await fetchAuthSession();
    // Send the ID token (not the access token) so apps/api gets the email +
    // name claims it needs to provision the users row on first sight.
    const token = session.tokens?.idToken?.toString();
    if (!token && isDev) {
      // eslint-disable-next-line no-console
      console.warn("[api-client] fetchAuthSession returned no idToken; request will be unauthenticated");
    }
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (err) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.warn("[api-client] fetchAuthSession threw; request will be unauthenticated", err);
    }
    return {};
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Only send Content-Type when there's a body. Fastify's default parser will
  // try to JSON-parse an empty body if Content-Type is application/json,
  // which 400s on DELETE / GET requests that legitimately have no body.
  const hasBody = init.body !== undefined && init.body !== null;
  const headers: Record<string, string> = {
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...(await authHeaders()),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      try {
        body = await res.text();
      } catch {
        body = null;
      }
    }
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
