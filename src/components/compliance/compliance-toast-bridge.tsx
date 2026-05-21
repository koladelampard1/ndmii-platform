"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Toast } from "@/components/ui/toast";

const successMessages: Record<string, string> = {
  submitted: "Compliance item submitted for review.",
  assign: "Review started.",
  approve: "Compliance item approved.",
  reject: "Compliance item rejected.",
  request_changes: "Changes requested from MSME.",
  reopen: "Review reopened.",
};

function readableError(value: string) {
  if (value === "no_items_selected") return "Select at least one queue item before applying a bulk action.";
  return value.replaceAll("_", " ");
}

export function ComplianceToastBridge() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = searchParams.get("saved");
    const error = searchParams.get("error");
    if (!saved && !error) return;

    const timeout = window.setTimeout(() => {
      setMessage(saved ? successMessages[saved] ?? "Compliance action completed." : readableError(error ?? "Compliance action failed."));
    }, 0);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("saved");
    nextParams.delete("error");
    const next = nextParams.toString();
    router.replace(next ? `?${next}` : window.location.pathname, { scroll: false });
    return () => window.clearTimeout(timeout);
  }, [router, searchParams]);

  return <Toast open={Boolean(message)} message={message} onClose={() => setMessage("")} durationMs={3600} />;
}
