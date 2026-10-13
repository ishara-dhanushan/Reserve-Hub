import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarCheck } from "lucide-react";

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

export default function ReservationsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Reservations</h1>
        <p className="mt-2 text-muted-foreground">
          View bookings and manage your reservations.
        </p>

        <Card className="mt-8">
          <CardHeader>
            <CalendarCheck
              className="mb-3 size-9 text-muted-foreground"
              aria-hidden="true"
            />
            <CardTitle>Reservation management</CardTitle>
            <CardDescription>
              Booking lists, availability checks, and reservation actions will
              be implemented in the upcoming reservation module.
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
  );
}
