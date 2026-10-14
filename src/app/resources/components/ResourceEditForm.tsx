"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, LoaderCircle, Save, X } from "lucide-react";
import { z } from "zod";
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
import type { ResourceDTO } from "@/lib/types/resources";
import { updateResourceSchema } from "@/lib/validators/resources";

type EditableResource = Pick<
  ResourceDTO,
  "id" | "name" | "type" | "location" | "capacity" | "description"
>;

export function ResourceEditForm({ resource }: { resource: EditableResource }) {
  const router = useRouter();

  const [name, setName] = useState(resource.name);
  const [type, setType] = useState(resource.type);
  const [location, setLocation] = useState(resource.location);
  const [capacity, setCapacity] = useState(resource.capacity?.toString() ?? "");
  const [description, setDescription] = useState(resource.description ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    conflict: boolean;
  } | null>(null);

  useEffect(() => {
    if (!feedback?.conflict) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setFeedback(null);
    }, 7000);

    return () => window.clearTimeout(timeout);
  }, [feedback]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const parsed = updateResourceSchema.safeParse({
      name,
      type,
      location,
      capacity: capacity.trim() === "" ? null : Number(capacity),
      description: description.trim() === "" ? null : description,
    });

    if (!parsed.success) {
      setFeedback({
        message:
          parsed.error.issues[0]?.message ??
          "Please check the resource details.",
        conflict: false,
      });
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/resources/${resource.id}`, {
        method: "PATCH",
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
        const body: unknown = await response.json().catch(() => null);

        const parsedError = z.object({ error: z.string() }).safeParse(body);

        setFeedback({
          message: parsedError.success
            ? parsedError.data.error
            : "Unable to update the resource.",
          conflict: response.status === 409,
        });
        return;
      }

      router.replace(`/resources/${resource.id}?updated=1`);
      router.refresh();
    } catch {
      setFeedback({
        message: "Unable to connect to the server. Please try again.",
        conflict: false,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="edit-resource-name">Resource Name</Label>
        <Input
          id="edit-resource-name"
          required
          minLength={2}
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={saving}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-resource-type">Resource Type</Label>
        <Select
          value={type}
          disabled={saving}
          onValueChange={(value) => {
            if (
              value === ResourceType.MEETING_ROOM ||
              value === ResourceType.EQUIPMENT
            ) {
              setType(value);
            }
          }}
        >
          <SelectTrigger id="edit-resource-type" className="w-full">
            <SelectValue />
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
        <Label htmlFor="edit-resource-location">Location</Label>
        <Input
          id="edit-resource-location"
          required
          minLength={2}
          maxLength={120}
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          disabled={saving}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-resource-capacity">Capacity (Optional)</Label>
        <Input
          id="edit-resource-capacity"
          type="number"
          min={1}
          step={1}
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          disabled={saving}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-resource-description">
          Description (Optional)
        </Label>
        <textarea
          id="edit-resource-description"
          rows={4}
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={saving}
          className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p className="text-right text-xs text-muted-foreground">
          {description.length}/500
        </p>
      </div>

      {feedback && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />

          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-semibold">
              {feedback.conflict ? "Resource Conflict" : "Unable to Save"}
            </p>
            <p>{feedback.message}</p>
          </div>

          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setFeedback(null)}
            className="rounded-md p-1 hover:bg-destructive/10"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
        <Button asChild variant="outline">
          <Link href={`/resources/${resource.id}`}>Cancel</Link>
        </Button>

        <Button type="submit" disabled={saving}>
          {saving ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
