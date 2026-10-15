"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, RefreshCw } from "lucide-react";
import { ReservationStatusBadge } from "@/app/reservations/components/ReservationStatusBadge";
import {
  formatColombo,
  getReservationDisplayStatus,
  useReservationClock,
} from "@/app/reservations/components/reservationUtils";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ReservationListResponse,
  ReservationWithDetailsDTO,
} from "@/lib/types/reservations";

interface ReservationHistoryClientProps {
  currentUserId: string;
}

type ReservationScope = "all" | "mine";

export function ReservationHistoryClient({
  currentUserId,
}: ReservationHistoryClientProps) {
  const router = useRouter();
  const now = useReservationClock();
  const [scope, setScope] = useState<ReservationScope>("all");
  const [reservations, setReservations] = useState<
    ReservationWithDetailsDTO[] | null
  >(null);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadReservations() {
      try {
        const path =
          scope === "mine"
            ? "/api/reservations?scope=mine"
            : "/api/reservations";
        const response = await fetch(path, {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load reservations.");
        }

        const data = (await response.json()) as ReservationListResponse;

        if (!Array.isArray(data.reservations)) {
          throw new Error("Invalid reservation response.");
        }

        if (!controller.signal.aborted) {
          setReservations(data.reservations);
          setError("");
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to load reservations. Please try again.");
        }
      }
    }

    void loadReservations();

    return () => controller.abort();
  }, [scope, reloadCount, router]);

  function selectScope(nextScope: ReservationScope) {
    if (nextScope === scope) {
      return;
    }

    setReservations(null);
    setError("");
    setScope(nextScope);
  }

  function retry() {
    setError("");
    setReservations(null);
    setReloadCount((count) => count + 1);
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto w-full max-w-6xl space-y-7 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Reservation History
            </h1>
            <p className="mt-2 text-muted-foreground">
              Browse everyone&apos;s bookings. Only creators can edit or cancel
              their own future reservations.
            </p>
          </div>

          <Button asChild>
            <Link href="/reservations/new">
              <Plus className="size-4" aria-hidden="true" />
              New Reservation
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Bookings</CardTitle>
                <CardDescription className="mt-1">
                  All dates and times use Sri Lanka time (UTC+05:30).
                </CardDescription>
              </div>

              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Reservation scope"
              >
                <Button
                  type="button"
                  size="sm"
                  variant={scope === "all" ? "default" : "outline"}
                  aria-pressed={scope === "all"}
                  onClick={() => selectScope("all")}
                >
                  All
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={scope === "mine" ? "default" : "outline"}
                  aria-pressed={scope === "mine"}
                  onClick={() => selectScope("mine")}
                >
                  Mine
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={retry}
                  aria-label="Refresh reservations"
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="space-y-3" role="alert">
                <p className="text-sm text-destructive">{error}</p>
                <Button type="button" variant="outline" onClick={retry}>
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Try Again
                </Button>
              </div>
            )}

            {!reservations && !error && (
              <p
                className="py-12 text-center text-muted-foreground"
                role="status"
              >
                Loading reservations...
              </p>
            )}

            {reservations?.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <CalendarDays
                  className="size-10 text-primary"
                  aria-hidden="true"
                />
                <div className="space-y-2">
                  <p className="font-semibold">
                    {scope === "mine"
                      ? "You have no reservations yet"
                      : "No reservations yet"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {scope === "mine"
                      ? "Bookings you create will appear here."
                      : "Create the first booking to start the shared history."}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href="/reservations/new">Create Reservation</Link>
                </Button>
              </div>
            )}

            {reservations && reservations.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  {reservations.length}{" "}
                  {reservations.length === 1 ? "reservation" : "reservations"}
                  {scope === "mine"
                    ? " created by you"
                    : " across the organization"}
                </p>

                <div className="grid gap-3 md:hidden">
                  {reservations.map((reservation) => (
                    <Card key={reservation.id} className="gap-0">
                      <CardContent className="space-y-3 pt-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {reservation.resource.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {reservation.purpose}
                            </p>
                          </div>
                          {now !== null ? (
                            <ReservationStatusBadge
                              status={getReservationDisplayStatus(
                                reservation,
                                now,
                              )}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Checking status...
                            </span>
                          )}
                        </div>
                        <p className="text-sm">
                          {formatColombo(reservation.startAt)} –{" "}
                          {formatColombo(reservation.endAt)}
                        </p>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-muted-foreground">
                            By{" "}
                            {reservation.userId === currentUserId
                              ? "you"
                              : reservation.creator.name}
                          </p>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/reservations/${reservation.id}`}>
                              View Details
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Resource / Purpose</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reservations.map((reservation) => (
                        <TableRow key={reservation.id}>
                          <TableCell className="max-w-60 whitespace-normal">
                            <p className="font-medium">
                              {reservation.resource.name}
                            </p>
                            <p className="text-xs text-muted-foreground wrap-break-word">
                              {reservation.purpose}
                            </p>
                          </TableCell>
                          <TableCell>
                            {formatColombo(reservation.startAt)}
                          </TableCell>
                          <TableCell>
                            {formatColombo(reservation.endAt)}
                          </TableCell>
                          <TableCell>
                            {reservation.userId === currentUserId
                              ? "You"
                              : reservation.creator.name}
                          </TableCell>
                          <TableCell>
                            {now !== null ? (
                              <ReservationStatusBadge
                                status={getReservationDisplayStatus(
                                  reservation,
                                  now,
                                )}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Checking...
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/reservations/${reservation.id}`}>
                                View
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
