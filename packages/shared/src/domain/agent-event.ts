import { z } from "zod";

const baseEvent = {
  id: z.union([z.string(), z.number()]),
  conversationId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
};

export const AgentEventSchema = z.discriminatedUnion("type", [
  z.object({ ...baseEvent, type: z.literal("user_message"), text: z.string() }),
  z.object({ ...baseEvent, type: z.literal("assistant_delta"), text: z.string() }),
  z.object({
    ...baseEvent,
    type: z.literal("tool_call"),
    name: z.string(),
    args: z.record(z.unknown()),
  }),
  z.object({
    ...baseEvent,
    type: z.literal("tool_result"),
    name: z.string(),
    result: z.unknown(),
  }),
  z.object({ ...baseEvent, type: z.literal("final"), text: z.string() }),
  z.object({ ...baseEvent, type: z.literal("error"), message: z.string() }),
]);

export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type AgentEventType = AgentEvent["type"];
