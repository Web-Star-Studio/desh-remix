/**
 * @function files-storage
 * @description Storage de arquivos (upload, download, R2, OCR, AI processing)
 * @status active
 * @calledBy FilesPage
 */
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/utils.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.3";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const authResult = await verifyAuth(req);
    if (authResult instanceof Response) {
      return new Response(authResult.body, {
        status: authResult.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authResult.userId;
    const body = await req.json();
    const { action, ...params } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    switch (action) {
      case "get-upload-url": {
        const { getUploadUrl } = await import("../_shared/r2-client.ts");
        const { fileName, contentType, sizeBytes, folderId, workspaceId } = params;
        if (!fileName || !contentType) return errorResponse(400, "fileName and contentType required");

        const key = `${userId}/${crypto.randomUUID()}/${fileName}`;
        const url = await getUploadUrl(key, contentType);

        return jsonResponse({ url, storagePath: key, fileName, contentType, sizeBytes });
      }

      case "upload-proxy": {
        const { storagePath, contentType: ct, fileBase64 } = params;
        if (!storagePath || !fileBase64 || !ct) return errorResponse(400, "storagePath, contentType, fileBase64 required");

        const { S3Client, PutObjectCommand } = await import("npm:@aws-sdk/client-s3@3.600.0");
        const accountId = Deno.env.get("R2_ACCOUNT_ID");
        const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
        const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
        const bucket = Deno.env.get("R2_BUCKET_NAME");
        if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return errorResponse(500, "R2 not configured");

        const binaryStr = atob(fileBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

        const client = new S3Client({
          region: "auto",
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId, secretAccessKey },
        });

        await client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: storagePath,
          ContentType: ct,
          Body: bytes,
        }));

        return jsonResponse({ success: true, storagePath });
      }

      case "confirm-upload": {
        const { storagePath, fileName, originalName, contentType, sizeBytes, folderId, workspaceId, contentHash, forceUpload } = params;
        if (!storagePath || !fileName || !contentType) return errorResponse(400, "Missing required fields");

        // Check for duplicates by hash
        if (contentHash && !forceUpload) {
          const { data: existing } = await supabase
            .from("files")
            .select("id, name")
            .eq("user_id", userId)
            .eq("content_hash", contentHash)
            .eq("is_trashed", false)
            .limit(1)
            .single();
          if (existing) {
            return jsonResponse({ duplicateFound: true, existingFile: existing, storagePath });
          }
        }

        const { data: file, error } = await supabase
          .from("files")
          .insert({
            user_id: userId,
            workspace_id: workspaceId || null,
            folder_id: folderId || null,
            name: fileName,
            original_name: originalName || fileName,
            mime_type: contentType,
            size_bytes: sizeBytes || 0,
            storage_path: storagePath,
            source: "upload",
            content_hash: contentHash || null,
          })
          .select()
          .single();

        if (error) return errorResponse(500, error.message);

        return jsonResponse({ file });
      }

      case "get-download-url": {
        const { getDownloadUrl } = await import("../_shared/r2-client.ts");
        const { fileId } = params;
        if (!fileId) return errorResponse(400, "fileId required");

        const { data: file, error } = await supabase
          .from("files")
          .select("storage_path, name")
          .eq("id", fileId)
          .eq("user_id", userId)
          .single();
        if (error || !file) return errorResponse(404, "File not found");

        const url = await getDownloadUrl(file.storage_path, file.name);
        return jsonResponse({ url, name: file.name });
      }

      case "get-preview-url": {
        const { getPreviewUrl } = await import("../_shared/r2-client.ts");
        const { fileId } = params;
        if (!fileId) return errorResponse(400, "fileId required");

        const { data: file, error } = await supabase
          .from("files")
          .select("storage_path, name, mime_type")
          .eq("id", fileId)
          .eq("user_id", userId)
          .single();
        if (error || !file) return errorResponse(404, "File not found");

        const url = await getPreviewUrl(file.storage_path);
        return jsonResponse({ url, name: file.name, mimeType: file.mime_type });
      }

      case "list": {
        const { folderId, workspaceId, trashed, favorites, search, limit: lim, offset } = params;

        // Full-text search across name, ocr_text, ai_summary, ai_tags
        if (search && search.trim()) {
          const searchTerm = search.trim();
          // Sanitize for ilike (escape %)
          const safeTerm = searchTerm.replace(/%/g, "\\%").replace(/_/g, "\\_");

          let q = supabase
            .from("files")
            .select("*")
            .eq("user_id", userId)
            .eq("is_trashed", trashed ? true : false)
            .or(`name.ilike.%${safeTerm}%,ocr_text.ilike.%${safeTerm}%,ai_summary.ilike.%${safeTerm}%`)
            .order("created_at", { ascending: false })
            .limit(lim || 100);

          if (workspaceId) q = q.eq("workspace_id", workspaceId);
          if (favorites) q = q.eq("is_favorite", true);

          const { data: searchData } = await q;
          const files = searchData || [];

          // Also check ai_tags
          const { data: tagFiles } = await supabase
            .from("files")
            .select("*")
            .eq("user_id", userId)
            .eq("is_trashed", trashed ? true : false)
            .contains("ai_tags", [searchTerm])
            .limit(20);

          if (tagFiles?.length) {
            const existingIds = new Set(files.map((f: any) => f.id));
            for (const tf of tagFiles) {
              if (!existingIds.has(tf.id)) files.push(tf);
            }
          }

          // Generate thumbnail URLs for image files
          const { getPreviewUrl } = await import("../_shared/r2-client.ts");
          const filesWithThumbs = await Promise.all(files.map(async (f: any) => {
            if (f.mime_type?.startsWith("image/")) {
              try { f.thumbnail_url = await getPreviewUrl(f.storage_path, 1800); } catch {}
            }
            return f;
          }));

          const { data: allFolders } = await supabase.from("file_folders").select("id, name, parent_id, icon, color").eq("user_id", userId).order("name");
          return jsonResponse({ files: filesWithThumbs, folders: [], allFolders: allFolders || [] });
        }

        // Standard listing (no search)
        let query = supabase
          .from("files")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(lim || 100);

        if (workspaceId) query = query.eq("workspace_id", workspaceId);
        if (folderId) query = query.eq("folder_id", folderId);
        else if (!trashed && !favorites) query = query.is("folder_id", null);

        if (trashed) query = query.eq("is_trashed", true);
        else query = query.eq("is_trashed", false);

        if (favorites) query = query.eq("is_favorite", true);
        if (offset) query = query.range(offset, offset + (lim || 100) - 1);

        const { data, error } = await query;
        if (error) return errorResponse(500, error.message);

        // Generate thumbnail URLs for image files
        const { getPreviewUrl } = await import("../_shared/r2-client.ts");
        const filesWithThumbs = await Promise.all((data || []).map(async (f: any) => {
          if (f.mime_type?.startsWith("image/")) {
            try {
              f.thumbnail_url = await getPreviewUrl(f.storage_path, 1800);
            } catch { /* ignore */ }
          }
          return f;
        }));

        // Also fetch folders
        let folderQuery = supabase
          .from("file_folders")
          .select("*")
          .eq("user_id", userId)
          .order("sort_order");

        if (workspaceId) folderQuery = folderQuery.eq("workspace_id", workspaceId);
        if (folderId) folderQuery = folderQuery.eq("parent_id", folderId);
        else if (!trashed && !favorites) folderQuery = folderQuery.is("parent_id", null);

        const { data: folders } = await folderQuery;

        // Fetch all folders for move-to dialog
        const { data: allFolders } = await supabase
          .from("file_folders")
          .select("id, name, parent_id, icon, color")
          .eq("user_id", userId)
          .order("name");

        return jsonResponse({ files: filesWithThumbs, folders: folders || [], allFolders: allFolders || [] });
      }

      case "create-folder": {
        const { name, parentId, workspaceId, color, icon } = params;
        if (!name) return errorResponse(400, "name required");

        const { data, error } = await supabase
          .from("file_folders")
          .insert({
            user_id: userId,
            workspace_id: workspaceId || null,
            parent_id: parentId || null,
            name,
            color: color || "#6366f1",
            icon: icon || "📁",
          })
          .select()
          .single();

        if (error) return errorResponse(500, error.message);
        return jsonResponse({ folder: data });
      }

      case "rename": {
        const { fileId, newName } = params;
        if (!fileId || !newName) return errorResponse(400, "fileId and newName required");

        const { error } = await supabase
          .from("files")
          .update({ name: newName })
          .eq("id", fileId)
          .eq("user_id", userId);

        if (error) return errorResponse(500, error.message);
        return jsonResponse({ success: true });
      }

      case "move": {
        const { fileIds, folderId: targetFolderId } = params;
        if (!fileIds?.length) return errorResponse(400, "fileIds required");

        const { error } = await supabase
          .from("files")
          .update({ folder_id: targetFolderId || null })
          .in("id", fileIds)
          .eq("user_id", userId);

        if (error) return errorResponse(500, error.message);
        return jsonResponse({ success: true });
      }

      case "trash": {
        const { fileIds } = params;
        if (!fileIds?.length) return errorResponse(400, "fileIds required");

        const { error } = await supabase
          .from("files")
          .update({ is_trashed: true, trashed_at: new Date().toISOString() })
          .in("id", fileIds)
          .eq("user_id", userId);

        if (error) return errorResponse(500, error.message);
        return jsonResponse({ success: true });
      }

      case "restore": {
        const { fileIds } = params;
        if (!fileIds?.length) return errorResponse(400, "fileIds required");

        const { error } = await supabase
          .from("files")
          .update({ is_trashed: false, trashed_at: null })
          .in("id", fileIds)
          .eq("user_id", userId);

        if (error) return errorResponse(500, error.message);
        return jsonResponse({ success: true });
      }

      case "permanent-delete": {
        const { deleteObject } = await import("../_shared/r2-client.ts");
        const { fileIds } = params;
        if (!fileIds?.length) return errorResponse(400, "fileIds required");

        const { data: files } = await supabase
          .from("files")
          .select("id, storage_path")
          .in("id", fileIds)
          .eq("user_id", userId);

        if (files) {
          for (const f of files) {
            try { await deleteObject(f.storage_path); } catch { /* R2 delete best effort */ }
          }
          await supabase.from("files").delete().in("id", files.map((f: any) => f.id));
        }

        return jsonResponse({ success: true });
      }

      case "toggle-favorite": {
        const { fileId, favorite } = params;
        if (!fileId) return errorResponse(400, "fileId required");

        const { error } = await supabase
          .from("files")
          .update({ is_favorite: favorite ?? true })
          .eq("id", fileId)
          .eq("user_id", userId);

        if (error) return errorResponse(500, error.message);
        return jsonResponse({ success: true });
      }

      case "list-links": {
        const { entityType, entityId } = params;
        if (!entityType || !entityId) return errorResponse(400, "entityType and entityId required");

        const { data: links, error: linkErr } = await supabase
          .from("file_links")
          .select("id, file_id")
          .eq("entity_type", entityType)
          .eq("entity_id", entityId)
          .eq("user_id", userId);

        if (linkErr) return errorResponse(500, linkErr.message);
        if (!links?.length) return jsonResponse({ links: [], files: [] });

        const fileIds = links.map((l: any) => l.file_id);
        const { data: files } = await supabase
          .from("files")
          .select("*")
          .in("id", fileIds)
          .eq("is_trashed", false);

        return jsonResponse({ links, files: files || [] });
      }

      case "link-file": {
        const { fileId, entityType, entityId } = params;
        if (!fileId || !entityType || !entityId) return errorResponse(400, "fileId, entityType, entityId required");

        const { data, error: linkErr } = await supabase
          .from("file_links")
          .insert({ file_id: fileId, entity_type: entityType, entity_id: entityId, user_id: userId })
          .select()
          .single();

        if (linkErr) return errorResponse(500, linkErr.message);
        return jsonResponse({ link: data });
      }

      case "unlink-file": {
        const { linkId } = params;
        if (!linkId) return errorResponse(400, "linkId required");

        const { error: unlinkErr } = await supabase
          .from("file_links")
          .delete()
          .eq("id", linkId)
          .eq("user_id", userId);

        if (unlinkErr) return errorResponse(500, unlinkErr.message);
        return jsonResponse({ success: true });
      }

      case "stats": {
        const { data, error } = await supabase.rpc("get_file_storage_stats", { _user_id: userId });
        if (error) return errorResponse(500, error.message);
        return jsonResponse({ stats: data });
      }

      case "create-share-link": {
        const { fileId, expiresInHours, password, maxDownloads } = params;
        if (!fileId) return errorResponse(400, "fileId required");

        const { data: owned } = await supabase.from("files").select("id").eq("id", fileId).eq("user_id", userId).single();
        if (!owned) return errorResponse(404, "File not found");

        let passwordHash = null;
        if (password) {
          const { hash: bcryptHash } = await import("https://deno.land/x/bcrypt@v0.4.1/mod.ts");
          passwordHash = await bcryptHash(password);
        }

        const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 3600000).toISOString() : null;

        const { data: link, error: linkErr } = await supabase
          .from("file_share_links")
          .insert({
            user_id: userId,
            file_id: fileId,
            password_hash: passwordHash,
            expires_at: expiresAt,
            max_downloads: maxDownloads || null,
          })
          .select()
          .single();

        if (linkErr) return errorResponse(500, linkErr.message);
        return jsonResponse({ link });
      }

      case "resolve-share": {
        const { token, password: pwd } = params;
        if (!token) return errorResponse(400, "token required");

        const { data: link } = await supabase
          .from("file_share_links")
          .select("*, files!inner(storage_path, name, mime_type, size_bytes)")
          .eq("token", token)
          .eq("is_active", true)
          .single();

        if (!link) return errorResponse(404, "Link não encontrado ou expirado");

        if (link.expires_at && new Date(link.expires_at) < new Date()) {
          return errorResponse(410, "Link expirado");
        }

        if (link.max_downloads && link.download_count >= link.max_downloads) {
          return errorResponse(410, "Limite de downloads atingido");
        }

        if (link.password_hash) {
          if (!pwd) return jsonResponse({ needsPassword: true, fileName: (link as any).files?.name });

          const storedHash = link.password_hash;
          let isValid = false;

          if (storedHash.length === 60 && storedHash.startsWith("$2")) {
            // Bcrypt hash
            const { compare: bcryptCompare } = await import("https://deno.land/x/bcrypt@v0.4.1/mod.ts");
            isValid = await bcryptCompare(pwd, storedHash);
          } else {
            // Legacy SHA-256 hash (64 hex chars)
            const encoder = new TextEncoder();
            const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(pwd));
            const pwdHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
            isValid = pwdHash === storedHash;
          }

          if (!isValid) return errorResponse(403, "Senha incorreta");
        }

        const { getDownloadUrl } = await import("../_shared/r2-client.ts");
        const file = (link as any).files;
        const url = await getDownloadUrl(file.storage_path, file.name);

        await supabase
          .from("file_share_links")
          .update({ download_count: link.download_count + 1 })
          .eq("id", link.id);

        return jsonResponse({ url, name: file.name, mimeType: file.mime_type, size: file.size_bytes });
      }

      case "list-share-links": {
        const { fileId } = params;
        const query = supabase
          .from("file_share_links")
          .select("*")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (fileId) query.eq("file_id", fileId);

        const { data, error: listErr } = await query;
        if (listErr) return errorResponse(500, listErr.message);
        return jsonResponse({ links: data || [] });
      }

      case "revoke-share-link": {
        const { linkId } = params;
        if (!linkId) return errorResponse(400, "linkId required");

        await supabase
          .from("file_share_links")
          .update({ is_active: false })
          .eq("id", linkId)
          .eq("user_id", userId);

        return jsonResponse({ success: true });
      }

      case "upload-version": {
        const { getUploadUrl } = await import("../_shared/r2-client.ts");
        const { parentFileId, fileName, contentType, sizeBytes } = params;
        if (!parentFileId || !fileName || !contentType) return errorResponse(400, "parentFileId, fileName, contentType required");

        const { data: parent } = await supabase
          .from("files")
          .select("id, version, folder_id, workspace_id")
          .eq("id", parentFileId)
          .eq("user_id", userId)
          .single();

        if (!parent) return errorResponse(404, "Parent file not found");

        const key = `${userId}/${crypto.randomUUID()}/${fileName}`;
        const url = await getUploadUrl(key, contentType);

        return jsonResponse({
          url,
          storagePath: key,
          parentFileId,
          nextVersion: (parent.version || 1) + 1,
          folderId: parent.folder_id,
          workspaceId: parent.workspace_id,
        });
      }

      case "confirm-version": {
        const { storagePath, parentFileId, fileName, contentType, sizeBytes, contentHash, nextVersion } = params;
        if (!storagePath || !parentFileId || !fileName) return errorResponse(400, "Missing required fields");

        const { data: file, error: vErr } = await supabase
          .from("files")
          .insert({
            user_id: userId,
            workspace_id: params.workspaceId || null,
            folder_id: params.folderId || null,
            name: fileName,
            original_name: fileName,
            mime_type: contentType,
            size_bytes: sizeBytes || 0,
            storage_path: storagePath,
            source: "version",
            content_hash: contentHash || null,
            parent_file_id: parentFileId,
            version: nextVersion || 2,
          })
          .select()
          .single();

        if (vErr) return errorResponse(500, vErr.message);
        return jsonResponse({ file });
      }

      case "list-versions": {
        const { fileId } = params;
        if (!fileId) return errorResponse(400, "fileId required");

        const { data: target } = await supabase
          .from("files")
          .select("id, parent_file_id")
          .eq("id", fileId)
          .eq("user_id", userId)
          .single();

        if (!target) return errorResponse(404, "File not found");

        const rootId = target.parent_file_id || target.id;

        const { data: versions } = await supabase
          .from("files")
          .select("id, name, version, size_bytes, created_at, storage_path")
          .or(`id.eq.${rootId},parent_file_id.eq.${rootId}`)
          .eq("user_id", userId)
          .order("version", { ascending: false });

        return jsonResponse({ versions: versions || [] });
      }

      case "list-inbox": {
        const { data, error: inboxErr } = await supabase
          .from("file_inbox")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(50);

        if (inboxErr) return errorResponse(500, inboxErr.message);
        return jsonResponse({ items: data || [] });
      }

      case "import-inbox-item": {
        const { itemId, folderId: inboxFolderId, workspaceId: inboxWsId } = params;
        if (!itemId) return errorResponse(400, "itemId required");

        const { data: item, error: itemErr } = await supabase
          .from("file_inbox")
          .select("*")
          .eq("id", itemId)
          .eq("user_id", userId)
          .eq("status", "pending")
          .single();

        if (itemErr || !item) return errorResponse(404, "Inbox item not found");

        // If r2_temp_key exists, copy to permanent path; otherwise download from file_url
        let storagePath: string;
        const permanentKey = `${userId}/${crypto.randomUUID()}/${item.file_name}`;

        if (item.r2_temp_key) {
          // Copy within R2
          const { S3Client, CopyObjectCommand } = await import("npm:@aws-sdk/client-s3@3.600.0");
          const accountId = Deno.env.get("R2_ACCOUNT_ID");
          const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
          const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
          const bucket = Deno.env.get("R2_BUCKET_NAME");
          if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return errorResponse(500, "R2 not configured");
          
          const client = new S3Client({
            region: "auto",
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId, secretAccessKey },
          });
          await client.send(new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${item.r2_temp_key}`,
            Key: permanentKey,
          }));
          storagePath = permanentKey;
        } else if (item.file_url) {
          // Download from URL and upload to R2
          const res = await fetch(item.file_url);
          if (!res.ok) return errorResponse(500, "Failed to download from source");
          const body = await res.arrayBuffer();

          const { S3Client, PutObjectCommand } = await import("npm:@aws-sdk/client-s3@3.600.0");
          const accountId = Deno.env.get("R2_ACCOUNT_ID");
          const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
          const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
          const bucket = Deno.env.get("R2_BUCKET_NAME");
          if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return errorResponse(500, "R2 not configured");

          const client = new S3Client({
            region: "auto",
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId, secretAccessKey },
          });
          await client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: permanentKey,
            Body: new Uint8Array(body),
            ContentType: item.mime_type || "application/octet-stream",
          }));
          storagePath = permanentKey;
        } else {
          return errorResponse(400, "No source for import");
        }

        // Create file record
        const { data: file, error: fileErr } = await supabase
          .from("files")
          .insert({
            user_id: userId,
            workspace_id: inboxWsId || null,
            folder_id: inboxFolderId || null,
            name: item.file_name,
            original_name: item.file_name,
            mime_type: item.mime_type || "application/octet-stream",
            size_bytes: item.size_bytes || 0,
            storage_path: storagePath,
            source: "inbox",
          })
          .select()
          .single();

        if (fileErr) return errorResponse(500, fileErr.message);

        // Update inbox item
        await supabase
          .from("file_inbox")
          .update({ status: "imported", imported_file_id: file.id, updated_at: new Date().toISOString() })
          .eq("id", itemId);

        return jsonResponse({ file });
      }

      case "ignore-inbox-item": {
        const { itemId: ignoreId } = params;
        if (!ignoreId) return errorResponse(400, "itemId required");

        const { data: item } = await supabase
          .from("file_inbox")
          .select("r2_temp_key")
          .eq("id", ignoreId)
          .eq("user_id", userId)
          .single();

        // Delete temp file from R2 if exists
        if (item?.r2_temp_key) {
          try {
            const { deleteObject } = await import("../_shared/r2-client.ts");
            await deleteObject(item.r2_temp_key);
          } catch { /* best effort */ }
        }

        await supabase
          .from("file_inbox")
          .update({ status: "dismissed", updated_at: new Date().toISOString() })
          .eq("id", ignoreId)
          .eq("user_id", userId);

        return jsonResponse({ success: true });
      }

      case "rename-folder": {
        const { folderId: rFolderId, newName } = params;
        if (!rFolderId || !newName) return errorResponse(400, "folderId and newName required");

        const { error: rfErr } = await supabase
          .from("file_folders")
          .update({ name: newName, updated_at: new Date().toISOString() })
          .eq("id", rFolderId)
          .eq("user_id", userId);

        if (rfErr) return errorResponse(500, rfErr.message);
        return jsonResponse({ success: true });
      }

      case "delete-folder": {
        const { folderId: dFolderId } = params;
        if (!dFolderId) return errorResponse(400, "folderId required");

        // Move files in this folder to root
        await supabase
          .from("files")
          .update({ folder_id: null })
          .eq("folder_id", dFolderId)
          .eq("user_id", userId);

        // Move child folders to root
        await supabase
          .from("file_folders")
          .update({ parent_id: null })
          .eq("parent_id", dFolderId)
          .eq("user_id", userId);

        // Delete the folder
        const { error: dfErr } = await supabase
          .from("file_folders")
          .delete()
          .eq("id", dFolderId)
          .eq("user_id", userId);

        if (dfErr) return errorResponse(500, dfErr.message);
        return jsonResponse({ success: true });
      }

      case "empty-trash": {
        const { deleteObject } = await import("../_shared/r2-client.ts");

        const { data: trashedFiles } = await supabase
          .from("files")
          .select("id, storage_path")
          .eq("user_id", userId)
          .eq("is_trashed", true);

        if (trashedFiles?.length) {
          // Delete from R2 (best effort, batched)
          await Promise.allSettled(
            trashedFiles.map((f: any) => deleteObject(f.storage_path).catch(() => {}))
          );

          // Delete from DB
          await supabase
            .from("files")
            .delete()
            .in("id", trashedFiles.map((f: any) => f.id));
        }

        return jsonResponse({ success: true, deleted: trashedFiles?.length || 0 });
      }

      case "dismiss-suggested-link": {
        const { fileId: dslFileId, linkIndex } = params;
        if (!dslFileId) return errorResponse(400, "fileId required");

        const { data: dslFile } = await supabase
          .from("files")
          .select("ai_suggested_links")
          .eq("id", dslFileId)
          .eq("user_id", userId)
          .single();

        if (!dslFile?.ai_suggested_links) return jsonResponse({ success: true });

        const links = dslFile.ai_suggested_links as any[];
        if (typeof linkIndex === "number" && linkIndex < links.length) {
          links.splice(linkIndex, 1);
          await supabase
            .from("files")
            .update({ ai_suggested_links: links })
            .eq("id", dslFileId)
            .eq("user_id", userId);
        }

        return jsonResponse({ success: true });
      }

      default:
        return errorResponse(400, `Unknown action: ${action}`);
    }
  } catch (e: any) {
    console.error("files-storage error:", e);
    return errorResponse(500, e.message || "Internal error");
  }
});
