"use client";

import { useEffect, useState } from "react";
import type { ReservationDTO } from "@/lib/types/reservations";

const COLOMBO_OFFSET_MINUTES = 330;

export type ReservationDisplayStatus =
  "Upcoming" | "Ongoing" | "Completed" | "Cancelled";

// Use the browser clock only inside an effect to keep rendering pure.
export function useReservationClock(): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timeout = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 30_000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  return now;
}

// Display statuses are derived, not stored in the database.
export function getReservationDisplayStatus(
  reservation: ReservationDTO,
  now: number,
): ReservationDisplayStatus {
  if (reservation.status === "CANCELLED") {
    return "Cancelled";
  }

  if (Date.parse(reservation.startAt) > now) {
    return "Upcoming";
  }

  if (Date.parse(reservation.endAt) > now) {
    return "Ongoing";
  }

  return "Completed";
}

export function formatColombo(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo",
  }).format(new Date(iso));
}

// Convert a stored UTC instant into a datetime-local input value in Colombo time.
export function toColomboLocal(iso: string): string {
  return new Date(Date.parse(iso) + COLOMBO_OFFSET_MINUTES * 60_000)
    .toISOString()
    .slice(0, 16);
}

// A datetime-local input has no timezone. Interpret it in Asia/Colombo.
export function toColomboISO(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}:00+05:30`);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  // Reject impossible calendar dates that JavaScript would normalize.
  const reconstructed = new Date(
    date.getTime() + COLOMBO_OFFSET_MINUTES * 60_000,
  )
    .toISOString()
    .slice(0, 16);

  return reconstructed === value ? date.toISOString() : null;
}
