import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ArrowLeft,
  CalendarDays,
  DoorOpen,
  MapPin,
  Monitor,
  UserRound,
  UsersRound,
} from "lucide-react";
import { z } from "zod";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ResourceLifecycleControls } from "@/app/resources/components/ResourceLifecycleControls";
import { ResourceSuccessBanner } from "@/app/resources/components/ResourceSuccessBanner";
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
import { requireUser } from "@/lib/auth/session";
import {
  getResourceById,
  hasResourceReservationHistory,
} from "@/lib/services/resources";

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
  const parsed = z.uuid().safeParse(resourceId);

  if (!parsed.success) {
    notFound();
  }

  const resource = await getResourceById(parsed.data);

  if (!resource) {
    notFound();
  }

  const hasReservationHistory = await hasResourceReservationHistory(
    resource.id,
  );

  const isMeetingRoom = resource.type === "MEETING_ROOM";

  const { updated, deactivated, reactivated } = await searchParams;

  return (
    <ProtectedRoute>
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
              hasReservationHistory={hasReservationHistory}
            />
          </div>

          {updated === "1" && <ResourceSuccessBanner kind="updated" />}
          {deactivated === "1" && <ResourceSuccessBanner kind="deactivated" />}
          {reactivated === "1" && <ResourceSuccessBanner kind="reactivated" />}

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
                  <dd className="mt-2 font-medium">
                    {resource.createdBy.name}
                  </dd>
                </div>

                <div>
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="size-4" aria-hidden="true" />
                    Date Added
                  </dt>
                  <dd className="mt-2 font-medium">
                    {resource.createdAt.toLocaleDateString("en-GB", {
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
    </ProtectedRoute>
  );
}

export default function ResourceDetailPage({
  params,
  searchParams,
}: ResourceDetailPageProps) {
  return (
    <Suspense
      fallback={
        <main
          role="status"
          className="flex min-h-screen items-center justify-center text-muted-foreground"
        >
          Loading resource details...
        </main>
      }
    >
      <AuthenticatedResourceDetails
        params={params}
        searchParams={searchParams}
      />
    </Suspense>
  );
}
