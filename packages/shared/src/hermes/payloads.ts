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
export const SaaSWebCallbackEventSchema = z.object({
  seq: z.number().int().nonnegative(),
  event: z.enum(["message", "typing", "error"]),
  platform: z.literal("saas_web"),
  conversation_id: z.string(),
  workspace_id: z.string(),
  message_id: z.string(),
  timestamp: z.string(),
  reply_to: z.string().optional(),
  content: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type SaaSWebCallbackEvent = z.infer<typeof SaaSWebCallbackEventSchema>;
