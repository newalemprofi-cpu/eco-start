import { z } from "zod";
import { ALL_STAGE_KEYS, PLANT_KEYS } from "@/lib/domain/plant-catalog";

export const createPlantSchema = z.object({
  nickname: z.string().trim().min(1).max(60),
  waterSchedule: z.enum(["every_day", "every_2_days", "every_week"]),
  /** Optional so a request without it (pre-catalog client) still works. */
  plantKey: z.enum(PLANT_KEYS).optional(),
});
export type CreatePlantInput = z.infer<typeof createPlantSchema>;

export const addGrowthLogSchema = z.object({
  heightCm: z.coerce.number().min(0).max(1000).optional(),
  leafCount: z.coerce.number().int().min(0).max(20).optional(),
  stage: z.enum(ALL_STAGE_KEYS).optional(),
  note: z.string().trim().max(280).optional(),
});
export type AddGrowthLogInput = z.infer<typeof addGrowthLogSchema>;
