import { z } from "zod";

export const WorkspaceRoleSchema = z.enum(["owner", "admin", "member"]);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;

export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1).nullable(),
  icon: z.string(),
  color: z.string(),
  isDefault: z.boolean(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

export const WorkspaceMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: WorkspaceRoleSchema,
  joinedAt: z.string().datetime(),
});

export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;

export const WorkspaceCreateSchema = z.object({
  name: z.string().min(1).max(120),
  icon: z.string().min(1).max(8).optional(),
  color: z.string().min(1).max(64).optional(),
  isDefault: z.boolean().optional(),
});

export type WorkspaceCreate = z.infer<typeof WorkspaceCreateSchema>;

export const WorkspacePatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  icon: z.string().min(1).max(8).optional(),
  color: z.string().min(1).max(64).optional(),
  isDefault: z.boolean().optional(),
});

export type WorkspacePatch = z.infer<typeof WorkspacePatchSchema>;
