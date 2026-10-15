"use client";

import { useEffect, useState } from "react";
import { ResourceFeedbackBanner } from "@/app/resources/components/ResourceFeedbackBanner";

type ResourceSuccessKind =
  "created" | "updated" | "deactivated" | "reactivated" | "deleted";

interface ResourceSuccessBannerProps {
  kind?: ResourceSuccessKind;
}

const successMessages: Record<ResourceSuccessKind, string> = {
  created:
    "Resource created successfully. It is now available in the shared catalogue.",
  updated: "Resource updated successfully.",
  deactivated:
    "Resource deactivated successfully. Reservation history has been preserved.",
  reactivated:
    "Resource reactivated successfully. It is now available for eligible bookings.",
  deleted: "Resource permanently deleted successfully.",
};

export function ResourceSuccessBanner({
  kind = "created",
}: ResourceSuccessBannerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Remove the success flag from the URL immediately.
    // This prevents the banner from returning after refresh.
    const url = new URL(window.location.href);

    if (url.searchParams.has(kind)) {
      url.searchParams.delete(kind);

      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }

    // Automatically dismiss the banner after 7 seconds.
    const timeout = window.setTimeout(() => {
      setVisible(false);
    }, 7000);

    return () => window.clearTimeout(timeout);
  }, [kind]);

  if (!visible) {
    return null;
  }

  return (
    <ResourceFeedbackBanner variant="success" message={successMessages[kind]} />
  );
}
