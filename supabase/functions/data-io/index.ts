/**
 * @function data-io
 * @description Import/export de dados do usuário
 * @status active
 * @calledBy Settings
 */
import { corsHeaders, handleCors, errorResponse } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case "export": {
        const { handleExport } = await import("../_shared/data-export.ts");
        return await handleExport(req, params);
      }
      case "import": {
        const { handleImport } = await import("../_shared/data-import.ts");
        return await handleImport(req, params);
      }
      default:
        return errorResponse(400, `Unknown action: ${action}`);
    }
  } catch (e: any) {
    console.error("data-io error:", e);
    return errorResponse(500, e.message || "Internal error");
  }
});
