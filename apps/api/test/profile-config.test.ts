import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderProfileConfig } from "../src/services/hermes/profile-config.js";

// Snapshot the YAML/.env emission so a future edit can't silently drop the
// desh MCP block or change the `Bearer ${DESH_MCP_TOKEN}` header pattern.
// Hermes is finicky about the exact shape of these files, and we don't get
// a useful error if it boots without a tool source.

describe("renderProfileConfig", () => {
  let tmpRoot: string;
  let originalHome: string | undefined;

  beforeAll(async () => {
    tmpRoot = await mkdtemp(path.join(tmpdir(), "desh-profile-"));
    originalHome = process.env.HERMES_HOME_BASE;
    // env.ts is already parsed; we rely on it having seen this in
    // global-setup.ts. Set it here as a safety net for direct vitest
    // invocations that skip global setup.
    process.env.HERMES_HOME_BASE = tmpRoot;
  });

  afterAll(async () => {
    if (originalHome !== undefined) process.env.HERMES_HOME_BASE = originalHome;
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("emits both composio and desh MCP blocks when composio URL is provided", async () => {
    const workspaceId = "11111111-1111-1111-1111-111111111111";
    const result = await renderProfileConfig({
      hermesProfileName: "ws_test_with_composio",
      workspaceId,
      workspaceName: "Test workspace",
      hermesPort: 8765,
      adapterSecret: "adapter-test",
      callbackSecret: "callback-test",
      modelId: "moonshotai/kimi-k2.6",
      systemPrompt: null,
      composioMcpUrl: "https://backend.composio.dev/v3/mcp/srv?user_id=ws_user",
    });

    const yaml = await readFile(result.configFilePath, "utf8");
    expect(yaml).toContain("mcp_servers:");
    expect(yaml).toContain("composio:");
    expect(yaml).toContain('url: "https://backend.composio.dev/v3/mcp/srv?user_id=ws_user"');
    expect(yaml).toContain('x-api-key: "${COMPOSIO_API_KEY}"');
    expect(yaml).not.toContain("zernio:");
    expect(yaml).toContain("desh:");
    expect(yaml).toContain('Authorization: "Bearer ${DESH_MCP_TOKEN}"');
    // The desh URL should reference the API base + the workspace ID.
    expect(yaml).toMatch(/url: "http.+\/internal\/mcp\/11111111-1111-1111-1111-111111111111"/);

    const envFile = await readFile(result.envFilePath, "utf8");
    expect(envFile).toContain(`DESH_MCP_URL=`);
    expect(envFile).toContain(`/internal/mcp/${workspaceId}`);
    expect(envFile).toContain(`DESH_MCP_TOKEN=callback-test`);
    expect(envFile).toContain(`SAAS_WEB_CALLBACK_KEY=callback-test`);
  });

  it("emits only the desh MCP block when composio URL is null", async () => {
    const result = await renderProfileConfig({
      hermesProfileName: "ws_test_no_composio",
      workspaceId: "22222222-2222-2222-2222-222222222222",
      workspaceName: "Solo Test",
      hermesPort: 8766,
      adapterSecret: "adapter-2",
      callbackSecret: "callback-2",
      modelId: "moonshotai/kimi-k2.6",
      systemPrompt: null,
      composioMcpUrl: null,
    });

    const yaml = await readFile(result.configFilePath, "utf8");
    expect(yaml).not.toContain("composio:");
    expect(yaml).not.toContain("zernio:");
    expect(yaml).toContain("desh:");
    expect(yaml).toContain('Authorization: "Bearer ${DESH_MCP_TOKEN}"');

    const envFile = await readFile(result.envFilePath, "utf8");
    expect(envFile).toContain(`DESH_MCP_TOKEN=callback-2`);
    // No Composio or Zernio key without an MCP URL.
    expect(envFile).not.toContain("COMPOSIO_API_KEY=");
    expect(envFile).not.toContain("ZERNIO_API_KEY=");
  });
});
