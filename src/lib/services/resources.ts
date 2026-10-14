import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ResourceType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type {
  CreateResourceInput,
  UpdateResourceInput,
} from "@/lib/validators/resources";

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

type ResourceKey = Pick<CreateResourceInput, "name" | "type" | "location">;

export class DuplicateResourceError extends Error {
  constructor() {
    super("A resource with the same name, type, and location already exists.");
    this.name = "DuplicateResourceError";
  }
}

// Lock the normalized resource identity until the transaction ends.
async function lockResourceKey(
  tx: Prisma.TransactionClient,
  key: ResourceKey,
): Promise<void> {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(
        concat_ws(
          chr(31),
          lower(btrim(${key.name}::text)),
          ${key.type}::text,
          lower(btrim(${key.location}::text))
        ),
        0
      )
    )::text AS "acquired"
  `;
}

async function resourceKeyExists(
  tx: Prisma.TransactionClient,
  key: ResourceKey,
  excludedId?: string,
): Promise<boolean> {
  const matches = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Resource"
    WHERE lower(btrim("name")) = lower(btrim(${key.name}::text))
      AND "type"::text = ${key.type}
      AND lower(btrim("location")) = lower(btrim(${key.location}::text))
      AND (
        ${excludedId ?? null}::uuid IS NULL
        OR "id" <> ${excludedId ?? null}::uuid
      )
    LIMIT 1
  `;

  return matches.length > 0;
}

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

  return prisma.$transaction(async (tx) => {
    await lockResourceKey(tx, input);

    if (await resourceKeyExists(tx, input)) {
      throw new DuplicateResourceError();
    }

    return tx.resource.create({
      data,
      select: resourceSelect,
    });
  });
}

// Edit resource fields without changing its original creator.
export async function updateResource(
  resourceId: string,
  input: UpdateResourceInput,
) {
  const data = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.type !== undefined && { type: input.type }),
    ...(input.location !== undefined && {
      location: input.location,
    }),
    ...(input.capacity !== undefined && {
      capacity: input.capacity,
    }),
    ...(input.description !== undefined && {
      description: input.description,
    }),
    ...(input.isActive !== undefined && {
      isActive: input.isActive,
    }),
  } satisfies Prisma.ResourceUpdateInput;

  return prisma.$transaction(async (tx) => {
    // Lock the resource while evaluating lifecycle restrictions.
    const locked = await tx.$queryRaw<
      Array<{
        id: string;
        name: string;
        type: ResourceType;
        location: string;
        isActive: boolean;
      }>
    >`
      SELECT "id", "name", "type", "location", "isActive"
      FROM "Resource"
      WHERE "id" = ${resourceId}::uuid
      FOR UPDATE
    `;

    const existing = locked[0];

    if (!existing) {
      return { status: "not-found" } as const;
    }

    const targetKey = {
      name: input.name ?? existing.name,
      type: input.type ?? existing.type,
      location: input.location ?? existing.location,
    };

    const keyChanged =
      existing.name.trim().toLowerCase() !==
        targetKey.name.trim().toLowerCase() ||
      existing.type !== targetKey.type ||
      existing.location.trim().toLowerCase() !==
        targetKey.location.trim().toLowerCase();

    // Legacy duplicates can still have non-identifying fields edited.
    if (keyChanged) {
      await lockResourceKey(tx, targetKey);

      if (await resourceKeyExists(tx, targetKey, resourceId)) {
        throw new DuplicateResourceError();
      }
    }

    // Deactivation is blocked by ongoing or future confirmed bookings.
    if (input.isActive === false && existing.isActive) {
      const blockingReservation = await tx.reservation.findFirst({
        where: {
          resourceId,
          status: "CONFIRMED",
          endAt: { gt: new Date() },
        },
        select: { id: true },
      });

      if (blockingReservation) {
        return { status: "blocked" } as const;
      }
    }

    const resource = await tx.resource.update({
      where: { id: resourceId },
      data,
      select: resourceSelect,
    });

    return { status: "updated", resource } as const;
  });
}

// Identify referential-integrity failures without exposing database errors.
function isForeignKeyViolation(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 5; depth++) {
    if (typeof current !== "object" || current === null) {
      return false;
    }

    if (
      "code" in current &&
      (current.code === "P2003" || current.code === "23503")
    ) {
      return true;
    }

    current = "cause" in current ? current.cause : null;
  }

  return false;
}

// Permanently delete only resources with no reservation history.
export async function deleteResource(resourceId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Resource"
        WHERE "id" = ${resourceId}::uuid
        FOR UPDATE
      `;

      if (locked.length === 0) {
        return "not-found" as const;
      }

      const existingReservation = await tx.reservation.findFirst({
        where: { resourceId },
        select: { id: true },
      });

      if (existingReservation) {
        return "blocked" as const;
      }

      await tx.resource.delete({
        where: { id: resourceId },
      });

      return "deleted" as const;
    });
  } catch (error: unknown) {
    if (isForeignKeyViolation(error)) {
      return "blocked" as const;
    }

    throw error;
  }
}
