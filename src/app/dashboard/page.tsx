import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Package } from "lucide-react";
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
  title: "Dashboard",
  description: "Manage shared resources and reservations.",
};

const sections = [
  {
    title: "Resources",
    description: "View and manage meeting rooms and shared equipment.",
    href: "/resources",
    icon: Package,
  },
  {
    title: "Reservations",
    description: "View bookings and manage your reservations.",
    href: "/reservations",
    icon: CalendarDays,
  },
];

async function AuthenticatedDashboardContent() {
  // This check must finish before protected data is queried or rendered.
  await requireUser();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <AppHeader />

        <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-2 text-muted-foreground">
              Manage your shared resources and reservations.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {sections.map((section) => {
              const Icon = section.icon;

              return (
                <Card key={section.href}>
                  <CardHeader>
                    <Icon
                      className="mb-3 size-8 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <CardTitle>{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </CardHeader>

                  <CardContent>
                    <Button asChild variant="outline">
                      <Link href={section.href}>
                        Open {section.title}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-muted-foreground" role="status">
          Loading dashboard...
        </main>
      }
    >
      <AuthenticatedDashboardContent />
    </Suspense>
  );
}
