import { z } from "zod";

export const ProjectSpecSchema = z.object({
  id: z.string().min(1),
  playerCount: z.number().int().positive(),
  expectedDurationMinutes: z.number().positive().optional(),
  settingRequest: z.string().optional(),
  cooperationMode: z.enum([
    "cooperative",
    "non_cooperative",
    "mixed",
    "unspecified"
  ]),
  perspective: z
    .enum(["first_person", "second_person", "limited_third"])
    .optional(),
  deliverables: z.object({
    structure: z.boolean(),
    characterBooks: z.boolean(),
    gmManual: z.boolean(),
    fullNarrative: z.boolean()
  }),
  requirements: z.array(z.string()),
  forbiddenPatterns: z.array(z.string())
});
export type ProjectSpec = z.infer<typeof ProjectSpecSchema>;
