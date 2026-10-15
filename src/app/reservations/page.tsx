import type { Metadata } from "next";
import { Suspense } from "react";
import { ReservationHistoryClient } from "@/app/reservations/components/ReservationHistoryClient";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Reservations",
  description: "Browse reservation history and manage your upcoming bookings.",
};

async function AuthenticatedReservationsContent() {
  const user = await requireUser();

  return (
    <ProtectedRoute>
      <ReservationHistoryClient currentUserId={user.id} />
    </ProtectedRoute>
  );
}

export default function ReservationsPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-muted-foreground" role="status">
          Loading reservations...
        </main>
      }
    >
      <AuthenticatedReservationsContent />
    </Suspense>
  );
}
