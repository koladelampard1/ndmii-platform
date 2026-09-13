"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const PENDING_TRIGGER = "data-dbin-pending-trigger";
const WAS_DISABLED = "data-dbin-was-disabled";

function isInternalNavigation(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const url = new URL(anchor.href, window.location.href);
  return url.origin === window.location.origin && url.href !== window.location.href;
}

export function InteractionProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const requestCount = useRef(0);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(() => {
    requestCount.current = 0;
    setPending(false);
    document.body.removeAttribute("data-dbin-pending");
    document.querySelectorAll<HTMLElement>(`[${PENDING_TRIGGER}]`).forEach((element) => {
      element.removeAttribute("aria-busy");
      element.removeAttribute(PENDING_TRIGGER);
      if (element.getAttribute(WAS_DISABLED) !== "true" && element instanceof HTMLButtonElement) {
        element.disabled = false;
      }
      element.removeAttribute(WAS_DISABLED);
    });
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    safetyTimer.current = null;
  }, []);

  const begin = useCallback((trigger?: HTMLElement | null) => {
    setPending(true);
    document.body.setAttribute("data-dbin-pending", "true");
    if (trigger) {
      trigger.setAttribute(WAS_DISABLED, String(trigger instanceof HTMLButtonElement && trigger.disabled));
      trigger.setAttribute(PENDING_TRIGGER, "true");
      trigger.setAttribute("aria-busy", "true");
      if (trigger instanceof HTMLButtonElement) trigger.disabled = true;
    }
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    safetyTimer.current = setTimeout(finish, 45_000);
  }, [finish]);

  useEffect(() => finish(), [pathname, searchParams, finish]);

  useEffect(() => {
    const handleSubmit = (event: Event) => {
      const submitEvent = event as SubmitEvent;
      const form = submitEvent.target instanceof HTMLFormElement ? submitEvent.target : null;
      if (!form || !form.checkValidity()) return;
      begin(submitEvent.submitter instanceof HTMLElement ? submitEvent.submitter : null);
    };

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");
      if (anchor instanceof HTMLAnchorElement && isInternalNavigation(anchor)) begin(anchor);
    };

    document.addEventListener("submit", handleSubmit, true);
    document.addEventListener("click", handleClick, true);
    window.addEventListener("pageshow", finish);

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const input = args[0];
      const init = args[1];
      const method = String(init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const tracksMutation = !["GET", "HEAD", "OPTIONS"].includes(method);
      if (tracksMutation) {
        requestCount.current += 1;
        begin();
      }
      try {
        return await originalFetch(...args);
      } finally {
        if (tracksMutation) {
          requestCount.current = Math.max(0, requestCount.current - 1);
          if (requestCount.current === 0) finish();
        }
      }
    };

    return () => {
      document.removeEventListener("submit", handleSubmit, true);
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("pageshow", finish);
      window.fetch = originalFetch;
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    };
  }, [begin, finish]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100]" aria-hidden={!pending}>
      <div className={`h-1 overflow-hidden bg-emerald-100 transition-opacity ${pending ? "opacity-100" : "opacity-0"}`}>
        <div className="dbin-progress-bar h-full w-1/3 bg-emerald-600" />
      </div>
      <div className="sr-only" role="status" aria-live="polite">{pending ? "Processing your request." : ""}</div>
    </div>
  );
}
