import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { z } from "zod";
import { ResourceEditForm } from "@/app/resources/components/ResourceEditForm";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getResourceById } from "@/lib/services/resources";

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
  const parsedId = z.uuid().safeParse(resourceId);

  if (!parsedId.success) {
    notFound();
  }

  const resource = await getResourceById(parsedId.data);

  if (!resource) {
    notFound();
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <AppHeader />

        <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
          <Button asChild variant="ghost" className="mb-6">
            <Link href={`/resources/${resource.id}`}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to Resource
            </Link>
          </Button>

          <Card>
            <CardHeader className="space-y-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <Pencil className="size-6" aria-hidden="true" />
              </div>

              <CardTitle className="text-2xl">Edit Resource</CardTitle>

              <CardDescription>
                Update {resource.name}. The original creator remains{" "}
                {resource.createdBy.name}.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <ResourceEditForm resource={resource} />
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default function EditResourcePage({ params }: EditResourcePageProps) {
  return (
    <Suspense
      fallback={
        <main
          role="status"
          className="flex min-h-screen items-center justify-center text-muted-foreground"
        >
          Loading resource...
        </main>
      }
    >
      <AuthenticatedEditResourceContent params={params} />
    </Suspense>
  );
}
