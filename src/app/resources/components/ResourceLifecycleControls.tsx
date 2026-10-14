"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  LoaderCircle,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  X,
} from "lucide-react";
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

interface ResourceLifecycleControlsProps {
  resource: LifecycleResource;
  hasReservationHistory: boolean;
  onStatusChange: (action: "deactivate" | "reactivate") => void;
}

export function ResourceLifecycleControls({
  resource,
  hasReservationHistory,
  onStatusChange,
}: ResourceLifecycleControlsProps) {
  const router = useRouter();

  const [action, setAction] = useState<LifecycleAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    conflict: boolean;
  } | null>(null);

  // Dismiss conflict messages after seven seconds.
  useEffect(() => {
    if (!feedback?.conflict) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setFeedback(null);
    }, 7000);

    return () => window.clearTimeout(timeout);
  }, [feedback]);

  function openConfirmation(nextAction: LifecycleAction) {
    setFeedback(null);
    setAction(nextAction);
  }

  async function confirmAction() {
    if (action === null || busy) {
      return;
    }

    const selectedAction = action;
    setBusy(true);
    setFeedback(null);

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

        setFeedback({
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
      setFeedback({
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

      {feedback && (
        <div
          role="alert"
          className="flex w-full max-w-md items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />

          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-semibold">
              {feedback.conflict ? "Resource Conflict" : "Action Failed"}
            </p>
            <p>{feedback.message}</p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss error"
            onClick={() => setFeedback(null)}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
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
