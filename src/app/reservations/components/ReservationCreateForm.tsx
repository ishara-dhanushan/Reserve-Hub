"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck2, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CreateReservationResponse,
  ReservationDTO,
  ReservationErrorResponse,
  ResourceAvailabilityResponse,
} from "@/lib/types/reservations";
import type { ResourceDTO, ResourceListResponse } from "@/lib/types/resources";
import { createReservationSchema } from "@/lib/validators/reservations";

const COLOMBO_OFFSET_MINUTES = 330;

// datetime-local has no timezone. Interpret its value as Asia/Colombo,
// which uses UTC+05:30 year-round, regardless of the viewer's device zone.
function toColomboISO(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}:00+05:30`);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  // Reject impossible dates that JavaScript would silently normalize.
  const reconstructed = new Date(
    date.getTime() + COLOMBO_OFFSET_MINUTES * 60_000,
  )
    .toISOString()
    .slice(0, 16);

  return reconstructed === value ? date.toISOString() : null;
}

function formatColombo(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo",
  }).format(new Date(iso));
}

type AvailabilityCheck = {
  key: string;
  result: ResourceAvailabilityResponse;
};

type AvailabilityFailure = {
  key: string;
  message: string;
};

export function ReservationCreateForm({
  initialResourceId,
}: {
  initialResourceId?: string;
}) {
  const router = useRouter();
  const [resources, setResources] = useState<ResourceDTO[] | null>(null);
  const [resourcesError, setResourcesError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [resourceId, setResourceId] = useState(initialResourceId ?? "");
  const [purpose, setPurpose] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [checked, setChecked] = useState<AvailabilityCheck | null>(null);
  const [checkError, setCheckError] = useState<AvailabilityFailure | null>(
    null,
  );
  const [checkingKey, setCheckingKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmed, setConfirmed] = useState<ReservationDTO | null>(null);
  const [now, setNow] = useState<number | null>(null);

  // Clear the previous booking when starting a new reservation.
  const resetForm = useCallback(() => {
    setResourceId(initialResourceId ?? "");
    setPurpose("");
    setStartLocal("");
    setEndLocal("");
    setChecked(null);
    setCheckError(null);
    setCheckingKey(null);
    setFormError("");
    setConfirmed(null);
  }, [initialResourceId]);

  // Next.js preserves page state across navigation.
  // Reset the form when this page becomes hidden.
  useLayoutEffect(() => {
    return () => {
      resetForm();
    };
  }, [resetForm]);

  // Keep future-interval validation current without reading the clock during render.
  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    const initialTimeout = window.setTimeout(updateNow, 0);
    const interval = window.setInterval(updateNow, 30_000);

    return () => {
      window.clearTimeout(initialTimeout);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadResources() {
      try {
        const response = await fetch("/api/resources", {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          throw new Error("Unable to load resources.");
        }

        const result = (await response.json()) as ResourceListResponse;
        if (!Array.isArray(result.resources)) {
          throw new Error("Invalid resource response.");
        }
        if (!controller.signal.aborted) {
          setResources(result.resources);
          setResourcesError("");
        }
      } catch {
        if (!controller.signal.aborted) {
          setResourcesError("Unable to load resources. Please try again.");
        }
      }
    }

    void loadResources();
    return () => controller.abort();
  }, [router, reloadCount]);

  const activeResources =
    resources?.filter((resource) => resource.isActive) ?? [];
  const selectedResource = activeResources.find(
    (resource) => resource.id === resourceId,
  );
  const selectedResourceId = selectedResource?.id ?? null;

  const startAt = toColomboISO(startLocal);
  const endAt = toColomboISO(endLocal);
  const intervalValid =
    startAt !== null &&
    endAt !== null &&
    now !== null &&
    Date.parse(startAt) > now &&
    Date.parse(endAt) > Date.parse(startAt);

  // Keys prevent a previous availability response from being displayed
  // after the user changes the resource or interval.
  const previewKey =
    selectedResourceId && intervalValid
      ? `${selectedResourceId}|${startAt}|${endAt}`
      : null;
  const availability = checked?.key === previewKey ? checked.result : null;
  const availabilityError =
    checkError?.key === previewKey ? checkError.message : "";
  const checking = previewKey !== null && checkingKey === previewKey;

  useEffect(() => {
    // Do not schedule a request unless all inputs are valid and non-null.
    if (
      previewKey === null ||
      selectedResourceId === null ||
      startAt === null ||
      endAt === null
    ) {
      return;
    }

    // Build the URL before entering the delayed async callback. TypeScript
    // can safely narrow these values here, and the callback only sees strings.
    const requestKey: string = previewKey;
    const query = new URLSearchParams({ startAt, endAt });
    const requestUrl = `/api/resources/${encodeURIComponent(selectedResourceId)}/availability?${query.toString()}`;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setCheckingKey(requestKey);

      async function checkAvailability() {
        try {
          const response = await fetch(requestUrl, {
            method: "GET",
            headers: { Accept: "application/json" },
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          });

          if (response.status === 401) {
            router.replace("/login");
            return;
          }
          if (!response.ok) {
            throw new Error("Availability lookup failed.");
          }

          const result =
            (await response.json()) as ResourceAvailabilityResponse;
          if (typeof result.available !== "boolean") {
            throw new Error("Invalid availability response.");
          }

          if (!controller.signal.aborted) {
            setChecked({ key: requestKey, result });
            setCheckError(null);
          }
        } catch {
          if (!controller.signal.aborted) {
            setCheckError({
              key: requestKey,
              message:
                "Availability could not be checked. The server will still validate your booking.",
            });
          }
        } finally {
          if (!controller.signal.aborted) {
            setCheckingKey(null);
          }
        }
      }

      void checkAvailability();
    }, 400);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [previewKey, selectedResourceId, startAt, endAt, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setFormError("");

    const parsed = createReservationSchema.safeParse({
      resourceId,
      purpose,
      startAt,
      endAt,
    });

    if (!parsed.success) {
      setFormError(
        parsed.error.issues[0]?.message ??
          "Please check the reservation details.",
      );
      return;
    }

    if (!selectedResource) {
      setFormError("Please select an active resource.");
      return;
    }

    if (availability?.available === false) {
      setFormError(
        "This resource is unavailable during the selected interval.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }

      if (!response.ok) {
        const errorBody = (await response
          .json()
          .catch(() => null)) as ReservationErrorResponse | null;

        if (response.status === 409 && previewKey) {
          if (errorBody?.code === "RESERVATION_CONFLICT") {
            setChecked({
              key: previewKey,
              result: { available: false, reason: "CONFLICT" },
            });
          } else if (errorBody?.code === "RESOURCE_INACTIVE") {
            setChecked({
              key: previewKey,
              result: { available: false, reason: "INACTIVE" },
            });
          }
        }

        setFormError(
          typeof errorBody?.error === "string"
            ? errorBody.error
            : "Unable to create the reservation. Please try again.",
        );
        return;
      }

      const result = (await response.json()) as CreateReservationResponse;
      if (!result.reservation?.id) {
        throw new Error("Invalid reservation response.");
      }
      setConfirmed(result.reservation);
    } catch {
      setFormError("Unable to connect to the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!resources) {
    return (
      <div className="space-y-4" role="status">
        <p className="text-sm text-muted-foreground">
          {resourcesError || "Loading resources..."}
        </p>
        {resourcesError && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setResourcesError("");
              setReloadCount((count) => count + 1);
            }}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  if (confirmed) {
    const bookedResource = resources.find(
      (resource) => resource.id === confirmed.resourceId,
    );

    return (
      <div className="space-y-5">
        <div
          role="status"
          className="space-y-3 rounded-lg border border-success/30 bg-success/10 p-5 text-success"
        >
          <div className="flex items-center gap-2 font-semibold">
            <CalendarCheck2 className="size-5" aria-hidden="true" />
            Reservation confirmed
          </div>
          <p className="text-sm">
            {bookedResource?.name ?? "Resource"} was reserved successfully.
          </p>
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="inline font-medium">Start: </dt>
              <dd className="inline">{formatColombo(confirmed.startAt)}</dd>
            </div>
            <div>
              <dt className="inline font-medium">End: </dt>
              <dd className="inline">{formatColombo(confirmed.endAt)}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Purpose: </dt>
              <dd className="inline">{confirmed.purpose}</dd>
            </div>
          </dl>
          <p className="text-xs">
            All times shown in Sri Lanka time (UTC+05:30).
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={resetForm}>
            Book another time
          </Button>
          <Button asChild variant="outline">
            <Link href="/reservations">Back to Reservations</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="reservation-resource">Resource</Label>
        <Select
          value={selectedResource?.id ?? ""}
          onValueChange={(value) => {
            setResourceId(value);
            setFormError("");
          }}
          disabled={submitting || activeResources.length === 0}
        >
          <SelectTrigger id="reservation-resource" className="w-full">
            <SelectValue placeholder="Choose an active resource" />
          </SelectTrigger>
          <SelectContent>
            {activeResources.map((resource) => (
              <SelectItem key={resource.id} value={resource.id}>
                {resource.name} — {resource.location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeResources.length === 0 ? (
          <p className="text-sm text-warning" role="status">
            No active resources are currently available for booking.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Only active meeting rooms and equipment can be reserved.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reservation-start">Start — Sri Lanka time</Label>
          <Input
            id="reservation-start"
            type="datetime-local"
            step={60}
            required
            value={startLocal}
            onChange={(event) => {
              setStartLocal(event.target.value);
              setFormError("");
            }}
            disabled={submitting}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reservation-end">End — Sri Lanka time</Label>
          <Input
            id="reservation-end"
            type="datetime-local"
            step={60}
            required
            value={endLocal}
            onChange={(event) => {
              setEndLocal(event.target.value);
              setFormError("");
            }}
            disabled={submitting}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Times are interpreted as Asia/Colombo (UTC+05:30), regardless of your
        device timezone. The start must be in the future and the end must be
        later.
      </p>
      {startLocal && endLocal && !intervalValid && (
        <p className="text-sm text-destructive" role="alert">
          Enter a valid future start and an end time after the start.
        </p>
      )}

      <div
        className="rounded-lg border border-border bg-muted/30 p-4 text-sm"
        aria-live="polite"
      >
        <p className="font-medium">Availability</p>
        {!selectedResource || !startLocal || !endLocal ? (
          <p className="mt-1 text-muted-foreground">
            Choose a resource and time interval to check availability.
          </p>
        ) : !intervalValid ? (
          <p className="mt-1 text-muted-foreground">
            Enter a valid future interval to check availability.
          </p>
        ) : checking || (!availability && !availabilityError) ? (
          <p className="mt-1 flex items-center gap-2 text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Checking availability...
          </p>
        ) : availability?.available ? (
          <p className="mt-1 font-medium text-success">
            Available for the selected time.
          </p>
        ) : availability?.reason === "INACTIVE" ? (
          <p className="mt-1 text-destructive">This resource is inactive.</p>
        ) : availability?.reason === "CONFLICT" ? (
          <p className="mt-1 text-destructive">
            This interval conflicts with an existing booking.
          </p>
        ) : (
          <p className="mt-1 text-warning">{availabilityError}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Availability is a preview. The server checks again when you submit.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-purpose">Purpose</Label>
        <Input
          id="reservation-purpose"
          required
          minLength={3}
          maxLength={200}
          value={purpose}
          onChange={(event) => {
            setPurpose(event.target.value);
            setFormError("");
          }}
          placeholder="e.g. Team planning meeting"
          disabled={submitting}
        />
        <p className="text-right text-xs text-muted-foreground">
          {purpose.trim().length}/200 characters
        </p>
      </div>

      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {formError}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
        <Button asChild variant="outline">
          <Link href="/reservations">Cancel</Link>
        </Button>
        <Button
          type="submit"
          disabled={
            submitting ||
            !selectedResource ||
            !intervalValid ||
            purpose.trim().length < 3 ||
            checking ||
            availability?.available === false
          }
        >
          {submitting && (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          )}
          {submitting ? "Creating Reservation..." : "Confirm Reservation"}
        </Button>
      </div>
    </form>
  );
}
