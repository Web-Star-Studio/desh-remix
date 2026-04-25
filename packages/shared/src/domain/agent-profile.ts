import { z } from "zod";

export const AgentProviderSchema = z.literal("openrouter");
export type AgentProvider = z.infer<typeof AgentProviderSchema>;

export const DEFAULT_MODEL_ID = "moonshotai/kimi-k2.6";

export const AgentProfileStatusSchema = z.enum(["stopped", "starting", "running", "error"]);
export type AgentProfileStatus = z.infer<typeof AgentProfileStatusSchema>;

export const AgentProfileSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  displayName: z.string().min(1),
  // Stable, derived from workspaceId by the database (generated column).
  hermesProfileName: z.string().min(1),
  hermesPort: z.number().int().positive().nullable(),
  status: AgentProfileStatusSchema,
  lastStartedAt: z.string().datetime().nullable(),
  provider: AgentProviderSchema,
  modelId: z.string().min(1).default(DEFAULT_MODEL_ID),
  systemPrompt: z.string().nullable(),
  config: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AgentProfile = z.infer<typeof AgentProfileSchema>;

// User-facing patch: only modelId is editable here.
// Provider is locked server-side; clients cannot override it.
// Allowed model id chars match OpenRouter's slug grammar (e.g. "moonshotai/kimi-k2.6").
export const AgentSettingsPatchSchema = z.object({
  modelId: z.string().min(1).regex(/^[a-zA-Z0-9/_.-]+$/, "model id has invalid characters"),
});

export type AgentSettingsPatch = z.infer<typeof AgentSettingsPatchSchema>;
