"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, LoaderCircle, Plus, X } from "lucide-react";
import { ResourceType } from "@/generated/prisma/enums";
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
import {
  createResourceSchema,
  type CreateResourceInput,
} from "@/lib/validators/resources";

export function ResourceCreateForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [type, setType] = useState<CreateResourceInput["type"]>(
    ResourceType.MEETING_ROOM,
  );
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);

  // Automatically dismiss duplicate conflict banners after 7 seconds.
  useEffect(() => {
    if (!conflict) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setError("");
      setConflict(false);
    }, 7000);

    return () => window.clearTimeout(timeout);
  }, [conflict]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setConflict(false);

    const input: CreateResourceInput = {
      name,
      type,
      location,
      ...(capacity.trim() !== "" && {
        capacity: Number(capacity),
      }),
      ...(description.trim() !== "" && {
        description,
      }),
    };

    const parsed = createResourceSchema.safeParse(input);

    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? "Please check the resource details.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/resources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }

      if (!response.ok) {
        if (response.status === 409) {
          setError(
            "A resource with the same name, type, and location already exists. Please change one of these details.",
          );
          setConflict(true);
        } else if (response.status === 400) {
          setError("Please check the resource details.");
        } else if (response.status === 403) {
          setError("The request could not be authorized.");
        } else {
          setError("Unable to create resource. Please try again.");
        }

        return;
      }

      router.replace("/resources?created=1");
      router.refresh();
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="resource-name">Resource Name</Label>
        <Input
          id="resource-name"
          required
          minLength={2}
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Meeting Room A"
          disabled={submitting}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="resource-type">Resource Type</Label>
        <Select
          value={type}
          onValueChange={(value) => {
            if (
              value === ResourceType.MEETING_ROOM ||
              value === ResourceType.EQUIPMENT
            ) {
              setType(value);
            }
          }}
          disabled={submitting}
        >
          <SelectTrigger id="resource-type" className="w-full">
            <SelectValue placeholder="Select a type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ResourceType.MEETING_ROOM}>
              Meeting Room
            </SelectItem>
            <SelectItem value={ResourceType.EQUIPMENT}>Equipment</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="resource-location">Location</Label>
        <Input
          id="resource-location"
          required
          minLength={2}
          maxLength={120}
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="e.g. Second Floor"
          disabled={submitting}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="resource-capacity">Capacity (Optional)</Label>
        <Input
          id="resource-capacity"
          type="number"
          min={1}
          step={1}
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          placeholder="e.g. 10"
          disabled={submitting}
        />
        <p className="text-xs text-muted-foreground">
          Enter a positive whole number if applicable.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="resource-description">Description (Optional)</Label>
        <textarea
          id="resource-description"
          rows={4}
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the resource and its features"
          disabled={submitting}
          className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        />
        <p className="text-right text-xs text-muted-foreground">
          {description.length}/500
        </p>
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />

          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-semibold">
              {conflict ? "Duplicate Resource" : "Unable to Save"}
            </p>
            <p>{error}</p>
          </div>

          <button
            type="button"
            aria-label="Dismiss error message"
            onClick={() => {
              setError("");
              setConflict(false);
            }}
            className="rounded-md p-1 transition-colors hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
        <Button asChild variant="outline">
          <Link href="/resources">Cancel</Link>
        </Button>

        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {submitting ? "Creating..." : "Create Resource"}
        </Button>
      </div>
    </form>
  );
}
