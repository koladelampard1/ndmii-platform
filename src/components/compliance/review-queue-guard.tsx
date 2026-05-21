"use client";

import { useEffect, useState } from "react";

export function ReviewQueueGuard({ formId }: { formId: string }) {
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const update = () => {
      const count = form.querySelectorAll<HTMLInputElement>('input[name="item_id"]:checked').length;
      setSelectedCount(count);
      form.querySelectorAll<HTMLButtonElement>("[data-bulk-action]").forEach((button) => {
        button.disabled = count === 0;
      });
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
    <p className="text-xs font-medium text-slate-600" aria-live="polite">
      {selectedCount === 0 ? "Select rows before using bulk actions." : `${selectedCount} row${selectedCount === 1 ? "" : "s"} selected.`}
    </p>
  );
}
