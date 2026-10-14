"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ResourcesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <AlertCircle
            className="mb-2 size-9 text-destructive"
            aria-hidden="true"
          />

          <CardTitle>Unable to load resources</CardTitle>

          <CardDescription>
            Something went wrong while loading the resource catalogue. Please
            try again.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={reset}>Try Again</Button>

          <Button asChild variant="outline">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
