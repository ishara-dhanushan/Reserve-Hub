import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Package } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: { absolute: "ReserveHub" },
  description:
    "A simple way to manage shared meeting rooms, equipment, and reservations.",
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 bg-linear-to-br from-primary/10 via-background to-accent/20">
        <section className="mx-auto flex max-w-6xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
          <div className="mb-6 rounded-full border bg-secondary px-4 py-1.5 text-xs font-medium text-secondary-foreground">
            Shared Resource Management
          </div>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Reserve shared resources with ease.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Organize meeting rooms, equipment, and reservations in one
            convenient place.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Get started
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </section>

        <section
          aria-label="ReserveHub features"
          className="mx-auto grid w-full max-w-4xl gap-4 px-4 pb-20 sm:grid-cols-2 sm:px-6"
        >
          <Card>
            <CardHeader>
              <Package
                className="mb-3 size-9 rounded-lg bg-primary/10 p-2 text-primary"
                aria-hidden="true"
              />
              <CardTitle>Manage resources</CardTitle>
              <CardDescription>
                Keep your shared meeting rooms and equipment organized in one
                system.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CalendarCheck
                className="mb-3 size-9 rounded-lg bg-accent p-2 text-accent-foreground"
                aria-hidden="true"
              />
              <CardTitle>Manage reservations</CardTitle>
              <CardDescription>
                View bookings, check availability, and reserve resources without
                overlapping schedules.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
}
