import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  type ApiEmail,
  listEmails,
  searchEmails,
} from "../emails.js";
import { entityIdFor, executeAction, isComposioConfigured } from "../composio.js";
import { getDb } from "../../db/client.js";
import { emailSendLog } from "@desh/database/schema";
import { ServiceError } from "../errors.js";
import type { McpAuthContext } from "./auth.js";
import { toolError, toolText } from "./tool-result.js";

// First-party email tools. The Hermes profile already has Composio's Gmail
// toolkit, but those tools talk to Gmail directly. The Desh-MCP versions
// instead reach the **cache** (faster, cheaper, scoped to workspace) for
// reads. `send_email` is unique in that there's no cache — it falls through
// to Composio's GMAIL_SEND_EMAIL but logs the result to `email_send_log` so
// every agent-initiated send is auditable.

function slimEmail(e: ApiEmail) {
  return {
    id: e.id,
    gmailId: e.gmailId,
    fromEmail: e.fromEmail,
    fromName: e.fromName,
    subject: e.subject,
    snippet: e.snippet,
    date: e.date,
    isUnread: e.isUnread,
    folder: e.folder,
  };
}

export function registerEmailTools(server: McpServer, ctx: McpAuthContext): void {
  server.registerTool(
    "list_emails",
    {
      title: "List recent emails",
      description:
        "Lista os e-mails do cache do workspace ativo. Filtra por pasta (`folder`: inbox/sent/drafts/trash/spam/archive) ou etiqueta (`label`: ID Gmail da label). Ordenado pelo mais recente.",
      inputSchema: {
        folder: z.string().min(1).max(40).optional(),
        label: z.string().min(1).max(120).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async (args) => {
      try {
        const { items } = await listEmails(ctx.workspaceId, ctx.ownerUserId, {
          folder: args.folder,
          label: args.label,
          limit: args.limit ?? 25,
        });
        return toolText(items.map(slimEmail));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "search_emails",
    {
      title: "Search emails",
      description:
        "Busca textual no cache de e-mails (assunto, remetente, snippet). Retorna até `limit` resultados (padrão 20).",
      inputSchema: {
        query: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async (args) => {
      try {
        const rows = await searchEmails(
          ctx.workspaceId,
          ctx.ownerUserId,
          args.query,
          args.limit ?? 20,
        );
        return toolText(rows.map(slimEmail));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "send_email",
    {
      title: "Send email",
      description:
        "Envia um e-mail via Gmail (Composio) em nome do dono do workspace. `body` aceita texto puro; o agente é responsável por formatar conteúdo. Cada envio fica registrado em `email_send_log` com `email_type=agent_send`.",
      inputSchema: {
        to: z.string().email(),
        subject: z.string().min(1).max(500),
        body: z.string().min(1).max(50000),
        cc: z.array(z.string().email()).max(20).optional(),
        bcc: z.array(z.string().email()).max(20).optional(),
      },
    },
    async (args) => {
      try {
        if (!isComposioConfigured()) {
          throw new ServiceError(503, "composio_unconfigured");
        }
        const db = getDb();
        if (!db) throw new ServiceError(500, "db_unavailable");

        const entity = entityIdFor(ctx.workspaceId, ctx.ownerUserId);
        const composioArgs: Record<string, unknown> = {
          recipient_email: args.to,
          subject: args.subject,
          body: args.body,
        };
        if (args.cc?.length) composioArgs.cc = args.cc;
        if (args.bcc?.length) composioArgs.bcc = args.bcc;

        let status: "sent" | "failed" = "sent";
        let errorMessage: string | undefined;
        try {
          await executeAction(entity, "GMAIL_SEND_EMAIL", composioArgs);
        } catch (err) {
          status = "failed";
          errorMessage = err instanceof Error ? err.message : String(err);
        }

        await db.insert(emailSendLog).values({
          workspaceId: ctx.workspaceId,
          userId: ctx.ownerUserId,
          emailType: "agent_send",
          recipientEmail: args.to,
          subject: args.subject,
          status,
          errorMessage: errorMessage ?? null,
        });

        if (status === "failed") {
          return toolError(new ServiceError(502, errorMessage ?? "send_failed"));
        }
        return toolText({ ok: true, to: args.to, subject: args.subject });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
