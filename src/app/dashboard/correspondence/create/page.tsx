import Link from "next/link";
import { WorkspaceCard } from "@/app/dashboard/correspondence/_components";

export default function CreateCorrespondencePage() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <WorkspaceCard title="Create outgoing correspondence" description="Draft an official LCDBO letter and start review before approval, signature and dispatch.">
        <Link href="/dashboard/correspondence/create/outgoing" className="inline-flex rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white">Start outgoing record</Link>
      </WorkspaceCard>
      <WorkspaceCard title="Register incoming correspondence" description="Record an inbound letter, assign ownership and track response obligations.">
        <Link href="/dashboard/correspondence/create/incoming" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Register incoming record</Link>
      </WorkspaceCard>
    </div>
  );
}
