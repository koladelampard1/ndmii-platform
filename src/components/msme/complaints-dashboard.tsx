"use client";

import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Filter,
  MessageCircleWarning,
  MoreHorizontal,
  Search,
  ShieldAlert,
  TrendingUp,
  UserCircle2,
} from "lucide-react";
import { useMemo, useState } from "react";

type ComplaintRow = {
  id: string;
  complaint_reference: string | null;
  title: string | null;
  summary: string | null;
  priority: string | null;
  status: string | null;
  created_at: string | null;
  complainant_name: string | null;
  reporter_name: string | null;
};

type Props = {
  complaints: ComplaintRow[];
};

type DisplayStatus = "open" | "in_progress" | "resolved" | "escalated";
type StatusTab = "all" | DisplayStatus;

const STATUS_TABS: Array<{ key: StatusTab; label: string }> = [
  { key: "all", label: "All Complaints" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "escalated", label: "Escalated" },
];

const ISSUE_FALLBACK = ["Service Quality", "Communication", "Delivery Time", "Pricing", "Other"];

function normalizeStatus(value: string | null): DisplayStatus {
  const status = String(value ?? "submitted").trim().toLowerCase();
  if (["resolved", "closed", "dismissed", "awaiting_complainant_response"].includes(status)) return "resolved";
  if (status === "escalated") return "escalated";
  if (["under_review", "awaiting_msme_response", "association_follow_up", "regulator_review"].includes(status)) return "in_progress";
  return "open";
}

function statusLabel(value: string | null) {
  const normalized = normalizeStatus(value);
  if (normalized === "in_progress") return "In Progress";
  if (normalized === "resolved") return "Resolved";
  if (normalized === "escalated") return "Escalated";
  return "Open";
}

function statusTone(value: string | null) {
  const normalized = normalizeStatus(value);
  if (normalized === "in_progress") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (normalized === "resolved") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (normalized === "escalated") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-green-50 text-green-700 ring-green-200";
}

function priorityTone(value: string | null) {
  const priority = String(value ?? "medium").toLowerCase();
  if (priority === "high" || priority === "urgent") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (priority === "low") return "bg-sky-50 text-sky-700 ring-sky-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function prettyPriority(value: string | null) {
  const priority = String(value ?? "medium").toLowerCase();
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function timeRangeMatch(dateValue: string | null, timeFilter: string) {
  if (timeFilter === "all") return true;
  if (!dateValue) return false;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (timeFilter === "7d") return days <= 7;
  if (timeFilter === "30d") return days <= 30;
  if (timeFilter === "90d") return days <= 90;

  return true;
}

export function MsmeComplaintsDashboard({ complaints }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DisplayStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "low" | "medium" | "high">("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "priority">("newest");
  const [activeTab, setActiveTab] = useState<StatusTab>("all");

  const metrics = useMemo(() => {
    const counts = { total: complaints.length, open: 0, in_progress: 0, resolved: 0, escalated: 0 };

    complaints.forEach((item) => {
      const status = normalizeStatus(item.status);
      counts[status] += 1;
    });

    return counts;
  }, [complaints]);

  const filteredComplaints = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const filtered = complaints.filter((item) => {
      const mappedStatus = normalizeStatus(item.status);
      const mappedPriority = String(item.priority ?? "medium").toLowerCase();

      const matchesSearch =
        !query ||
        `${item.title ?? ""} ${item.summary ?? ""} ${item.complainant_name ?? ""} ${item.reporter_name ?? ""} ${item.complaint_reference ?? ""}`
          .toLowerCase()
          .includes(query);

      const matchesStatusFilter = statusFilter === "all" || mappedStatus === statusFilter;
      const matchesPriorityFilter = priorityFilter === "all" || mappedPriority === priorityFilter;
      const matchesTimeFilter = timeRangeMatch(item.created_at, timeFilter);
      const matchesTab = activeTab === "all" || mappedStatus === activeTab;

      return matchesSearch && matchesStatusFilter && matchesPriorityFilter && matchesTimeFilter && matchesTab;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "priority") {
        const priorityOrder = { high: 3, urgent: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[String(a.priority ?? "medium").toLowerCase() as keyof typeof priorityOrder] ?? 2;
        const bPriority = priorityOrder[String(b.priority ?? "medium").toLowerCase() as keyof typeof priorityOrder] ?? 2;
        return bPriority - aPriority;
      }

      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortBy === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [activeTab, complaints, priorityFilter, searchTerm, sortBy, statusFilter, timeFilter]);

  const issueBreakdown = useMemo(() => {
    const bucket = new Map<string, number>();
    ISSUE_FALLBACK.forEach((issue) => bucket.set(issue, 0));

    complaints.forEach((item) => {
      const source = `${item.title ?? ""} ${item.summary ?? ""}`.toLowerCase();
      if (source.includes("quality")) bucket.set("Service Quality", (bucket.get("Service Quality") ?? 0) + 1);
      else if (source.includes("communic") || source.includes("response")) bucket.set("Communication", (bucket.get("Communication") ?? 0) + 1);
      else if (source.includes("delay") || source.includes("delivery") || source.includes("time")) bucket.set("Delivery Time", (bucket.get("Delivery Time") ?? 0) + 1);
      else if (source.includes("price") || source.includes("fee") || source.includes("cost")) bucket.set("Pricing", (bucket.get("Pricing") ?? 0) + 1);
      else bucket.set("Other", (bucket.get("Other") ?? 0) + 1);
    });

    return Array.from(bucket.entries());
  }, [complaints]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr),340px]">
      <section className="space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Provider Complaint Log</h1>
          <p className="mt-1 text-sm text-slate-600">Track complaints raised against your provider profile and respond to move cases forward.</p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { title: "Total Complaints", value: metrics.total, note: "All time", icon: MessageCircleWarning, tone: "bg-slate-100 text-slate-700" },
            { title: "Open Complaints", value: metrics.open, note: "Require response", icon: Clock3, tone: "bg-green-100 text-green-700" },
            { title: "Resolved Complaints", value: metrics.resolved, note: "Successfully closed", icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700" },
            { title: "Escalated Complaints", value: metrics.escalated, note: "Under review", icon: ShieldAlert, tone: "bg-rose-100 text-rose-700" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.title}</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{item.value}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.note}</p>
                  </div>
                  <span className={`inline-flex rounded-xl p-2.5 ${item.tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr),repeat(4,minmax(0,1fr))]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search complaints..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none ring-emerald-500 transition focus:border-emerald-400 focus:ring-2"
              />
            </label>

            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ring-emerald-500 focus:border-emerald-400 focus:ring-2">
              <option value="all">Status: All</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="escalated">Escalated</option>
            </select>

            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ring-emerald-500 focus:border-emerald-400 focus:ring-2">
              <option value="all">Priority: All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as typeof timeFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ring-emerald-500 focus:border-emerald-400 focus:ring-2">
              <option value="all">Time: All</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>

            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ring-emerald-500 focus:border-emerald-400 focus:ring-2">
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="priority">Sort: Priority</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            {STATUS_TABS.map((tab) => {
              const active = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    active ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Complaint Queue</h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Filter className="h-3.5 w-3.5" />
              <span>{filteredComplaints.length} shown</span>
            </div>
          </header>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Complaint</th>
                  <th className="px-4 py-3">Reference ID</th>
                  <th className="px-4 py-3">Complainant</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 align-top hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <AlertCircle className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">{item.title ?? item.summary ?? "Complaint report"}</p>
                          <p className="line-clamp-1 text-xs text-slate-500">{item.summary ?? "Customer issue submitted for provider review."}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">{item.complaint_reference ?? String(item.id).slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserCircle2 className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-700">{item.complainant_name ?? item.reporter_name ?? "Public user"}</span>
                      </div>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-slate-500">Not provided</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${priorityTone(item.priority)}`}>{prettyPriority(item.priority)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone(item.status)}`}>{statusLabel(item.status)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(item.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/msme/complaints/${item.id}`} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800">
                          View
                        </Link>
                        <button type="button" className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100" aria-label="More actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredComplaints.length === 0 ? (
              <div className="mx-4 my-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                <p className="text-lg font-semibold text-slate-900">No complaints yet</p>
                <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
                  When customers submit complaints about your services, they will appear here for review and response.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </section>

      <aside className="space-y-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Complaint Overview</h3>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500">Open</p>
                <p className="text-lg font-semibold text-green-700">{metrics.open}</p>
              </div>
              <div>
                <p className="text-slate-500">In Progress</p>
                <p className="text-lg font-semibold text-amber-700">{metrics.in_progress}</p>
              </div>
              <div>
                <p className="text-slate-500">Resolved</p>
                <p className="text-lg font-semibold text-emerald-700">{metrics.resolved}</p>
              </div>
              <div>
                <p className="text-slate-500">Escalated</p>
                <p className="text-lg font-semibold text-rose-700">{metrics.escalated}</p>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Common Issues</h3>
          <div className="mt-3 space-y-2">
            {issueBreakdown.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-600">{label}</span>
                <span className="font-semibold text-slate-900">{value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Tips to Reduce Complaints</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {[
              "Deliver high-quality services",
              "Communicate clearly and promptly",
              "Set realistic expectations",
              "Meet agreed deadlines",
              "Keep customers updated",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-700 p-5 text-white shadow-sm">
          <p className="text-xl font-semibold leading-tight">Build Trust. Grow Your Business.</p>
          <p className="mt-2 text-sm text-emerald-100">Resolve complaints quickly to improve customer confidence and strengthen your provider reputation.</p>
          <Link href="/dashboard/msme/reviews" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
            View Reviews
            <span aria-hidden="true">→</span>
          </Link>
        </article>

        <p className="px-1 text-xs text-slate-500">
          For escalation workflows use{" "}
          <Link href="/dashboard/fccpc" className="font-medium text-emerald-700 hover:underline">
            FCCPC Workspace
          </Link>
          .
        </p>
      </aside>
    </div>
  );
}
