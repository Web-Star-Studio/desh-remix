import { isServiceError } from "../errors.js";

// MCP tool results are `{ content: [{ type, text|...}] }` blocks. We always
// return a single text block with JSON for successes, and a single text
// block with `isError: true` for failures — keeping the agent's parser
// simple and consistent across tools.

export function toolText(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value),
      },
    ],
  };
}

export function toolError(err: unknown) {
  const message = isServiceError(err)
    ? err.errorCode
    : err instanceof Error
      ? err.message
      : String(err);
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}
