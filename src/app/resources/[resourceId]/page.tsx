import type { Metadata } from "next";
import { Suspense } from "react";
import { ResourceDetailsClient } from "@/app/resources/components/ResourceDetailsClient";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Resource Details",
  description: "View shared resource details.",
};

type ResourceDetailPageProps = {
  params: Promise<{ resourceId: string }>;
  searchParams: Promise<{
    updated?: string;
    deactivated?: string;
    reactivated?: string;
  }>;
};

async function AuthenticatedResourceDetails({
  params,
  searchParams,
}: ResourceDetailPageProps) {
  await requireUser();

  const { resourceId } = await params;
  const { updated, deactivated, reactivated } = await searchParams;

  const initialNotice =
    updated === "1"
      ? "updated"
      : deactivated === "1"
        ? "deactivated"
        : reactivated === "1"
          ? "reactivated"
          : null;

  return (
    <ProtectedRoute>
      <ResourceDetailsClient
        key={resourceId}
        resourceId={resourceId}
        initialNotice={initialNotice}
      />
    </ProtectedRoute>
  );
}

export default function ResourceDetailPage(props: ResourceDetailPageProps) {
  return (
    <Suspense
      fallback={
        <main role="status" className="p-8 text-muted-foreground">
          Loading resource details...
        </main>
      }
    >
      <AuthenticatedResourceDetails {...props} />
    </Suspense>
  );
}
