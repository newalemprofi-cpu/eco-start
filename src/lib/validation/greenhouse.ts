import { z } from "zod";

export const createPlantSchema = z.object({
  nickname: z.string().trim().min(1).max(60),
  waterSchedule: z.enum(["every_day", "every_2_days", "every_week"]),
});
export type CreatePlantInput = z.infer<typeof createPlantSchema>;

export const addGrowthLogSchema = z.object({
  heightCm: z.coerce.number().min(0).max(1000).optional(),
  note: z.string().trim().max(280).optional(),
});
export type AddGrowthLogInput = z.infer<typeof addGrowthLogSchema>;
