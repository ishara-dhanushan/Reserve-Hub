"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  DoorOpen,
  MapPin,
  Monitor,
  RefreshCw,
  UserRound,
  UsersRound,
} from "lucide-react";
import { ResourceNotFound } from "@/app/resources/components/ResourceNotFound";
import {
  ResourceLifecycleControls,
  type ResourceLifecycleFeedback,
} from "@/app/resources/components/ResourceLifecycleControls";
import { ResourceSuccessBanner } from "@/app/resources/components/ResourceSuccessBanner";
import { ResourceFeedbackBanner } from "@/app/resources/components/ResourceFeedbackBanner";
import { AppHeader } from "@/components/layout/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ResourceDetailResponse } from "@/lib/types/resources";

type StatusNotice = "updated" | "deactivated" | "reactivated";

export function ResourceDetailsClient({
  resourceId,
  initialNotice,
}: {
  resourceId: string;
  initialNotice: StatusNotice | null;
}) {
  const router = useRouter();
  const [data, setData] = useState<ResourceDetailResponse | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [notice, setNotice] = useState<StatusNotice | null>(initialNotice);

  const [lifecycleFeedback, setLifecycleFeedback] =
    useState<ResourceLifecycleFeedback | null>(null);

  // Automatically dismiss resource conflict messages after seven seconds.
  // Other errors remain visible until dismissed or another action begins.
  useEffect(() => {
    if (!lifecycleFeedback?.conflict) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setLifecycleFeedback(null);
    }, 7000);

    return () => window.clearTimeout(timeout);
  }, [lifecycleFeedback]);

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

        if (
          !result.resource ||
          typeof result.hasReservationHistory !== "boolean"
        ) {
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

  function handleStatusChange(action: "deactivate" | "reactivate") {
    setLifecycleFeedback(null);
    setNotice(action === "deactivate" ? "deactivated" : "reactivated");

    setData((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        resource: {
          ...current.resource,
          isActive: action === "reactivate",
        },
      };
    });

    setReloadCount((count) => count + 1);
  }

  if (missing) {
    return <ResourceNotFound />;
  }

  if (!data && !error) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />

        <main
          role="status"
          className="mx-auto max-w-4xl px-4 py-16 text-center text-muted-foreground"
        >
          Loading resource details...
        </main>
      </div>
    );
  }

  if (!data && error) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />

        <main className="mx-auto max-w-xl space-y-4 px-4 py-16">
          <p role="alert" className="text-destructive">
            {error}
          </p>

          <Button variant="outline" onClick={retry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Try Again
          </Button>
        </main>
      </div>
    );
  }

  // A failed re-fetch can display the previous data along with its error.
  if (!data) {
    return null;
  }

  const resource = data.resource;
  const isMeetingRoom = resource.type === "MEETING_ROOM";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Button asChild variant="ghost">
            <Link href="/resources">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to Resources
            </Link>
          </Button>

          <ResourceLifecycleControls
            resource={{
              id: resource.id,
              name: resource.name,
              isActive: resource.isActive,
            }}
            hasReservationHistory={data.hasReservationHistory}
            onStatusChange={handleStatusChange}
            onFeedbackChange={setLifecycleFeedback}
          />
        </div>

        {/* Allow direct booking only when the resource is active. */}
        {resource.isActive && (
          <div className="flex justify-end">
            <Button asChild>
              <Link
                href={`/reservations/new?resourceId=${encodeURIComponent(resource.id)}`}
              >
                <CalendarDays className="size-4" aria-hidden="true" />
                Reserve This Resource
              </Link>
            </Button>
          </div>
        )}

        {lifecycleFeedback && (
          <ResourceFeedbackBanner
            variant="error"
            title={
              lifecycleFeedback.conflict ? "Resource Conflict" : "Action Failed"
            }
            message={lifecycleFeedback.message}
            onDismiss={() => setLifecycleFeedback(null)}
          />
        )}

        {notice && <ResourceSuccessBanner key={notice} kind={notice} />}

        {error && (
          <ResourceFeedbackBanner
            variant="error"
            title="Unable to Load Resource"
            message={error}
            onRetry={retry}
          />
        )}

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex size-14 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                {isMeetingRoom ? (
                  <DoorOpen className="size-7" aria-hidden="true" />
                ) : (
                  <Monitor className="size-7" aria-hidden="true" />
                )}
              </div>

              <Badge
                variant="outline"
                className={
                  resource.isActive
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-warning/30 bg-warning/10 text-warning"
                }
              >
                {resource.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>

            <div>
              <CardTitle className="text-2xl">{resource.name}</CardTitle>

              <CardDescription className="mt-2">
                {isMeetingRoom ? "Meeting Room" : "Equipment"}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-8">
            <dl className="grid gap-6 border-t pt-6 sm:grid-cols-2">
              <div>
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="size-4" aria-hidden="true" />
                  Location
                </dt>
                <dd className="mt-2 font-medium">{resource.location}</dd>
              </div>

              <div>
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UsersRound className="size-4" aria-hidden="true" />
                  Capacity
                </dt>
                <dd className="mt-2 font-medium">
                  {resource.capacity ?? "Not specified"}
                </dd>
              </div>

              <div>
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserRound className="size-4" aria-hidden="true" />
                  Added By
                </dt>
                <dd className="mt-2 font-medium">{resource.createdBy.name}</dd>
              </div>

              <div>
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  Date Added
                </dt>
                <dd className="mt-2 font-medium">
                  {new Date(resource.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </dd>
              </div>
            </dl>

            <div className="space-y-3 border-t pt-6">
              <h2 className="text-lg font-semibold">Description</h2>

              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                {resource.description || "No description provided."}
              </p>
            </div>

            {!resource.isActive && (
              <p className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                This resource is currently inactive and cannot be reserved.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
