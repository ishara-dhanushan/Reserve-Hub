import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { ResourceCreateForm } from "@/app/resources/components/ResourceCreateForm";
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
  title: "Create Resource",
  description: "Register a new shared resource.",
};

async function AuthenticatedCreateResourceContent() {
  await requireUser();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <AppHeader />

        <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
          <Button asChild variant="ghost" className="mb-6">
            <Link href="/resources">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to Resources
            </Link>
          </Button>

          <Card>
            <CardHeader className="space-y-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <PackagePlus className="size-6" aria-hidden="true" />
              </div>

              <CardTitle className="text-2xl">Create Resource</CardTitle>

              <CardDescription>
                Add a meeting room or equipment item to the shared resource
                catalogue. New resources are active by default.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <ResourceCreateForm />
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default function CreateResourcePage() {
  return (
    <Suspense
      fallback={
        <main
          role="status"
          className="flex min-h-screen items-center justify-center text-muted-foreground"
        >
          Loading resource form...
        </main>
      }
    >
      <AuthenticatedCreateResourceContent />
    </Suspense>
  );
}
