import { z } from "zod";

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(2, { error: "Тым қысқа / Слишком коротко / Too short" })
    .max(120),
  secret: z
    .string()
    .min(4, { error: "Кемінде 4 таңба / Минимум 4 символа / At least 4 characters" })
    .max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
