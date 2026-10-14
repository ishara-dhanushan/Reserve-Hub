import type { Metadata } from "next";
import { Suspense } from "react";
import { ResourceEditClient } from "@/app/resources/components/ResourceEditClient";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Edit Resource",
  description: "Update shared resource details.",
};

type EditResourcePageProps = {
  params: Promise<{ resourceId: string }>;
};

async function AuthenticatedEditResourceContent({
  params,
}: EditResourcePageProps) {
  await requireUser();

  const { resourceId } = await params;

  return (
    <ProtectedRoute>
      <ResourceEditClient key={resourceId} resourceId={resourceId} />
    </ProtectedRoute>
  );
}

export default function EditResourcePage({ params }: EditResourcePageProps) {
  return (
    <Suspense
      fallback={
        <main role="status" className="p-8 text-muted-foreground">
          Loading resource...
        </main>
      }
    >
      <AuthenticatedEditResourceContent params={params} />
    </Suspense>
  );
}
