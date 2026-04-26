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
   * Null when Composio isn't configured or the mint failed — gateway still
   * starts, just without Composio tools.
   */
  composioMcpUrl: string | null;
}

export interface ProfileRenderOutput {
  hermesHome: string;            // absolute path to the per-profile dir
  envFilePath: string;
  configFilePath: string;
  soulFilePath: string;          // always written (Pandora is mandatory)
}

const CONFIG_YAML = (modelId: string, composioMcpUrl: string | null) => {
  const base = `model:
  provider: openrouter
  default: ${modelId}
`;
  if (!composioMcpUrl) return base;
  // Hermes reads `mcp_servers.<name>` from config.yaml on startup and expands
  // ${VAR} references against the gateway process env. Composio's MCP gateway
  // requires the workspace's API key in an `x-api-key` header — without it
  // every request comes back 401. We keep the literal key in the per-profile
  // .env file (mode 0o600) and reference it here so config.yaml itself
  // (mode 0o644) doesn't carry the secret.
  return `${base}mcp_servers:
  composio:
    url: ${yamlString(composioMcpUrl)}
    enabled: true
    headers:
      x-api-key: "\${COMPOSIO_API_KEY}"
`;
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
    `SAAS_WEB_KEY=${i.adapterSecret}`,
    `SAAS_WEB_HOST=127.0.0.1`,
    `SAAS_WEB_PORT=${i.hermesPort}`,
    `SAAS_WEB_CALLBACK_URL=${env.HERMES_CALLBACK_BASE_URL}/internal/hermes/events`,
    `SAAS_WEB_CALLBACK_KEY=${i.callbackSecret}`,
    `SAAS_WEB_WORKSPACE_ID=${i.workspaceId}`,
    `SAAS_WEB_WORKSPACE_NAME=${escapeShell(i.workspaceName)}`,
  ];
  // Composio MCP requires this header — referenced from config.yaml as
  // ${COMPOSIO_API_KEY}. We only write it when both Composio is configured
  // and the profile actually has a minted MCP URL, since otherwise nothing
  // in the gateway needs it.
  if (env.COMPOSIO_API_KEY && i.composioMcpUrl) {
    lines.push(`COMPOSIO_API_KEY=${env.COMPOSIO_API_KEY}`);
  }
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

  await writeFile(envFilePath, ENV_FILE(input, hermesHome, env.OPENROUTER_API_KEY), {
    mode: 0o600,
  });
  await writeFile(configFilePath, CONFIG_YAML(input.modelId, input.composioMcpUrl), { mode: 0o644 });

  // Hermes reads ${HERMES_HOME}/SOUL.md as the system prompt. Pandora identity
  // is the floor — always written, regardless of whether the user supplied an
  // extension. The user's text (if any) is appended as workspace context with
  // explicit priority rules favoring Pandora.
  const soulContent = composeSoulMd(input.systemPrompt);
  await writeFile(soulFilePath, soulContent, { mode: 0o644 });

  return { hermesHome, envFilePath, configFilePath, soulFilePath };
}
