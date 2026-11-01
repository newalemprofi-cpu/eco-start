import { z } from "zod";

export const addObservationSchema = z.object({
  measurement: z.coerce.number().min(0).max(100000).optional(),
  note: z.string().trim().max(280).optional(),
});
export type AddObservationInput = z.infer<typeof addObservationSchema>;

export const RESEARCH_STATUSES = ["draft", "active", "completed"] as const;
export type ResearchStatus = (typeof RESEARCH_STATUSES)[number];

export const MAX_RESEARCH_TASKS = 6;

/** Tasks arrive from the form as one textarea, one task per line —
 * blank lines dropped, so the teacher can't create empty steps. */
const tasksField = z.preprocess(
  (v) =>
    typeof v === "string"
      ? v
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      : v,
  z.array(z.string().max(160)).max(MAX_RESEARCH_TASKS)
);

const projectFields = {
  groupId: z.string().uuid(),
  title: z.string().trim().min(2).max(120),
  question: z.string().trim().min(2).max(240),
  hypothesis: z.string().trim().min(2).max(240),
  measurementUnit: z.string().trim().min(1).max(20),
  tasks: tasksField,
};

export const createProjectSchema = z.object({
  ...projectFields,
  /** "draft" = save without showing children; "active" = publish now. */
  status: z.enum(["draft", "active"]),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object(projectFields);
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const setProjectStatusSchema = z.object({
  status: z.enum(RESEARCH_STATUSES),
  conclusion: z.string().trim().max(500).optional(),
});

export const feedbackSchema = z.object({
  feedback: z.string().trim().min(1).max(500),
});
