"use client";

import { useEffect, useState } from "react";

export function ReviewQueueGuard({ formId }: { formId: string }) {
  const [selectedCount, setSelectedCount] = useState(0);
  const [helperText, setHelperText] = useState("Select rows before using bulk actions.");

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const update = () => {
      const checked = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="item_id"]:checked'));
      const count = checked.length;
      form.querySelectorAll<HTMLButtonElement>("[data-bulk-action]").forEach((button) => {
        const allowedStatuses = (button.dataset.allowedStatuses ?? "").split(",").filter(Boolean);
        const requiresEvidence = button.dataset.requiresEvidence === "true";
        const hasInvalidStatus = allowedStatuses.length > 0 && checked.some((input) => !allowedStatuses.includes(input.dataset.status ?? ""));
        const hasMissingEvidence = requiresEvidence && checked.some((input) => Number(input.dataset.evidenceCount ?? "0") < 1);
        button.disabled = count === 0 || hasInvalidStatus || hasMissingEvidence;
      });
      setSelectedCount(count);
      if (count === 0) {
        setHelperText("Select rows before using bulk actions.");
      } else {
        const statuses = Array.from(new Set(checked.map((input) => input.dataset.status ?? "unknown")));
        setHelperText(`${count} selected. Bulk actions enable only when every selected item is in a valid status: ${statuses.join(", ")}.`);
      }
    };

    const onSubmit = (event: SubmitEvent) => {
      const submitter = event.submitter as HTMLButtonElement | null;
      const action = submitter?.value ?? "";
      if (!submitter?.dataset.bulkAction) return;
      const count = form.querySelectorAll<HTMLInputElement>('input[name="item_id"]:checked').length;
      if (count === 0) {
        event.preventDefault();
        return;
      }
      if (count > 1 && ["approve", "reject", "request_changes"].includes(action)) {
        const confirmed = window.confirm(`Apply "${submitter.dataset.actionLabel ?? action}" to ${count} selected compliance items?`);
        if (!confirmed) event.preventDefault();
      }
    };

    update();
    form.addEventListener("change", update);
    form.addEventListener("submit", onSubmit);
    return () => {
      form.removeEventListener("change", update);
      form.removeEventListener("submit", onSubmit);
    };
  }, [formId]);

  return (
    <div className="min-w-0" aria-live="polite">
      <p className="text-sm font-bold text-slate-900">{selectedCount} selected</p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{helperText}</p>
    </div>
  );
}
