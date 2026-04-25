/**
 * @function drive-cross-copy
 * @description Cópia cross-service entre Google Drive e R2 storage
 * @status active
 * @calledBy GoogleDriveExplorer
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { getComposioAccessToken, resolveWorkspaceId } from "../_shared/composio-client.ts";
import { corsHeaders } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const { fileId, fileName, mimeType, sourceConnectionId, targetConnectionId, targetFolderId, workspace_id } = await req.json();

    if (!fileId || !sourceConnectionId || !targetConnectionId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve workspace for composite entityId
    const wsId = await resolveWorkspaceId(supabase, userId, workspace_id);

    // Get access tokens via Composio with workspace-aware entityId
    const [srcToken, tgtToken] = await Promise.all([
      getComposioAccessToken(userId, "googledrive", wsId),
      getComposioAccessToken(userId, "googledrive", wsId),
    ]);

    if (!srcToken || !tgtToken) {
      return new Response(JSON.stringify({ error: "Failed to get Drive tokens via Composio" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isGoogleDoc = mimeType?.startsWith("application/vnd.google-apps.");

    let fileContent: ArrayBuffer;
    let uploadMimeType = mimeType || "application/octet-stream";
    let uploadFileName = fileName || "file";

    if (isGoogleDoc) {
      const exportMimeMap: Record<string, { exportMime: string; ext: string }> = {
        "application/vnd.google-apps.document": { exportMime: "application/pdf", ext: ".pdf" },
        "application/vnd.google-apps.spreadsheet": { exportMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: ".xlsx" },
        "application/vnd.google-apps.presentation": { exportMime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ext: ".pptx" },
        "application/vnd.google-apps.drawing": { exportMime: "image/png", ext: ".png" },
      };
      const mapping = exportMimeMap[mimeType] || { exportMime: "application/pdf", ext: ".pdf" };
      uploadMimeType = mapping.exportMime;
      uploadFileName = uploadFileName.replace(/\.[^.]+$/, "") + mapping.ext;

      const exportRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(mapping.exportMime)}`, {
        headers: { Authorization: `Bearer ${srcToken}` },
      });
      if (!exportRes.ok) {
        const errText = await exportRes.text();
        return new Response(JSON.stringify({ error: `Export failed: ${errText}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      fileContent = await exportRes.arrayBuffer();
    } else {
      const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${srcToken}` },
      });
      if (!downloadRes.ok) {
        const errText = await downloadRes.text();
        return new Response(JSON.stringify({ error: `Download failed: ${errText}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      fileContent = await downloadRes.arrayBuffer();
    }

    if (fileContent.byteLength > 50 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File too large for cross-workspace copy (max 50MB)" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const metadata: any = { name: uploadFileName };
    if (targetFolderId) metadata.parents = [targetFolderId];
    else metadata.parents = ["root"];

    const boundary = "drive_cross_copy_boundary";
    const metadataStr = JSON.stringify(metadata);
    const encoder = new TextEncoder();

    const parts = [
      encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataStr}\r\n`),
      encoder.encode(`--${boundary}\r\nContent-Type: ${uploadMimeType}\r\n\r\n`),
      new Uint8Array(fileContent),
      encoder.encode(`\r\n--${boundary}--`),
    ];

    const totalLength = parts.reduce((sum, p) => sum + p.byteLength, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      body.set(part, offset);
      offset += part.byteLength;
    }

    const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tgtToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return new Response(JSON.stringify({ error: `Upload failed: ${errText}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await uploadRes.json();

    return new Response(JSON.stringify({
      success: true,
      file: { id: result.id, name: result.name, webViewLink: result.webViewLink },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("drive-cross-copy error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
