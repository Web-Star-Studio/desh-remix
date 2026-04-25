import type { SaaSWebMessage, SaaSWebMessageResponse } from "@desh/shared/hermes";
import { env } from "../config/env.js";

export interface HermesProfileTarget {
  port: number;
  adapterSecret: string;
}

export async function sendHermesMessage(
  _target: HermesProfileTarget,
  _message: SaaSWebMessage,
): Promise<SaaSWebMessageResponse> {
  // TODO: implement once apps/api owns workspace lifecycle.
  // Will POST to env.HERMES_BASE_URL_TEMPLATE.replace('{port}', target.port)
  // with `Authorization: Bearer ${target.adapterSecret}`.
  void env;
  throw new Error("hermes-client: not implemented");
}
