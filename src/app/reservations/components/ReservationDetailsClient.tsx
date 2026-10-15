"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  LoaderCircle,
  Pencil,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { ReservationEditForm } from "@/app/reservations/components/ReservationEditForm";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  CancelReservationResponse,
  ReservationDetailResponse,
  ReservationDTO,
  ReservationErrorResponse,
  ReservationWithDetailsDTO,
} from "@/lib/types/reservations";

interface ReservationDetailsClientProps {
  reservationId: string;
  currentUserId: string;
}

export function ReservationDetailsClient({
  reservationId,
  currentUserId,
}: ReservationDetailsClientProps) {
  const router = useRouter();
  const now = useReservationClock();
  const [reservation, setReservation] =
    useState<ReservationWithDetailsDTO | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadReservation() {
      try {
        const response = await fetch(
          `/api/reservations/${encodeURIComponent(reservationId)}`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (controller.signal.aborted) {
          return;
        }

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (response.status === 404 || response.status === 400) {
          setMissing(true);
          setReservation(null);
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load reservation.");
        }

        const body = (await response.json()) as ReservationDetailResponse;
        if (!body.reservation?.id) {
          throw new Error("Invalid reservation response.");
        }

        if (!controller.signal.aborted) {
          setReservation(body.reservation);
          setError("");
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to load the reservation. Please try again.");
        }
      }
    }

    void loadReservation();

    return () => controller.abort();
  }, [reservationId, reloadCount, router]);

  function retry() {
    setError("");
    setMissing(false);
    setReservation(null);
    setReloadCount((count) => count + 1);
  }

  function onSaved(updated: ReservationDTO) {
    setReservation((current) => (current ? { ...current, ...updated } : null));
    setEditing(false);
    setError("");
    setFeedback("Reservation updated successfully.");
  }

  async function cancelBooking() {
    if (!reservation || cancelling) {
      return;
    }

    setError("");
    setFeedback("");
    setCancelling(true);

    try {
      const response = await fetch(
        `/api/reservations/${encodeURIComponent(reservation.id)}/cancel`,
        {
          method: "POST",
          credentials: "same-origin",
        },
      );

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }

      if (!response.ok) {
        const body = (await response
          .json()
          .catch(() => null)) as ReservationErrorResponse | null;
        setError(
          typeof body?.error === "string"
            ? body.error
            : "Unable to cancel the reservation. Please try again.",
        );
        setConfirmCancel(false);
        return;
      }

      const body = (await response.json()) as CancelReservationResponse;
      if (!body.reservation?.id) {
        throw new Error("Invalid cancellation response.");
      }

      setReservation((current) =>
        current ? { ...current, ...body.reservation } : null,
      );
      setEditing(false);
      setConfirmCancel(false);
      setFeedback(
        "Reservation cancelled. Its time slot is available for new bookings.",
      );
    } catch {
      setError("Unable to connect to the server. Please try again.");
      setConfirmCancel(false);
    } finally {
      setCancelling(false);
    }
  }

  const isOwner = reservation?.userId === currentUserId;
  const isUpcoming =
    reservation !== null &&
    reservation.status === "CONFIRMED" &&
    now !== null &&
    Date.parse(reservation.startAt) > now;
  const canCancel = isOwner && isUpcoming;
  const canEdit = canCancel && reservation?.resource.isActive === true;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <Button asChild variant="ghost">
          <Link href="/reservations">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Reservations
          </Link>
        </Button>

        {missing ? (
          <Card>
            <CardContent className="space-y-3 py-12 text-center">
              <CalendarDays
                className="mx-auto size-10 text-muted-foreground"
                aria-hidden="true"
              />
              <h1 className="text-xl font-semibold">Reservation not found</h1>
              <p className="text-muted-foreground">
                This reservation does not exist or the link is invalid.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {feedback && (
              <p
                role="status"
                className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success"
              >
                {feedback}
              </p>
            )}

            {error && (
              <div className="space-y-3" role="alert">
                <p className="text-sm text-destructive">{error}</p>
                <Button type="button" variant="outline" onClick={retry}>
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Try Again
                </Button>
              </div>
            )}

            {!reservation && !error && (
              <p
                className="py-12 text-center text-muted-foreground"
                role="status"
              >
                Loading reservation...
              </p>
            )}

            {reservation && (
              <>
                <Card>
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex size-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                        <CalendarDays className="size-6" aria-hidden="true" />
                      </div>
                      {now !== null ? (
                        <ReservationStatusBadge
                          status={getReservationDisplayStatus(reservation, now)}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Checking status...
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-2xl">
                      {reservation.resource.name}
                    </CardTitle>
                    <CardDescription>
                      {reservation.resource.type === "MEETING_ROOM"
                        ? "Meeting Room"
                        : "Equipment"}{" "}
                      · {reservation.resource.location}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <dl className="grid gap-5 border-t pt-5 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm text-muted-foreground">
                          Start — Sri Lanka time
                        </dt>
                        <dd className="mt-1 font-medium">
                          {formatColombo(reservation.startAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">
                          End — Sri Lanka time
                        </dt>
                        <dd className="mt-1 font-medium">
                          {formatColombo(reservation.endAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">
                          Created by
                        </dt>
                        <dd className="mt-1 font-medium">
                          {isOwner
                            ? `${reservation.creator.name} (you)`
                            : reservation.creator.name}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">
                          Created on
                        </dt>
                        <dd className="mt-1 font-medium">
                          {formatColombo(reservation.createdAt)}
                        </dd>
                      </div>
                    </dl>

                    <div className="space-y-2 border-t pt-5">
                      <h2 className="font-semibold">Purpose</h2>
                      <p className="whitespace-pre-wrap wrap-break-word text-sm">
                        {reservation.purpose}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                      <Button asChild variant="outline">
                        <Link href={`/resources/${reservation.resourceId}`}>
                          View Resource
                        </Link>
                      </Button>

                      <div className="flex flex-wrap gap-2">
                        {canEdit && !editing && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setEditing(true);
                              setError("");
                              setFeedback("");
                            }}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                            Edit Reservation
                          </Button>
                        )}
                        {canCancel && !editing && (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                              setConfirmCancel(true);
                              setError("");
                            }}
                          >
                            <XCircle className="size-4" aria-hidden="true" />
                            Cancel Reservation
                          </Button>
                        )}
                      </div>
                    </div>

                    {!canCancel && now !== null && (
                      <p className="text-sm text-muted-foreground">
                        {isOwner
                          ? "This booking is view-only because it has started, ended, or been cancelled."
                          : "Only the booking creator can edit or cancel a future reservation."}
                      </p>
                    )}
                    {canCancel && !canEdit && (
                      <p className="text-sm text-muted-foreground">
                        This resource is inactive, so rescheduling is
                        unavailable. You can still cancel the booking.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {editing && canEdit && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Edit Reservation</CardTitle>
                      <CardDescription>
                        Changes must keep this reservation in the future.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ReservationEditForm
                        key={reservation.id}
                        reservation={reservation}
                        onSaved={onSaved}
                        onCancel={() => setEditing(false)}
                      />
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </main>

      <Dialog
        open={confirmCancel}
        onOpenChange={(open) => {
          if (!open && !cancelling) {
            setConfirmCancel(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this reservation?</DialogTitle>
            <DialogDescription>
              The reservation will remain in history, but the time slot will be
              available for new bookings. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={cancelling}
              onClick={() => setConfirmCancel(false)}
            >
              Keep Reservation
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelling}
              onClick={() => void cancelBooking()}
            >
              {cancelling && (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {cancelling ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
