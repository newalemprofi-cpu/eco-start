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

// ── Release 2: editing existing users ─────────────────────────────────
// Ids are uuids; every write is additionally scoped server-side to the
// admin's own school and to the expected role (src/db/repo/user-admin.ts).

const id = z.uuid();
const optionalId = z
  .union([z.uuid(), z.literal(""), z.literal("none")])
  .optional()
  .transform((v) => (v && v !== "none" ? v : null));

export const updateTeacherSchema = z.object({
  id,
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().pipe(z.email()),
  // Тәрбиеші (groups.educator_id) ↔ Педагог-ассистент (groups.pedagogical_assistant_id)
  position: z.enum(["main", "assistant"]),
  groupId: optionalId,
  // The chosen slot already belongs to someone else: replace only when
  // the admin explicitly confirmed it in the dialog.
  replaceExisting: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const updateChildSchema = z.object({
  id,
  displayName: z.string().trim().min(2).max(80),
  loginCode: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, { error: "letters, numbers, dashes only" }),
  groupId: optionalId,
  // Optional PIN reset — empty means "keep the current PIN".
  pin: z
    .string()
    .trim()
    .regex(/^(\d{4,6})?$/, { error: "4-6 digits" })
    .optional()
    .transform((v) => (v ? v : null)),
});

export const updateParentSchema = z.object({
  id,
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().pipe(z.email()),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+()\-\s]*$/)
    .optional()
    .transform((v) => (v ? v : null)),
});

export const resetPasswordSchema = z.object({
  id,
  password: z.string().min(8).max(72),
});

export const linkParentSchema = z.object({ parentId: id, childId: id });
