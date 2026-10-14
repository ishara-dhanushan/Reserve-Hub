import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SignupForm } from "@/app/signup/components/SignupForm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create your ReserveHub account.",
};

async function SignupContent() {
  // Signed-in users should not register another account here.
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Join ReserveHub to reserve shared office resources.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <SignupForm />

          <Button asChild variant="ghost" className="w-full">
            <Link href="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          Checking session...
        </main>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
