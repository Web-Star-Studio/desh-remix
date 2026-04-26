import type { FastifyInstance, FastifyReply } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { files, profileDocuments } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { requireUserDbId } from "../services/users.js";
import { isServiceError, ServiceError } from "../services/errors.js";
import { assertWorkspaceMember } from "../services/workspace-members.js";
import { deleteObject, isStorageConfigured } from "../services/storage.js";

// Profile-specific identity documents (RG, CPF, passport, CNH, etc.). The
// binary lives in S3 via `files`; this table is the metadata layer.
//
// Workspace-scoped for consistency. Profile documents are functionally
// per-user, but they live inside whichever workspace the user is in (the
// owner is the user). The previous Supabase model was user-scoped only;
// migrating to workspace-scoping makes them inherit the workspace's S3
// prefix and lifecycle.

const DocTypeEnum = z.enum(["rg", "cpf", "passport", "cnh", "proof_of_address", "other"]);

const WorkspaceParams = z.object({ workspaceId: z.string().uuid() });
const DocParams = z.object({
  workspaceId: z.string().uuid(),
  id: z.string().uuid(),
});

const CreateBody = z.object({
  fileId: z.string().uuid(),
  docType: DocTypeEnum.default("other"),
  label: z.string().max(200).default(""),
});

interface ApiProfileDocument {
  id: string;
  workspaceId: string;
  userId: string;
  fileId: string;
  docType: string;
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

function handleServiceError(reply: FastifyReply, err: unknown): boolean {
  if (isServiceError(err)) {
    reply.code(err.httpStatus).send({ error: err.errorCode });
    return true;
  }
  return false;
}

export default async function profileDocumentsRoutes(app: FastifyInstance) {
  // List the caller's profile documents in this workspace. Joins on `files`
  // so the response carries enough metadata to render without a second round
  // trip per row.
  app.get("/workspaces/:workspaceId/profile-documents", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      await assertWorkspaceMember(params.data.workspaceId, dbId);
      const db = getDb();
      if (!db) return reply.code(500).send({ error: "db_unavailable" });

      const rows = await db
        .select({
          id: profileDocuments.id,
          workspaceId: profileDocuments.workspaceId,
          userId: profileDocuments.userId,
          fileId: profileDocuments.fileId,
          docType: profileDocuments.docType,
          label: profileDocuments.label,
          createdAt: profileDocuments.createdAt,
          fileName: files.name,
          mimeType: files.mimeType,
          sizeBytes: files.sizeBytes,
        })
        .from(profileDocuments)
        .innerJoin(files, eq(files.id, profileDocuments.fileId))
        .where(
          and(
            eq(profileDocuments.workspaceId, params.data.workspaceId),
            eq(profileDocuments.userId, dbId),
          ),
        )
        .orderBy(desc(profileDocuments.createdAt));

      const out: ApiProfileDocument[] = rows.map((r) => ({
        id: r.id,
        workspaceId: r.workspaceId,
        userId: r.userId,
        fileId: r.fileId,
        docType: r.docType,
        label: r.label,
        fileName: r.fileName,
        mimeType: r.mimeType,
        sizeBytes: r.sizeBytes,
        createdAt: r.createdAt.toISOString(),
      }));
      return out;
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  // Create a profile document referencing a file already uploaded via the
  // /workspaces/:id/files/upload-url + /confirm flow. We re-validate here
  // that the file belongs to this workspace — defends against handing a
  // foreign file_id and tagging it as a profile document.
  app.post("/workspaces/:workspaceId/profile-documents", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = CreateBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      await assertWorkspaceMember(params.data.workspaceId, dbId);
      const db = getDb();
      if (!db) return reply.code(500).send({ error: "db_unavailable" });

      const [file] = await db
        .select({
          id: files.id,
          name: files.name,
          mimeType: files.mimeType,
          sizeBytes: files.sizeBytes,
        })
        .from(files)
        .where(and(eq(files.id, body.data.fileId), eq(files.workspaceId, params.data.workspaceId)))
        .limit(1);
      if (!file) throw new ServiceError(404, "file_not_found");

      const [created] = await db
        .insert(profileDocuments)
        .values({
          workspaceId: params.data.workspaceId,
          userId: dbId,
          fileId: file.id,
          docType: body.data.docType,
          label: body.data.label,
        })
        .returning();
      if (!created) return reply.code(500).send({ error: "insert_failed" });

      const out: ApiProfileDocument = {
        id: created.id,
        workspaceId: created.workspaceId,
        userId: created.userId,
        fileId: created.fileId,
        docType: created.docType,
        label: created.label,
        fileName: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        createdAt: created.createdAt.toISOString(),
      };
      return reply.code(201).send(out);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  // Delete a profile document. Cascades the underlying S3 object + files row
  // since the document is the only consumer of that file. (Profile docs are
  // 1:1 with their file by design — multi-document-per-file would require
  // the deletion to skip the cascade.)
  app.delete("/workspaces/:workspaceId/profile-documents/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = DocParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      await assertWorkspaceMember(params.data.workspaceId, dbId);
      const db = getDb();
      if (!db) return reply.code(500).send({ error: "db_unavailable" });

      const [doc] = await db
        .select({
          id: profileDocuments.id,
          fileId: profileDocuments.fileId,
          storageKey: files.storageKey,
        })
        .from(profileDocuments)
        .innerJoin(files, eq(files.id, profileDocuments.fileId))
        .where(
          and(
            eq(profileDocuments.id, params.data.id),
            eq(profileDocuments.workspaceId, params.data.workspaceId),
            eq(profileDocuments.userId, dbId),
          ),
        )
        .limit(1);
      if (!doc) throw new ServiceError(404, "profile_document_not_found");

      // Best-effort S3 delete; if it fails, leave the row + S3 object so an
      // operator can retry rather than losing track. Same posture as the
      // /files DELETE route.
      if (isStorageConfigured()) {
        try {
          await deleteObject(doc.storageKey);
        } catch (err) {
          req.log.warn({ err, storageKey: doc.storageKey }, "[profile-documents] S3 delete failed");
          return reply.code(502).send({ error: "storage_delete_failed" });
        }
      }
      // Files row goes too — files.id has ON DELETE CASCADE on
      // profile_documents, but we want the inverse here (delete the file
      // when the doc is deleted). Do it explicitly.
      await db.delete(profileDocuments).where(eq(profileDocuments.id, doc.id));
      await db.delete(files).where(eq(files.id, doc.fileId));
      return reply.code(204).send();
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });
}
