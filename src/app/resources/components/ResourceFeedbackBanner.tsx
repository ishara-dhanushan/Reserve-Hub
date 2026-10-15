"use client";

import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResourceFeedbackBannerProps {
  variant: "success" | "error";
  message: string;
  title?: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}

/**
 * Shared notification presentation for the resource feature.
 * Visibility, timeout, and request handling remain with the caller.
 */
export function ResourceFeedbackBanner({
  variant,
  message,
  title,
  onDismiss,
  onRetry,
}: ResourceFeedbackBannerProps) {
  const isError = variant === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex w-full items-start gap-3 rounded-lg border p-4 text-sm ${
        isError
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-success/30 bg-success/10 text-success"
      }`}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      )}

      <div className="min-w-0 flex-1 space-y-2">
        {title && <p className="font-semibold">{title}</p>}

        <p className="wrap-break-word">{message}</p>

        {onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Try Again
          </Button>
        )}
      </div>

      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss notification"
          onClick={onDismiss}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
