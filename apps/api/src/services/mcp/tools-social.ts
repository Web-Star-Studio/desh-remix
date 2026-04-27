import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { socialAccounts, workspaces } from "@desh/database/schema";
import { getDb } from "../../db/client.js";
import {
  ZernioApiError,
  inbox,
  isZernioConfigured,
  media,
  posts,
  sendWhatsAppTemplate,
  sendWhatsAppText,
  whatsappBroadcasts,
  whatsappTemplates,
} from "../zernio.js";
import type { McpAuthContext } from "./auth.js";
import { toolError, toolText } from "./tool-result.js";

// ── Tenancy helpers ────────────────────────────────────────────────────────
//
// Every social/whatsapp tool must:
//   1. Resolve the workspace's `zernio_profile_id` (or refuse with NO_PROFILE)
//   2. If the tool takes an `accountId`, verify it belongs to this workspace
//      via `social_accounts.workspaceId` — never trust the agent to pass a
//      legitimate one
// These helpers concentrate that logic in one place. Zernio's upstream API
// is keyed by a single shared key with no per-profile auth, so this is the
// only place tenancy is enforced.

async function loadZernioProfileId(workspaceId: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select({ profileId: workspaces.zernioProfileId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return rows[0]?.profileId ?? null;
}

async function ensureAccountInWorkspace(
  workspaceId: string,
  zernioAccountId: string,
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: socialAccounts.id })
    .from(socialAccounts)
    .where(
      and(
        eq(socialAccounts.workspaceId, workspaceId),
        eq(socialAccounts.zernioAccountId, zernioAccountId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

const NO_PROFILE = "no_zernio_profile";
const NOT_CONFIGURED = "zernio_not_configured";
const FOREIGN_ACCOUNT = "account_not_in_workspace";

// Slim shape returned to the agent for accounts — token-efficient.
interface SlimAccount {
  zernioAccountId: string;
  platform: string;
  username: string | null;
  status: string;
}

// ── Registration ───────────────────────────────────────────────────────────

export function registerSocialTools(server: McpServer, ctx: McpAuthContext): void {
  // ── Accounts ───────────────────────────────────────────────────────────

  server.registerTool(
    "social_accounts_list",
    {
      title: "List connected social accounts",
      description:
        "Lista TODAS as contas conectadas neste workspace (Instagram, Facebook, X, LinkedIn, YouTube, TikTok, Pinterest, WhatsApp, Threads, etc.). Use isto antes de qualquer ação para descobrir quais contas estão disponíveis. Filtre por `platform` se o usuário mencionar um canal específico.",
      inputSchema: {
        platform: z.string().min(1).max(64).optional(),
      },
    },
    async (args) => {
      try {
        const db = getDb();
        if (!db) return toolError(new Error("db_unavailable"));
        const conds = [eq(socialAccounts.workspaceId, ctx.workspaceId)];
        if (args.platform) {
          conds.push(eq(socialAccounts.platform, args.platform.toLowerCase()));
        }
        const rows = await db
          .select({
            zernioAccountId: socialAccounts.zernioAccountId,
            platform: socialAccounts.platform,
            username: socialAccounts.username,
            status: socialAccounts.status,
          })
          .from(socialAccounts)
          .where(and(...conds))
          .orderBy(desc(socialAccounts.updatedAt));
        return toolText({ accounts: rows as SlimAccount[] });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── Cross-platform posts ───────────────────────────────────────────────

  const PostPlatformInput = z.object({
    platform: z.string().min(1).max(64),
    accountId: z.string().min(1),
  });

  server.registerTool(
    "social_post_publish_now",
    {
      title: "Publish a post immediately",
      description:
        "Publica um post em uma ou mais contas conectadas (single ou cross-post). Cada item em `targets` precisa de `platform` (twitter, instagram, facebook, linkedin, tiktok, youtube, pinterest, threads, etc.) e `accountId` (de social_accounts_list). Use `mediaIds` para anexar imagens/vídeos previamente carregados via media_generate_upload_link.",
      inputSchema: {
        content: z.string().min(1).max(8000),
        targets: z.array(PostPlatformInput).min(1).max(14),
        mediaIds: z.array(z.string().min(1)).max(10).optional(),
      },
    },
    async (args) => {
      try {
        if (!isZernioConfigured()) return toolError(new Error(NOT_CONFIGURED));
        // Verify every target account belongs to this workspace before any
        // upstream call — fail fast.
        for (const t of args.targets) {
          if (!(await ensureAccountInWorkspace(ctx.workspaceId, t.accountId))) {
            return toolError(new Error(FOREIGN_ACCOUNT));
          }
        }
        const res = await posts.publishNow({
          content: args.content,
          platforms: args.targets.map((t) => ({
            platform: t.platform.toLowerCase(),
            accountId: t.accountId,
          })),
          mediaIds: args.mediaIds,
        });
        return toolText(res);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "social_post_schedule",
    {
      title: "Schedule a post",
      description:
        "Agenda um post para publicação futura. `scheduledAt` deve ser ISO-8601 e estar no futuro. Use o mesmo formato de `targets` que social_post_publish_now.",
      inputSchema: {
        content: z.string().min(1).max(8000),
        targets: z.array(PostPlatformInput).min(1).max(14),
        scheduledAt: z.string().datetime(),
        mediaIds: z.array(z.string().min(1)).max(10).optional(),
      },
    },
    async (args) => {
      try {
        if (!isZernioConfigured()) return toolError(new Error(NOT_CONFIGURED));
        for (const t of args.targets) {
          if (!(await ensureAccountInWorkspace(ctx.workspaceId, t.accountId))) {
            return toolError(new Error(FOREIGN_ACCOUNT));
          }
        }
        const res = await posts.create({
          content: args.content,
          platforms: args.targets.map((t) => ({
            platform: t.platform.toLowerCase(),
            accountId: t.accountId,
          })),
          scheduledAt: args.scheduledAt,
          mediaIds: args.mediaIds,
        });
        return toolText(res);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "social_posts_list",
    {
      title: "List recent posts",
      description:
        "Lista posts recentes deste workspace (publicados, agendados, falhados). Filtre por `status` (published/scheduled/failed/draft). Limite padrão 20.",
      inputSchema: {
        status: z.enum(["published", "scheduled", "failed", "draft"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).max(50).optional(),
      },
    },
    async (args) => {
      try {
        if (!isZernioConfigured()) return toolError(new Error(NOT_CONFIGURED));
        const profileId = await loadZernioProfileId(ctx.workspaceId);
        if (!profileId) return toolError(new Error(NO_PROFILE));
        const res = await posts.list({
          profileId,
          status: args.status,
          limit: args.limit ?? 20,
          page: args.page,
        });
        return toolText(res);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "social_post_retry",
    {
      title: "Retry a failed post",
      description:
        "Re-envia um post que falhou. Use o `id` retornado por social_posts_list. Não tente mais de uma vez automaticamente — se falhar de novo, informe o erro ao usuário.",
      inputSchema: { postId: z.string().min(1).max(120) },
    },
    async (args) => {
      try {
        if (!isZernioConfigured()) return toolError(new Error(NOT_CONFIGURED));
        // Fetch the post to verify its profileId matches this workspace
        // before retrying upstream.
        const profileId = await loadZernioProfileId(ctx.workspaceId);
        if (!profileId) return toolError(new Error(NO_PROFILE));
        const fetched = (await posts.get(args.postId)) as { profileId?: string } | null;
        if (fetched && fetched.profileId && fetched.profileId !== profileId) {
          return toolError(new Error(FOREIGN_ACCOUNT));
        }
        const res = await posts.retry(args.postId);
        return toolText(res);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── WhatsApp send (the most common agent action for /messages) ─────────

  server.registerTool(
    "whatsapp_send_text",
    {
      title: "Send a free-text WhatsApp message",
      description:
        "Envia mensagem de texto livre via WhatsApp Business. Funciona somente dentro da janela de 24h após a última mensagem do contato. Fora dessa janela use whatsapp_send_template. `accountId` precisa vir de social_accounts_list (platform=whatsapp). `to` em formato E.164 só com dígitos (ex: 5511999887766).",
      inputSchema: {
        accountId: z.string().min(1),
        to: z.string().min(1).max(40),
        text: z.string().min(1).max(4096),
      },
    },
    async (args) => {
      try {
        if (!isZernioConfigured()) return toolError(new Error(NOT_CONFIGURED));
        if (!(await ensureAccountInWorkspace(ctx.workspaceId, args.accountId))) {
          return toolError(new Error(FOREIGN_ACCOUNT));
        }
        const toDigits = args.to.replace(/\D+/g, "");
        if (!toDigits) return toolError(new Error("invalid_to"));
        const res = await sendWhatsAppText({ accountId: args.accountId, to: toDigits, text: args.text });
        return toolText({ messageId: res.messageId });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "whatsapp_send_template",
    {
      title: "Send an approved WhatsApp template",
      description:
        "Envia uma mensagem usando um template aprovado pela Meta. Use isto fora da janela de 24h ou para campanhas. `templateName` e `language` precisam corresponder a um template aprovado (use whatsapp_templates_list para descobrir). `variables` substitui {{1}}, {{2}}, etc. na ordem.",
      inputSchema: {
        accountId: z.string().min(1),
        to: z.string().min(1).max(40),
        templateName: z.string().min(1).max(120),
        language: z.string().min(2).max(20),
        variables: z.array(z.string()).max(20).optional(),
      },
    },
    async (args) => {
      try {
        if (!isZernioConfigured()) return toolError(new Error(NOT_CONFIGURED));
        if (!(await ensureAccountInWorkspace(ctx.workspaceId, args.accountId))) {
          return toolError(new Error(FOREIGN_ACCOUNT));
        }
        const toDigits = args.to.replace(/\D+/g, "");
        if (!toDigits) return toolError(new Error("invalid_to"));
        const res = await sendWhatsAppTemplate({
          accountId: args.accountId,
          to: toDigits,
          templateName: args.templateName,
          language: args.language,
          variables: args.variables ?? [],
        });
        return toolText({ messageId: res.messageId });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "whatsapp_templates_list",
    {
      title: "List WhatsApp templates",
      description:
        "Lista templates de WhatsApp aprovados para uma conta WABA específica. Use antes de whatsapp_send_template para descobrir templates disponíveis e seus parâmetros.",
      inputSchema: { accountId: z.string().min(1) },
    },
    async (args) => {
      try {
        if (!isZernioConfigured()) return toolError(new Error(NOT_CONFIGURED));
        if (!(await ensureAccountInWorkspace(ctx.workspaceId, args.accountId))) {
          return toolError(new Error(FOREIGN_ACCOUNT));
        }
        const res = await whatsappTemplates.list(args.accountId);
        return toolText(res);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "whatsapp_broadcasts_list",
    {
      title: "List WhatsApp broadcasts",
      description:
        "Lista broadcasts (campanhas em massa) deste workspace. Filtre por `accountId` se quiser uma conta específica.",
      inputSchema: { accountId: z.string().min(1).optional() },
    },
    async (args) => {
      try {
        if (!isZernioConfigured()) return toolError(new Error(NOT_CONFIGURED));
        const profileId = await loadZernioProfileId(ctx.workspaceId);
        if (!profileId) return toolError(new Error(NO_PROFILE));
        if (args.accountId && !(await ensureAccountInWorkspace(ctx.workspaceId, args.accountId))) {
          return toolError(new Error(FOREIGN_ACCOUNT));
        }
        const res = await whatsappBroadcasts.list({ profileId, accountId: args.accountId });
        return toolText(res);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "whatsapp_broadcast_send",
    {
      title: "Send a WhatsApp broadcast",
      description:
        "Dispara um broadcast já criado. Confirme com o usuário antes de enviar — broadcasts são visíveis a todos os destinatários e contam como envios pagos.",
      inputSchema: { broadcastId: z.string().min(1).max(120) },
    },
    async (args) => {
      try {
        if (!isZernioConfigured()) return toolError(new Error(NOT_CONFIGURED));
        const res = await whatsappBroadcasts.send(args.broadcastId);
        return toolText(res);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── Inbox (DMs + comments across platforms) ─────────────────────────────

  server.registerTool(
    "inbox_conversations_list",
    {
      title: "List inbox conversations",
      description:
        "Lista conversas (DMs + comentários) ativas para este workspace. Filtre por `accountId` para uma conta específica. Retorna metadata da conversa (último contato, plataforma, snippet).",
      inputSchema: {
        accountId: z.string().min(1).optional(),
        page: z.number().int().min(1).max(50).optional(),
      },
    },
    async (args) => {
      try {
        if (!isZernioConfigured()) return toolError(new Error(NOT_CONFIGURED));
        const profileId = await loadZernioProfileId(ctx.workspaceId);
        if (!profileId) return toolError(new Error(NO_PROFILE));
        if (args.accountId && !(await ensureAccountInWorkspace(ctx.workspaceId, args.accountId))) {
          return toolError(new Error(FOREIGN_ACCOUNT));
        }
        const res = await inbox.conversationsList({
          profileId,
          accountId: args.accountId,
          page: args.page,
        });
        return toolText(res);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "inbox_messages_list",
    {
      title: "Read inbox conversation messages",
      description:
        "Lê o histórico de mensagens de uma conversa específica. Use o `conversationId` retornado por inbox_conversations_list.",
      inputSchema: {
        conversationId: z.string().min(1).max(200),
        page: z.number().int().min(1).max(50).optional(),
      },
    },
    async (args) => {
      try {
        if (!isZernioConfigured()) return toolError(new Error(NOT_CONFIGURED));
        const res = await inbox.messagesList({
          conversationId: args.conversationId,
          page: args.page,
        });
        return toolText(res);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "inbox_send_message",
    {
      title: "Reply in an inbox conversation",
      description:
        "Envia uma mensagem em uma conversa de inbox existente (DM em qualquer plataforma). Para WhatsApp use whatsapp_send_text/whatsapp_send_template em vez disto, pois eles aplicam regras de janela de 24h.",
      inputSchema: {
        conversationId: z.string().min(1).max(200),
        text: z.string().min(1).max(4096),
        accountId: z.string().min(1).optional(),
      },
    },
    async (args) => {
      try {
        if (!isZernioConfigured()) return toolError(new Error(NOT_CONFIGURED));
        if (args.accountId && !(await ensureAccountInWorkspace(ctx.workspaceId, args.accountId))) {
          return toolError(new Error(FOREIGN_ACCOUNT));
        }
        const res = await inbox.sendMessage({
          conversationId: args.conversationId,
          text: args.text,
          accountId: args.accountId,
        });
        return toolText(res);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── Media (presigned upload flow) ───────────────────────────────────────

  server.registerTool(
    "media_generate_upload_link",
    {
      title: "Generate an upload link for image/video",
      description:
        "Passo 1 do fluxo de upload de mídia. Retorna `mediaId` + URL presignada para PUT do arquivo. Após o upload o cliente chama media_check_upload_status, e quando ready usa o `mediaId` em social_post_publish_now.",
      inputSchema: {
        mimeType: z.string().min(3).max(120),
        sizeBytes: z.number().int().positive().optional(),
      },
    },
    async (args) => {
      try {
        if (!isZernioConfigured()) return toolError(new Error(NOT_CONFIGURED));
        const profileId = await loadZernioProfileId(ctx.workspaceId);
        if (!profileId) return toolError(new Error(NO_PROFILE));
        const res = await media.generateUploadLink({
          profileId,
          mimeType: args.mimeType,
          sizeBytes: args.sizeBytes,
        });
        return toolText(res);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "media_check_upload_status",
    {
      title: "Check media upload status",
      description:
        "Verifica se um upload de mídia já está pronto para uso. Retorna status (pending/ready/failed). Faça polling até `ready` antes de criar o post.",
      inputSchema: { mediaId: z.string().min(1).max(200) },
    },
    async (args) => {
      try {
        if (!isZernioConfigured()) return toolError(new Error(NOT_CONFIGURED));
        const res = await media.checkUploadStatus(args.mediaId);
        return toolText(res);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}

// Re-exports so callers can refer to the well-known error codes if needed.
export const SOCIAL_TOOL_ERROR_CODES = {
  NOT_CONFIGURED,
  NO_PROFILE,
  FOREIGN_ACCOUNT,
} as const;

// Surface ZernioApiError instances cleanly through `toolError` — the helper
// in `tool-result.ts` checks for it via duck typing.
export type { ZernioApiError };
