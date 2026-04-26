import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  cognitoSub: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  onboardingCompleted: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

// Subset returned by GET /me — what the SPA's AuthContext consumes.
export const MeSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  onboardingCompleted: z.boolean(),
});

export type Me = z.infer<typeof MeSchema>;

export const MePatchSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  onboardingCompleted: z.boolean().optional(),
});

export type MePatch = z.infer<typeof MePatchSchema>;
