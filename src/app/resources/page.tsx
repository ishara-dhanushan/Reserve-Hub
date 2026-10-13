import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";

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
  title: "Resources",
  description: "Browse and manage shared resources.",
};

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Resources</h1>
        <p className="mt-2 text-muted-foreground">
          Manage meeting rooms and shared equipment.
        </p>

        <Card className="mt-8">
          <CardHeader>
            <Package
              className="mb-3 size-9 text-muted-foreground"
              aria-hidden="true"
            />
            <CardTitle>Resource management</CardTitle>
            <CardDescription>
              Resource listings and management actions will be implemented in
              the upcoming resource module.
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
