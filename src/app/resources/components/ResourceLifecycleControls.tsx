"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ResourceDTO } from "@/lib/types/resources";

type LifecycleAction = "deactivate" | "reactivate" | "delete";

type LifecycleResource = Pick<ResourceDTO, "id" | "name" | "isActive">;

export interface ResourceLifecycleFeedback {
  message: string;
  conflict: boolean;
}

interface ResourceLifecycleControlsProps {
  resource: LifecycleResource;
  hasReservationHistory: boolean;
  onStatusChange: (action: "deactivate" | "reactivate") => void;
  onFeedbackChange: (feedback: ResourceLifecycleFeedback | null) => void;
}

export function ResourceLifecycleControls({
  resource,
  hasReservationHistory,
  onStatusChange,
  onFeedbackChange,
}: ResourceLifecycleControlsProps) {
  const router = useRouter();

  const [action, setAction] = useState<LifecycleAction | null>(null);
  const [busy, setBusy] = useState(false);

  function openConfirmation(nextAction: LifecycleAction) {
    // Clear previous feedback when beginning another action.
    onFeedbackChange(null);
    setAction(nextAction);
  }

  async function confirmAction() {
    if (action === null || busy) {
      return;
    }

    const selectedAction = action;
    setBusy(true);
    onFeedbackChange(null);

    try {
      const response = await fetch(
        `/api/resources/${resource.id}`,
        selectedAction === "delete"
          ? {
              method: "DELETE",
              credentials: "same-origin",
            }
          : {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "same-origin",
              body: JSON.stringify({
                isActive: selectedAction === "reactivate",
              }),
            },
      );

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }

      if (response.status === 404) {
        setAction(null);
        router.replace("/resources");
        router.refresh();
        return;
      }

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);

        const parsedError = z.object({ error: z.string() }).safeParse(body);

        onFeedbackChange({
          message: parsedError.success
            ? parsedError.data.error
            : "Unable to complete the requested action.",
          conflict: response.status === 409,
        });

        setAction(null);
        return;
      }

      setAction(null);

      if (selectedAction === "delete") {
        router.replace("/resources?deleted=1");
        router.refresh();
        return;
      }

      onStatusChange(selectedAction);
    } catch {
      setAction(null);

      onFeedbackChange({
        message: "Unable to connect to the server. Please try again.",
        conflict: false,
      });
    } finally {
      setBusy(false);
    }
  }

  const confirmationContent = {
    delete: {
      title: "Delete Resource Permanently?",
      description: `This will permanently delete "${resource.name}". This action cannot be undone. Deletion is only allowed when there is no reservation history.`,
      confirmLabel: "Delete Permanently",
    },
    deactivate: {
      title: "Deactivate Resource?",
      description: `Deactivate "${resource.name}"? It will remain visible, but new bookings will not be permitted. Existing reservations will be preserved. Ongoing or future confirmed bookings block deactivation.`,
      confirmLabel: "Confirm Deactivation",
    },
    reactivate: {
      title: "Reactivate Resource?",
      description: `Reactivate "${resource.name}"? It will become available for eligible new bookings again.`,
      confirmLabel: "Confirm Reactivation",
    },
  };

  const confirmation = action ? confirmationContent[action] : null;

  return (
    <div className="flex w-full flex-col items-end gap-3 sm:w-auto">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="outline">
          <Link href={`/resources/${resource.id}/edit`}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit Resource
          </Link>
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() =>
            openConfirmation(resource.isActive ? "deactivate" : "reactivate")
          }
        >
          {resource.isActive ? (
            <PowerOff className="size-4" aria-hidden="true" />
          ) : (
            <Power className="size-4" aria-hidden="true" />
          )}

          {resource.isActive ? "Deactivate" : "Reactivate"}
        </Button>

        {!hasReservationHistory && (
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => openConfirmation("delete")}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </Button>
        )}
      </div>

      {hasReservationHistory && (
        <p className="max-w-md text-right text-xs text-muted-foreground">
          Permanent deletion is unavailable because this resource has
          reservation history.
        </p>
      )}

      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setAction(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmation?.title}</DialogTitle>

            <DialogDescription>{confirmation?.description}</DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant={action === "delete" ? "destructive" : "default"}
              disabled={busy}
              onClick={() => void confirmAction()}
            >
              {busy && (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              )}

              {busy ? "Processing..." : confirmation?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
