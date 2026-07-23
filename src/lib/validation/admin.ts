import { z } from "zod";

export const createTeacherSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.email(),
  password: z.string().min(8).max(72),
  groupId: z.string().optional(),
});

export const createChildSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  loginCode: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9-]+$/, { error: "letters, numbers, dashes only" }),
  pin: z
    .string()
    .trim()
    .min(4, { error: "4-6 digits" })
    .max(6)
    .regex(/^\d+$/, { error: "digits only" }),
  groupId: z.string().optional(),
  avatarUrl: z.string().trim().max(8).optional(),
});

export const createParentSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.email(),
  password: z.string().min(8).max(72),
});
