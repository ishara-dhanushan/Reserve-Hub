"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";
import {
  toColomboISO,
  toColomboLocal,
} from "@/app/reservations/components/reservationUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  ReservationDTO,
  ReservationErrorResponse,
  ReservationWithDetailsDTO,
  UpdateReservationResponse,
} from "@/lib/types/reservations";
import { updateReservationSchema } from "@/lib/validators/reservations";

interface ReservationEditFormProps {
  reservation: ReservationWithDetailsDTO;
  onSaved: (reservation: ReservationDTO) => void;
  onCancel: () => void;
}

export function ReservationEditForm({
  reservation,
  onSaved,
  onCancel,
}: ReservationEditFormProps) {
  const router = useRouter();
  const [purpose, setPurpose] = useState(reservation.purpose);
  const [startLocal, setStartLocal] = useState(
    toColomboLocal(reservation.startAt),
  );
  const [endLocal, setEndLocal] = useState(toColomboLocal(reservation.endAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }

    setError("");

    // Send only changed fields so a purpose edit does not round stored seconds.
    const purposeChanged = purpose.trim() !== reservation.purpose;
    const startChanged = startLocal !== toColomboLocal(reservation.startAt);
    const endChanged = endLocal !== toColomboLocal(reservation.endAt);
    const startAt = startChanged
      ? toColomboISO(startLocal)
      : reservation.startAt;
    const endAt = endChanged ? toColomboISO(endLocal) : reservation.endAt;

    if (!purposeChanged && !startChanged && !endChanged) {
      setError("Make a change before saving.");
      return;
    }

    if (
      startAt === null ||
      endAt === null ||
      Date.parse(startAt) <= Date.now() ||
      Date.parse(endAt) <= Date.parse(startAt)
    ) {
      setError("Enter a valid future start and an end time after the start.");
      return;
    }

    const parsed = updateReservationSchema.safeParse({
      ...(purposeChanged && { purpose }),
      ...(startChanged && { startAt }),
      ...(endChanged && { endAt }),
    });

    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ??
          "Please check the reservation details.",
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `/api/reservations/${encodeURIComponent(reservation.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(parsed.data),
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
            : "Unable to update the reservation. Please try again.",
        );
        return;
      }

      const body = (await response.json()) as UpdateReservationResponse;
      if (!body.reservation?.id) {
        throw new Error("Invalid reservation response.");
      }

      onSaved(body.reservation);
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Update your booking purpose or time. The selected resource and booking
        creator cannot be changed. The server checks for conflicts when saving.
      </p>

      <div className="space-y-2">
        <Label htmlFor="reservation-edit-purpose">Purpose</Label>
        <Input
          id="reservation-edit-purpose"
          value={purpose}
          required
          minLength={3}
          maxLength={200}
          disabled={saving}
          onChange={(event) => {
            setPurpose(event.target.value);
            setError("");
          }}
        />
        <p className="text-right text-xs text-muted-foreground">
          {purpose.trim().length}/200 characters
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reservation-edit-start">Start — Sri Lanka time</Label>
          <Input
            id="reservation-edit-start"
            type="datetime-local"
            step={60}
            required
            disabled={saving}
            value={startLocal}
            onChange={(event) => {
              setStartLocal(event.target.value);
              setError("");
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reservation-edit-end">End — Sri Lanka time</Label>
          <Input
            id="reservation-edit-end"
            type="datetime-local"
            step={60}
            required
            disabled={saving}
            value={endLocal}
            onChange={(event) => {
              setEndLocal(event.target.value);
              setError("");
            }}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Times are interpreted as Asia/Colombo (UTC+05:30), regardless of your
        device timezone.
      </p>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel Editing
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {saving ? "Saving Changes..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
