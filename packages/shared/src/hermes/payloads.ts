import { z } from "zod";

// POST http://127.0.0.1:<workspace_gateway_port>/messages
// Request schema for the saas_web Hermes platform adapter.
export const SaaSWebMessageSchema = z.object({
  text: z.string(),
  conversation_id: z.string(),
  conversation_name: z.string().optional(),
  message_id: z.string(),
  workspace_id: z.string(),
  workspace_name: z.string().optional(),
  user_id: z.string(),
  user_name: z.string().optional(),
  thread_id: z.string().optional(),
  auto_skill: z.string().optional(),
  channel_prompt: z.string().optional(),
});

export type SaaSWebMessage = z.infer<typeof SaaSWebMessageSchema>;

export const SaaSWebMessageResponseSchema = z.object({
  status: z.enum(["accepted", "duplicate"]),
  message_id: z.string(),
  conversation_id: z.string(),
  workspace_id: z.string(),
  user_id: z.string(),
});

export type SaaSWebMessageResponse = z.infer<typeof SaaSWebMessageResponseSchema>;

// Inbound callback payload Hermes posts to SAAS_WEB_CALLBACK_URL.
//
// With SAAS_WEB_RICH_EVENTS=true, Hermes emits a discriminated union of
// runtime events (run.*, tool.*, message.delta, reasoning.*, step.*,
// status). Without it, Hermes only emits message/typing/error — that
// subset is still valid against this schema.
//
// The base envelope is shared across all variants; per-variant fields
// live in the discriminated tail. zod's discriminatedUnion gives us
// cheap per-variant narrowing inside the apps/api route handler.

const BaseEnvelope = z.object({
  seq: z.number().int().nonnegative(),
  platform: z.literal("saas_web"),
  conversation_id: z.string(),
  workspace_id: z.string(),
  workspace_name: z.string().optional(),
  message_id: z.string(),
  timestamp: z.string(),
  run_id: z.string().optional(),
  reply_to: z.string().optional(),
  parent_message_id: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const HermesOutboundEventSchema = z.discriminatedUnion("event", [
  // Final assistant message (the only persisted user-visible reply).
  BaseEnvelope.extend({ event: z.literal("message"), content: z.string() }),
  // Legacy liveness signal — apps/api drops it pre-insert; live subscribers
  // still see it via the pub/sub broadcast.
  BaseEnvelope.extend({ event: z.literal("typing") }),
  BaseEnvelope.extend({ event: z.literal("error"), content: z.string() }),
  // Run lifecycle.
  BaseEnvelope.extend({ event: z.literal("run.started"), status: z.string().optional() }),
  BaseEnvelope.extend({ event: z.literal("run.completed"), duration_ms: z.number().int().nonnegative().optional() }),
  BaseEnvelope.extend({ event: z.literal("run.failed"), error: z.string() }),
  // Streaming assistant text — high-frequency, kept ephemeral.
  BaseEnvelope.extend({
    event: z.literal("message.delta"),
    delta: z.string(),
    index: z.number().int().nonnegative().optional(),
  }),
  // Tool-call lifecycle.
  BaseEnvelope.extend({
    event: z.literal("tool.started"),
    tool_call_id: z.string(),
    tool_name: z.string(),
    preview: z.string().optional(),
    args_keys: z.array(z.string()).default([]),
  }),
  BaseEnvelope.extend({
    event: z.literal("tool.completed"),
    tool_call_id: z.string(),
    tool_name: z.string(),
    duration_ms: z.number().int().nonnegative().optional(),
    result_preview: z.string().optional(),
  }),
  BaseEnvelope.extend({
    event: z.literal("tool.failed"),
    tool_call_id: z.string(),
    tool_name: z.string(),
    duration_ms: z.number().int().nonnegative().optional(),
    result_preview: z.string().optional(),
  }),
  BaseEnvelope.extend({
    event: z.literal("step.completed"),
    iteration: z.number().int().nonnegative(),
    tool_names: z.array(z.string()).default([]),
  }),
  // Reasoning summary (capped/sanitized by Hermes).
  BaseEnvelope.extend({ event: z.literal("reasoning.started"), status: z.string().optional() }),
  BaseEnvelope.extend({
    event: z.literal("reasoning.summary"),
    summary: z.string(),
    truncated: z.boolean().optional(),
  }),
  // Out-of-band status notice (e.g., "context_pressure").
  BaseEnvelope.extend({
    event: z.literal("status"),
    status: z.string(),
    content: z.string().optional(),
  }),
]);

export type HermesOutboundEvent = z.infer<typeof HermesOutboundEventSchema>;

// Backward-compat alias. Existing callers that only handle message/typing/
// error continue to type-check against this name; the union accepts the
// rich variants too.
export const SaaSWebCallbackEventSchema = HermesOutboundEventSchema;
export type SaaSWebCallbackEvent = HermesOutboundEvent;
