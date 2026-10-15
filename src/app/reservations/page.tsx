import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarCheck, Plus } from "lucide-react";
import { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { requireUser } from "@/lib/auth/session";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Reservations",
  description: "View and manage resource reservations.",
};

async function AuthenticatedReservationsContent() {
  await requireUser();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <AppHeader />

        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Reservations
              </h1>
              <p className="mt-2 text-muted-foreground">
                Reserve meeting rooms and equipment for future time slots.
              </p>
            </div>
            <Button asChild>
              <Link href="/reservations/new">
                <Plus className="size-4" aria-hidden="true" />
                New Reservation
              </Link>
            </Button>
          </div>

          <Card className="mt-8">
            <CardHeader>
              <CalendarCheck
                className="mb-3 size-9 text-muted-foreground"
                aria-hidden="true"
              />
              <CardTitle>Reservation management</CardTitle>
              <CardDescription>
                You can create confirmed bookings now. The reservation list,
                details, and owner-only edit/cancel actions will be added in the
                next reservation management phase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/dashboard">
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back to dashboard
                </Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default function ReservationsPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-muted-foreground" role="status">
          Loading reservations...
        </main>
      }
    >
      <AuthenticatedReservationsContent />
    </Suspense>
  );
}
