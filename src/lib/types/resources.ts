import type { ResourceType } from "@/generated/prisma/enums";

/** JSON representation returned by the resource REST API. */
export type ResourceDTO = {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  capacity: number | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: { name: string };
};

export type ResourceListResponse = { resources: ResourceDTO[] };

export type ResourceDetailResponse = {
  resource: ResourceDTO;
  hasReservationHistory: boolean;
};
