import { z } from "zod";

export const ConversationStatusSchema = z.enum(["active", "archived"]);
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  agentProfileId: z.string().uuid(),
  createdBy: z.string().uuid(),
  title: z.string().nullable(),
  status: ConversationStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Conversation = z.infer<typeof ConversationSchema>;
