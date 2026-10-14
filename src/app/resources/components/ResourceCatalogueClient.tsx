"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Package, Plus, PowerOff, RefreshCw } from "lucide-react";
import { ResourceCard } from "@/app/resources/components/ResourceCard";
import { ResourceSuccessBanner } from "@/app/resources/components/ResourceSuccessBanner";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ResourceDTO, ResourceListResponse } from "@/lib/types/resources";

type Props = { created: boolean; deleted: boolean };

export function ResourceCatalogueClient({ created, deleted }: Props) {
  const router = useRouter();
  const [resources, setResources] = useState<ResourceDTO[] | null>(null);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadResources() {
      try {
        const response = await fetch("/api/resources", {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load resources.");
        }

        const data = (await response.json()) as ResourceListResponse;

        if (!Array.isArray(data.resources)) {
          throw new Error("Invalid resource response.");
        }

        if (!controller.signal.aborted) {
          setResources(data.resources);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to load resources. Please try again.");
        }
      }
    }

    void loadResources();

    return () => controller.abort();
  }, [router, reloadCount]);

  const activeCount =
    resources?.filter((resource) => resource.isActive).length ?? 0;

  const inactiveCount = (resources?.length ?? 0) - activeCount;

  return (
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

        {created && <ResourceSuccessBanner kind="created" />}
        {deleted && <ResourceSuccessBanner kind="deleted" />}

        {error && (
          <Card>
            <CardContent className="flex flex-col items-start gap-3 py-4">
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError("");
                  setResources(null);
                  setReloadCount((n) => n + 1);
                }}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {!resources && !error ? (
          <p role="status" className="py-12 text-center text-muted-foreground">
            Loading resources...
          </p>
        ) : (
          resources && (
            <>
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
                      <h2 className="text-xl font-semibold">
                        No resources yet
                      </h2>

                      <p className="max-w-md text-sm text-muted-foreground">
                        Create your first meeting room or equipment resource to
                        make it visible to everyone.
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
            </>
          )
        )}
      </main>
    </div>
  );
}
