import { z } from "zod";

export const addObservationSchema = z.object({
  measurement: z.coerce.number().min(0).max(100000).optional(),
  note: z.string().trim().max(280).optional(),
});
export type AddObservationInput = z.infer<typeof addObservationSchema>;

export const createProjectSchema = z.object({
  groupId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  question: z.string().trim().min(2).max(240),
  hypothesis: z.string().trim().min(2).max(240),
  measurementUnit: z.string().trim().min(1).max(20),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const feedbackSchema = z.object({
  feedback: z.string().trim().min(1).max(500),
});
