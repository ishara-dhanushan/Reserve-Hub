import Link from "next/link";
import {
  ArrowUpRight,
  DoorOpen,
  MapPin,
  Monitor,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ResourceDTO } from "@/lib/types/resources";

export function ResourceCard({ resource }: { resource: ResourceDTO }) {
  const isMeetingRoom = resource.type === "MEETING_ROOM";

  return (
    <Card className="flex h-full flex-col transition-colors hover:ring-primary/30">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            {isMeetingRoom ? (
              <DoorOpen className="size-6" aria-hidden="true" />
            ) : (
              <Monitor className="size-6" aria-hidden="true" />
            )}
          </div>

          <Badge
            variant="outline"
            className={
              resource.isActive
                ? "border-success/30 bg-success/10 text-success"
                : "border-warning/30 bg-warning/10 text-warning"
            }
          >
            {resource.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        <CardTitle className="text-lg">{resource.name}</CardTitle>
        <CardDescription>
          {isMeetingRoom ? "Meeting Room" : "Equipment"}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span>{resource.location}</span>
        </p>

        {resource.capacity !== null && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <UsersRound className="size-4 shrink-0" aria-hidden="true" />
            Capacity: {resource.capacity}
          </p>
        )}

        {resource.description && (
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {resource.description}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-3 border-t pt-4">
        <p
          className="min-w-0 truncate text-xs text-muted-foreground"
          title={`Added by ${resource.createdBy.name}`}
        >
          <UserRound className="mr-1 inline size-3.5" aria-hidden="true" />
          {resource.createdBy.name}
        </p>

        <Button asChild size="sm" variant="outline">
          <Link href={`/resources/${resource.id}`}>
            Details
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
