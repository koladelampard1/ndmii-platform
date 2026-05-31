"use client";

import { useState } from "react";

export function CopyInviteLink({ inviteLink }: { inviteLink: string }) {
  const [copied, setCopied] = useState(false);

  return <button type="button" onClick={async () => { await navigator.clipboard.writeText(inviteLink); setCopied(true); }} className="mt-3 rounded border border-emerald-300 bg-white px-3 py-2 text-xs font-black text-emerald-900">{copied ? "Copied" : "Copy invite link"}</button>;
}
