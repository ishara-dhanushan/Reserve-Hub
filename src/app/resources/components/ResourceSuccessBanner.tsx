"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

interface ResourceSuccessBannerProps {
  kind?: "created" | "updated";
}

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
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success"
    >
      <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
      <p>
        {kind === "created"
          ? "Resource created successfully. It is now available in the shared catalogue."
          : "Resource updated successfully."}
      </p>
    </div>
  );
}
