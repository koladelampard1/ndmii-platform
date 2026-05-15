"use client";

import { useFormStatus } from "react-dom";

export function SettingsSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-400"
    >
      {pending ? "Saving..." : "Save Changes"}
    </button>
  );
}
