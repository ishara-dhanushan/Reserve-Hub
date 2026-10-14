import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2, Package, Plus, PowerOff } from "lucide-react";
import { ResourceCard } from "@/app/resources/components/ResourceCard";
import { ResourceSuccessBanner } from "@/app/resources/components/ResourceSuccessBanner";
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
import { listResources } from "@/lib/services/resources";

export const metadata: Metadata = {
  title: "Resources",
  description: "Browse and manage shared resources.",
};

type ResourcesPageProps = {
  searchParams: Promise<{
    created?: string;
    deleted?: string;
  }>;
};

async function AuthenticatedResourcesContent({
  searchParams,
}: ResourcesPageProps) {
  await requireUser();

  const { created, deleted } = await searchParams;
  const resources = await listResources();

  const activeCount = resources.filter((resource) => resource.isActive).length;

  const inactiveCount = resources.length - activeCount;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <AppHeader />

        <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Resource Catalogue
              </h1>

              <p className="mt-2 text-muted-foreground">
                Browse shared meeting rooms and equipment.
              </p>
            </div>

            <Button asChild>
              <Link href="/resources/new">
                <Plus className="size-4" aria-hidden="true" />
                Add Resource
              </Link>
            </Button>
          </div>

          {created === "1" && <ResourceSuccessBanner kind="created" />}
          {deleted === "1" && <ResourceSuccessBanner kind="deleted" />}

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>Total Resources</CardDescription>
                <CardTitle className="flex items-center gap-3 text-2xl text-primary">
                  <Package className="size-6" aria-hidden="true" />
                  {resources.length}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Active Resources</CardDescription>
                <CardTitle className="flex items-center gap-3 text-2xl text-success">
                  <CheckCircle2 className="size-6" aria-hidden="true" />
                  {activeCount}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Inactive Resources</CardDescription>
                <CardTitle className="flex items-center gap-3 text-2xl text-warning">
                  <PowerOff className="size-6" aria-hidden="true" />
                  {inactiveCount}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {resources.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <Package className="size-8" aria-hidden="true" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">No resources yet</h2>

                  <p className="max-w-md text-sm text-muted-foreground">
                    Create your first meeting room or equipment resource to make
                    it visible to everyone.
                  </p>
                </div>

                <Button asChild>
                  <Link href="/resources/new">
                    <Plus className="size-4" aria-hidden="true" />
                    Create Resource
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">All Resources</h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Active and inactive resources are both listed.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {resources.map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} />
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default function ResourcesPage({ searchParams }: ResourcesPageProps) {
  return (
    <Suspense
      fallback={
        <main
          className="flex min-h-screen items-center justify-center text-muted-foreground"
          role="status"
        >
          Loading resources...
        </main>
      }
    >
      <AuthenticatedResourcesContent searchParams={searchParams} />
    </Suspense>
  );
}
