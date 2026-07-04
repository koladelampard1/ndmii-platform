"use client";

import { useEffect } from "react";

export function PropertyDraftGuard({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    let dirty = false;
    let submitting = false;
    const markDirty = () => {
      if (!submitting) dirty = true;
    };
    const markSubmitting = () => {
      submitting = true;
      dirty = false;
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty || submitting) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (!dirty || submitting) return;
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const confirmed = window.confirm("You have unsaved property registration changes. Save your draft before leaving this page?");
      if (!confirmed) event.preventDefault();
    };

    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    form.addEventListener("submit", markSubmitting);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
      form.removeEventListener("submit", markSubmitting);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, [formId]);

  return null;
}
