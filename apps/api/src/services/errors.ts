/**
 * Service-layer errors carry both an HTTP status (so route handlers can map
 * straight to a reply) and a stable string code (so JSON bodies stay
 * consistent and so the MCP layer can translate to MCP errors). The same
 * service functions are called from REST routes and from MCP tools, hence
 * the dual-target design.
 */
export class ServiceError extends Error {
  constructor(public httpStatus: number, public errorCode: string) {
    super(errorCode);
    this.name = "ServiceError";
  }
}

export function isServiceError(err: unknown): err is ServiceError {
  return err instanceof ServiceError;
}
