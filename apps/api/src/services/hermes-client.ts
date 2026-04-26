import type { SaaSWebMessage, SaaSWebMessageResponse } from "@desh/shared/hermes";
import { ensureRunning, getRunningPort } from "./hermes/process-supervisor.js";

export interface HermesProfileTarget {
  profileId: string;
  port: number;
  adapterSecret: string;
}

export class HermesUnavailableError extends Error {
  constructor(
    message: string,
    public reason: string,
  ) {
    super(message);
  }
}

export async function sendHermesMessage(
  target: HermesProfileTarget,
  message: SaaSWebMessage,
): Promise<SaaSWebMessageResponse> {
  await ensureRunning(target.profileId);

  const port = getRunningPort(target.profileId) ?? target.port;
  const url = `http://127.0.0.1:${port}/messages`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${target.adapterSecret}`,
      },
      body: JSON.stringify(message),
    });
  } catch (err) {
    throw new HermesUnavailableError(
      `failed to reach Hermes gateway at ${url}: ${(err as Error).message}`,
      "connection_failed",
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HermesUnavailableError(
      `Hermes gateway returned ${res.status}: ${body}`,
      `gateway_${res.status}`,
    );
  }

  return (await res.json()) as SaaSWebMessageResponse;
}
