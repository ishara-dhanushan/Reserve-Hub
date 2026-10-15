import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { ReservationCreateForm } from "@/app/reservations/components/ReservationCreateForm";
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

export const metadata: Metadata = {
  title: "New Reservation",
  description: "Reserve an available meeting room or equipment item.",
};

type PageProps = {
  searchParams: Promise<{ resourceId?: string }>;
};

async function AuthenticatedCreateReservationContent({
  searchParams,
}: PageProps) {
  await requireUser();
  const { resourceId } = await searchParams;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
          <Button asChild variant="ghost" className="mb-6">
            <Link href="/reservations">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to Reservations
            </Link>
          </Button>
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <CalendarPlus className="size-6" aria-hidden="true" />
              </div>
              <CardTitle className="text-2xl">New Reservation</CardTitle>
              <CardDescription>
                Select an active resource, check a future time slot, and confirm
                your booking. All times use Sri Lanka time (UTC+05:30).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReservationCreateForm initialResourceId={resourceId} />
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default function NewReservationPage({ searchParams }: PageProps) {
  return (
    <Suspense
      fallback={
        <main role="status" className="p-8 text-muted-foreground">
          Loading reservation form...
        </main>
      }
    >
      <AuthenticatedCreateReservationContent searchParams={searchParams} />
    </Suspense>
  );
}
