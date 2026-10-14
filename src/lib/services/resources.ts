import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreateResourceInput } from "@/lib/validators/resources";

// Select only the resource fields required by the application.
const resourceSelect = {
  id: true,
  name: true,
  type: true,
  location: true,
  capacity: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      name: true,
    },
  },
} as const satisfies Prisma.ResourceSelect;

// Infer the result type directly from the Prisma selection.
export type ResourceWithCreator = Prisma.ResourceGetPayload<{
  select: typeof resourceSelect;
}>;

// Retrieve both active and inactive resources.
export async function listResources(): Promise<ResourceWithCreator[]> {
  return prisma.resource.findMany({
    select: resourceSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
}

// Retrieve one resource by its unique identifier.
export async function getResourceById(
  resourceId: string,
): Promise<ResourceWithCreator | null> {
  return prisma.resource.findUnique({
    where: {
      id: resourceId,
    },
    select: resourceSelect,
  });
}

// Create a resource and preserve creator attribution.
export async function createResource(
  input: CreateResourceInput,
  creatorId: string,
): Promise<ResourceWithCreator> {
  const data = {
    name: input.name,
    type: input.type,
    location: input.location,
    capacity: input.capacity ?? null,
    description: input.description ?? null,
    isActive: true,
    createdBy: {
      connect: {
        id: creatorId,
      },
    },
  } satisfies Prisma.ResourceCreateInput;

  return prisma.resource.create({
    data,
    select: resourceSelect,
  });
}
