"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, RefreshCw } from "lucide-react";
import { ResourceEditForm } from "@/app/resources/components/ResourceEditForm";
import { ResourceNotFound } from "@/app/resources/components/ResourceNotFound";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ResourceDetailResponse } from "@/lib/types/resources";

interface ResourceEditClientProps {
  resourceId: string;
}

export function ResourceEditClient({ resourceId }: ResourceEditClientProps) {
  const router = useRouter();
  const [data, setData] = useState<ResourceDetailResponse | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadResource() {
      try {
        const response = await fetch(
          `/api/resources/${encodeURIComponent(resourceId)}`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (controller.signal.aborted) {
          return;
        }

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (response.status === 404 || response.status === 400) {
          setMissing(true);
          setData(null);
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load resource.");
        }

        const result = (await response.json()) as ResourceDetailResponse;

        if (!result.resource) {
          throw new Error("Invalid resource response.");
        }

        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to load this resource. Please try again.");
        }
      }
    }

    void loadResource();

    return () => controller.abort();
  }, [router, resourceId, reloadCount]);

  function retry() {
    setError("");
    setMissing(false);
    setData(null);
    setReloadCount((count) => count + 1);
  }

  if (missing) {
    return <ResourceNotFound />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <Button asChild variant="ghost" className="mb-6">
          <Link href={`/resources/${resourceId}`}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Resource
          </Link>
        </Button>

        {error && (
          <div className="mb-6 space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>

            <Button type="button" variant="outline" onClick={retry}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Try Again
            </Button>
          </div>
        )}

        {!data && !error && (
          <p role="status" className="py-12 text-center text-muted-foreground">
            Loading resource...
          </p>
        )}

        {data && (
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <Pencil className="size-6" aria-hidden="true" />
              </div>

              <CardTitle className="text-2xl">Edit Resource</CardTitle>

              <CardDescription>
                Update {data.resource.name}. The original creator remains{" "}
                {data.resource.createdBy.name}.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <ResourceEditForm
                key={data.resource.id}
                resource={data.resource}
              />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
