import type { Metadata } from "next";
import { Suspense } from "react";
import { ReservationDetailsClient } from "@/app/reservations/components/ReservationDetailsClient";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Reservation Details",
  description: "View a booking and manage it if you are its creator.",
};

type PageProps = {
  params: Promise<{ reservationId: string }>;
};

async function AuthenticatedReservationDetailsContent({ params }: PageProps) {
  const user = await requireUser();
  const { reservationId } = await params;

  return (
    <ProtectedRoute>
      <ReservationDetailsClient
        key={reservationId}
        reservationId={reservationId}
        currentUserId={user.id}
      />
    </ProtectedRoute>
  );
}

export default function ReservationDetailsPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-muted-foreground" role="status">
          Loading reservation...
        </main>
      }
    >
      <AuthenticatedReservationDetailsContent params={params} />
    </Suspense>
  );
}
