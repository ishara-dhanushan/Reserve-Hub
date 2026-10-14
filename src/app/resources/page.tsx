import type { Metadata } from "next";
import { Suspense } from "react";
import { ResourceCatalogueClient } from "@/app/resources/components/ResourceCatalogueClient";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Resources",
  description: "Browse and manage shared resources.",
};

type ResourcesPageProps = {
  searchParams: Promise<{ created?: string; deleted?: string }>;
};

async function AuthenticatedResourcesContent({
  searchParams,
}: ResourcesPageProps) {
  await requireUser();

  const { created, deleted } = await searchParams;

  return (
    <ProtectedRoute>
      <ResourceCatalogueClient
        created={created === "1"}
        deleted={deleted === "1"}
      />
    </ProtectedRoute>
  );
}

export default function ResourcesPage({ searchParams }: ResourcesPageProps) {
  return (
    <Suspense
      fallback={
        <main role="status" className="p-8 text-muted-foreground">
          Loading resources...
        </main>
      }
    >
      <AuthenticatedResourcesContent searchParams={searchParams} />
    </Suspense>
  );
}
