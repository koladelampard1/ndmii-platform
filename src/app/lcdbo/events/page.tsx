import { CalendarDays } from "lucide-react";
import { LcdboPageHero, LcdboSection, LcdboShell } from "@/components/lcdbo/lcdbo-shell";

const events = [
  { title: "LCDBO National Programme Briefing", date: "To be announced", audience: "Federal and state institutions", status: "Planning" },
  { title: "Pilot Cluster Readiness Sessions", date: "To be announced", audience: "Associations and MSMEs", status: "Foundation stage" },
  { title: "Investor and DFI Roundtable", date: "To be announced", audience: "Investors, DFIs, banks", status: "Future phase" },
];

export default function LcdboEventsPage() {
  return (
    <LcdboShell>
      <LcdboPageHero
        eyebrow="Events"
        title="Programme events and institutional engagements."
        description="The event layer will later connect to programme calendars, partner briefings, cluster mobilisation sessions, and investor engagements."
      />
      <LcdboSection title="Upcoming programme activities">
        <div className="grid gap-4 md:grid-cols-3">
          {events.map((event) => (
            <article key={event.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <CalendarDays className="h-8 w-8 text-[#1f8a5b]" />
              <h2 className="mt-5 text-xl font-black text-[#06172f]">{event.title}</h2>
              <p className="mt-3 text-sm font-bold text-slate-600">{event.date}</p>
              <p className="mt-1 text-sm text-slate-500">{event.audience}</p>
              <span className="mt-5 inline-flex rounded-full bg-[#d9a441]/15 px-3 py-1 text-xs font-black text-[#72520c]">{event.status}</span>
            </article>
          ))}
        </div>
      </LcdboSection>
    </LcdboShell>
  );
}
