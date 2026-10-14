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

export const updateResourceSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(100).optional(),

    type: z.enum(ResourceType).optional(),

    location: z.string().trim().min(2).max(120).optional(),

    capacity: z.number().int().positive().nullable().optional(),

    description: z.string().trim().max(500).nullable().optional(),

    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one resource field is required.",
  });

export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
