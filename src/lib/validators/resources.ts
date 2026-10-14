import { z } from "zod";
import { ResourceType } from "@/generated/prisma/enums";

export const createResourceSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),

  type: z.enum(ResourceType),

  location: z.string().trim().min(2).max(120),

  capacity: z.number().int().positive().optional(),

  description: z.string().trim().max(500).optional(),
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
