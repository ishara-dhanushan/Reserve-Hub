import Link from "next/link";
import { ArrowLeft, PackageX } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ResourceNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto flex max-w-xl items-center px-4 py-20">
        <Card className="w-full">
          <CardHeader className="items-center text-center">
            <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <PackageX className="size-7" aria-hidden="true" />
            </div>

            <CardTitle className="text-xl">Resource Not Found</CardTitle>

            <CardDescription>
              This resource does not exist or may have been deleted.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/resources">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to Resources
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
