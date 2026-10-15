import { Badge } from "@/components/ui/badge";
import type { ReservationDisplayStatus } from "@/app/reservations/components/reservationUtils";

interface ReservationStatusBadgeProps {
  status: ReservationDisplayStatus;
}

export function ReservationStatusBadge({
  status,
}: ReservationStatusBadgeProps) {
  const styles: Record<ReservationDisplayStatus, string> = {
    Upcoming: "border-success/30 bg-success/10 text-success",
    Ongoing: "border-primary/30 bg-primary/10 text-primary",
    Completed: "border-border bg-muted text-muted-foreground",
    Cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
  };

  return (
    <Badge variant="outline" className={styles[status]}>
      {status}
    </Badge>
  );
}
