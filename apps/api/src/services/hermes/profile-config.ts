import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { composeSoulMd } from "../pandora-prompt.js";

export interface ProfileRenderInput {
  hermesProfileName: string;     // e.g. "ws_<uuid_no_dashes>"
  workspaceId: string;
  workspaceName: string;
  hermesPort: number;
  adapterSecret: string;
  callbackSecret: string;
  modelId: string;               // e.g. "moonshotai/kimi-k2.6"
  /**
   * Optional user-supplied extension (from `agent_profiles.system_prompt`).
   * The Pandora identity is always written; this is appended as additional
   * workspace context with priority rules in favor of Pandora.
   */
  systemPrompt: string | null;
  /**
   * Per-entity Composio MCP URL minted via the Composio API. When set, we
   * emit a `mcp_servers.composio` block so Hermes loads the toolkit on boot.
   * Composio scopes connections by `entityId = workspaceId_userDbId` at the
   * auth layer, so per-workspace tenancy is enforced upstream.
   *
   * Composio's role is the **productivity stack only** — Gmail, Calendar,
   * Drive, Tasks, Contacts. Social platforms and messaging do NOT route
   * through Composio; they go through the Desh MCP `social_*`/`whatsapp_*`/
   * `inbox_*` tools, which call Zernio server-side with `profileId` injected
   * from `workspaces.zernio_profile_id`.
   */
  composioMcpUrl: string | null;
}

export interface ProfileRenderOutput {
  hermesHome: string;            // absolute path to the per-profile dir
  envFilePath: string;
  configFilePath: string;
  soulFilePath: string;          // always written (Pandora is mandatory)
}

const CONFIG_YAML = (
  modelId: string,
  composioMcpUrl: string | null,
  deshMcpUrl: string,
) => {
  const base = `model:
  provider: openrouter
  default: ${modelId}
`;
  // Hermes reads `mcp_servers.<name>` from config.yaml on startup and expands
  // ${VAR} references against the gateway process env. The agent has exactly
  // two MCP servers:
  //
  //   composio: external productivity stack (Gmail/Calendar/Drive/Tasks/
  //     Contacts). Auth via x-api-key from per-profile .env. Tenancy is
  //     enforced by Composio at the entity-id level.
  //   desh: first-party tools served by apps/api. Hosts `tasks_*`/`contacts_*`
  //     /`emails_*` AND `social_*`/`whatsapp_*`/`inbox_*` (Zernio-backed).
  //     The desh server reads `workspaceId` from the URL and injects
  //     `profileId = workspaces.zernio_profile_id` into every Zernio call —
  //     that's where Zernio tenancy is enforced. Bearer token from .env.
  //
  // We deliberately do NOT mount Zernio's hosted MCP at mcp.zernio.com.
  // Zernio is keyed by a single shared API key with no per-profile auth, so
  // exposing it directly would leak every workspace's connected accounts to
  // every workspace's agent.
  const blocks: string[] = [];
  if (composioMcpUrl) {
    blocks.push(`  composio:
    url: ${yamlString(composioMcpUrl)}
    enabled: true
    headers:
      x-api-key: "\${COMPOSIO_API_KEY}"`);
  }
  blocks.push(`  desh:
    url: ${yamlString(deshMcpUrl)}
    enabled: true
    headers:
      Authorization: "Bearer \${DESH_MCP_TOKEN}"`);
  return `${base}mcp_servers:\n${blocks.join("\n")}\n`;
};

/** Quote a string as a YAML scalar, double-quoting and escaping safely. */
function yamlString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

const ENV_FILE = (i: ProfileRenderInput, hermesHome: string, openrouterKey: string) => {
  const lines = [
    `HERMES_HOME=${hermesHome}`,
    `OPENROUTER_API_KEY=${openrouterKey}`,
    `SAAS_WEB_ENABLED=true`,
    // Opt into Hermes' rich runtime events (run.*/tool.*/message.delta/
    // reasoning.*/step.*/status). The apps/api hermes route schema accepts
    // them via the discriminated HermesOutboundEventSchema; without this
    // toggle Hermes only emits the legacy message/typing/error trio.
    `SAAS_WEB_RICH_EVENTS=true`,
    `SAAS_WEB_KEY=${i.adapterSecret}`,
    `SAAS_WEB_HOST=127.0.0.1`,
    `SAAS_WEB_PORT=${i.hermesPort}`,
    `SAAS_WEB_CALLBACK_URL=${env.HERMES_CALLBACK_BASE_URL}/internal/hermes/events`,
    `SAAS_WEB_CALLBACK_KEY=${i.callbackSecret}`,
    `SAAS_WEB_WORKSPACE_ID=${i.workspaceId}`,
    `SAAS_WEB_WORKSPACE_NAME=${escapeShell(i.workspaceName)}`,
    // First-party MCP (apps/api). The token is the same value as
    // SAAS_WEB_CALLBACK_KEY (the workspace's callback_secret), aliased to
    // a separate env var so the MCP-vs-callback boundary stays explicit
    // and we can rotate them independently if the design ever splits.
    `DESH_MCP_URL=${env.HERMES_CALLBACK_BASE_URL}/internal/mcp/${i.workspaceId}`,
    `DESH_MCP_TOKEN=${i.callbackSecret}`,
  ];
  // Composio MCP requires this header — referenced from config.yaml as
  // ${COMPOSIO_API_KEY}. We only write it when both Composio is configured
  // and the profile actually has a minted MCP URL, since otherwise nothing
  // in the gateway needs it.
  if (env.COMPOSIO_API_KEY && i.composioMcpUrl) {
    lines.push(`COMPOSIO_API_KEY=${env.COMPOSIO_API_KEY}`);
  }
  // ZERNIO_API_KEY is intentionally never written into the per-profile .env.
  // The Zernio API key lives in the apps/api process env and is used by the
  // Desh MCP `social_*`/`whatsapp_*`/`inbox_*` tool handlers — never by the
  // agent directly.
  return lines.join("\n") + "\n";
};

function escapeShell(s: string): string {
  // Best-effort: strip quotes + newlines so the .env file isn't malformed.
  return s.replace(/["\r\n]/g, "");
}

export async function renderProfileConfig(input: ProfileRenderInput): Promise<ProfileRenderOutput> {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error(
      "profile-config: OPENROUTER_API_KEY is not set; Hermes gateway cannot answer prompts.",
    );
  }
  const hermesHome = path.join(env.HERMES_HOME_BASE, input.hermesProfileName);
  await mkdir(hermesHome, { recursive: true });

  const envFilePath = path.join(hermesHome, ".env");
  const configFilePath = path.join(hermesHome, "config.yaml");
  const soulFilePath = path.join(hermesHome, "SOUL.md");

  const deshMcpUrl = `${env.HERMES_CALLBACK_BASE_URL}/internal/mcp/${input.workspaceId}`;

  await writeFile(envFilePath, ENV_FILE(input, hermesHome, env.OPENROUTER_API_KEY), {
    mode: 0o600,
  });
  await writeFile(
    configFilePath,
    CONFIG_YAML(input.modelId, input.composioMcpUrl, deshMcpUrl),
    { mode: 0o644 },
  );

  // Hermes reads ${HERMES_HOME}/SOUL.md as the system prompt. Pandora identity
  // is the floor — always written, regardless of whether the user supplied an
  // extension. The user's text (if any) is appended as workspace context with
  // explicit priority rules favoring Pandora.
  const soulContent = composeSoulMd(input.systemPrompt);
  await writeFile(soulFilePath, soulContent, { mode: 0o644 });

  return { hermesHome, envFilePath, configFilePath, soulFilePath };
}
