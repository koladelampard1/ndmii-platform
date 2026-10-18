import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  Check,
  CircleCheck,
  FileCheck2,
  Fingerprint,
  LockKeyhole,
  Route,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import styles from "./amaanah.module.css";

export const metadata: Metadata = {
  title: "Amaanah MSME Growth Platform",
  description:
    "A connected enterprise-development and non-interest finance journey for Amaanah Finance Company, its delivery teams and participating MSMEs.",
  alternates: { canonical: "https://amaanah.dbin.ng" },
  openGraph: {
    title: "Amaanah MSME Growth Platform",
    description: "Business support that continues before, through and beyond financing.",
    url: "https://amaanah.dbin.ng",
    siteName: "Amaanah Finance Company",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Amaanah MSME Growth Platform",
    description: "Business support that continues before, through and beyond financing.",
  },
};

const signInHref = "/login?workspace=amaanah&next=/dashboard/amaanah";

const journey = [
  { number: "01", title: "Create the business record", copy: "Capture the enterprise, its owners, operations and supporting evidence once—then strengthen the same record over time.", label: "Identity" },
  { number: "02", title: "Understand what is missing", copy: "Assess business needs and product-specific requirements, with a visible path from today’s position to finance readiness.", label: "Diagnosis" },
  { number: "03", title: "Coordinate the work", copy: "Assign actions to authorised officers and partners, record interventions and keep every handover connected to the case.", label: "Development" },
  { number: "04", title: "Present a complete case", copy: "Organise the right documents and evidence for Amaanah’s independent review and decision process.", label: "Finance readiness" },
  { number: "05", title: "Continue after financing", copy: "Maintain agreed check-ins, business-support actions and an evidence trail for responsible, sustainable growth.", label: "Continuing support" },
] as const;

const operatingPrinciples = [
  { title: "One continuous record", copy: "Business information, documents, assessments and support history remain connected across the journey.", icon: Fingerprint },
  { title: "Clear responsibility", copy: "Each action has an owner, a due date and a recorded outcome across internal and partner delivery teams.", icon: UsersRound },
  { title: "Evidence before handover", copy: "Cases move forward against defined requirements—not informal updates or disconnected files.", icon: FileCheck2 },
  { title: "Governed by design", copy: "Access is role-scoped, actions are auditable and Amaanah retains every financing and compliance decision.", icon: ShieldCheck },
] as const;

export default function AmaanahPortalPage() {
  return (
    <main className={`${styles.page} min-h-screen bg-[#f3efe5] text-[#17372f]`}>
      <header className="relative z-30 border-b border-[#17372f]/15 bg-[#f3efe5]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/amaanah" aria-label="Amaanah Finance Company home">
            <Image src="/brands/amaanah-finance-logo.svg" alt="Amaanah Finance Company" width={1013} height={266} priority className="h-8 w-auto sm:h-12" />
          </Link>
          <nav aria-label="Primary navigation" className="hidden items-center gap-8 lg:flex">
            <a href="#journey" className={styles.navLink}>How it works</a>
            <a href="#businesses" className={styles.navLink}>For businesses</a>
            <a href="#delivery" className={styles.navLink}>For delivery teams</a>
            <a href="#governance" className={styles.navLink}>Governance</a>
          </nav>
          <Link href={signInHref} className="inline-flex min-h-11 items-center gap-2 border border-[#17372f] px-4 text-sm font-bold transition-colors hover:bg-[#17372f] hover:text-white sm:px-5">
            <span><span className="hidden sm:inline">Secure </span>sign in</span> <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-[#17372f]/15">
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1440px] lg:min-h-[720px] lg:grid-cols-[1.04fr_0.96fr]">
          <div className="flex flex-col justify-center px-5 py-20 sm:px-8 sm:py-24 lg:border-r lg:border-[#17372f]/15 lg:px-12 lg:py-28 xl:px-20">
            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#876b43]"><span className="h-px w-9 bg-[#a88c61]" />MSME growth &amp; non-interest finance</div>
            <h1 className={`${styles.display} mt-9 max-w-4xl text-[3.45rem] leading-[0.95] tracking-[-0.045em] text-[#123d34] sm:text-7xl lg:text-[5.6rem] xl:text-[6.35rem]`}>
              Business support that continues <span className="italic text-[#9d7541]">beyond financing.</span>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-7 text-[#435d56] sm:text-lg sm:leading-8">A connected workspace for Amaanah, its authorised delivery teams and participating MSMEs—from the first business record to finance readiness and continuing support.</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href={signInHref} className="group inline-flex min-h-13 items-center justify-between gap-8 bg-[#033531] px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-[#0a4a40]">
                Open the secure workspace <ArrowDownRight className="h-5 w-5 text-[#ccaf84] transition-transform group-hover:translate-x-1 group-hover:translate-y-1" aria-hidden="true" />
              </Link>
              <a href="#journey" className="inline-flex min-h-13 items-center justify-center border border-[#17372f]/30 px-6 py-4 text-sm font-bold transition-colors hover:border-[#17372f]">Explore the journey</a>
            </div>
          </div>

          <div className="relative flex items-center justify-center bg-[#0a3b34] px-5 py-16 sm:px-10 lg:px-12 lg:py-20">
            <div className={styles.heroArc} aria-hidden="true" />
            <div className="relative z-10 w-full max-w-[570px]">
              <div className="mb-5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-[#d8c6a9]/75"><span>Illustrative case record</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#9fc48f]" /> Active</span></div>
              <div className={styles.casePanel}>
                <div className="flex items-start justify-between gap-4 border-b border-[#17372f]/15 p-5 sm:p-7">
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#876b43]">Enterprise passport</p><h2 className={`${styles.display} mt-2 text-3xl text-[#123d34] sm:text-4xl`}>Adunni Foods</h2><p className="mt-2 text-sm text-[#5d6f69]">Food processing · Kaduna</p></div>
                  <div className="grid h-14 w-14 place-items-center border border-[#123d34]/15 bg-[#ece3d2] text-lg font-bold text-[#123d34]">AF</div>
                </div>
                <div className="grid border-b border-[#17372f]/15 sm:grid-cols-[1fr_0.8fr]">
                  <div className="border-b border-[#17372f]/15 p-5 sm:border-b-0 sm:border-r sm:p-7">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#876b43]">Current stage</p>
                    <div className="mt-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#dce8db] text-[#185044]"><CircleCheck className="h-5 w-5" /></span><div><p className="font-bold text-[#17372f]">Development plan</p><p className="text-xs text-[#6f7f79]">3 of 5 actions complete</p></div></div>
                    <div className="mt-5 h-1.5 overflow-hidden bg-[#d9d4c8]"><div className="h-full w-3/5 bg-[#a7834e]" /></div>
                  </div>
                  <div className="p-5 sm:p-7"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#876b43]">Next action</p><p className="mt-4 text-sm font-bold leading-5 text-[#17372f]">Upload 6-month sales record</p><p className="mt-2 text-xs leading-5 text-[#6f7f79]">Assigned to business owner</p></div>
                </div>
                <div className="p-5 sm:p-7">
                  <div className="flex items-center justify-between gap-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#876b43]">Readiness requirements</p><p className="text-xs font-bold text-[#185044]">6 of 8 verified</p></div>
                  <div className="mt-5 space-y-3">
                    {["Business identity verified", "Operating evidence reviewed", "Cash-flow records in progress"].map((item, index) => <div key={item} className="flex items-center justify-between border-t border-[#17372f]/10 pt-3 text-sm"><span className="flex items-center gap-3 text-[#425b54]">{index < 2 ? <Check className="h-4 w-4 text-[#23715f]" /> : <span className="h-4 w-4 border border-[#a7834e]" />}{item}</span><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#876b43]">{index < 2 ? "Complete" : "Open"}</span></div>)}
                  </div>
                </div>
              </div>
              <p className="mt-5 max-w-md text-xs leading-5 text-[#d8c6a9]/70">A single case view keeps the enterprise, delivery team and institution aligned around evidence and next actions.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#17372f]/15 bg-[#e6dfd2]">
        <div className="mx-auto grid max-w-[1440px] md:grid-cols-3">
          {[["01", "Understand the requirements", "A visible path replaces uncertainty and repeated requests."], ["02", "Build readiness deliberately", "Advice and evidence are tied to the business’s actual gaps."], ["03", "Stay supported afterwards", "The relationship continues through agreed post-finance actions."]].map(([number, title, copy], index) => <div key={title} className={`px-6 py-8 sm:px-8 lg:px-12 ${index < 2 ? "border-b border-[#17372f]/15 md:border-b-0 md:border-r" : ""}`}><div className="flex gap-5"><span className="pt-1 text-xs font-bold text-[#9d7541]">{number}</span><div><h2 className={`${styles.display} text-2xl text-[#17372f]`}>{title}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-[#536860]">{copy}</p></div></div></div>)}
        </div>
      </section>

      <section id="journey" className="bg-[#f8f5ed] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
        <div className="mx-auto max-w-[1320px]"><div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24">
          <div className="lg:sticky lg:top-10 lg:self-start"><p className={styles.eyebrow}>The connected journey</p><h2 className={`${styles.display} mt-5 text-5xl leading-[1.02] tracking-[-0.035em] text-[#123d34] sm:text-6xl`}>One business.<br />One evolving record.</h2><p className="mt-6 max-w-md text-base leading-7 text-[#536860]">Every stage should make the next one clearer. The platform turns enterprise development into a visible sequence of decisions, actions and evidence.</p></div>
          <div className="border-t border-[#17372f]/20">{journey.map((step) => <article key={step.number} className="group grid gap-4 border-b border-[#17372f]/20 py-8 sm:grid-cols-[72px_1fr_auto] sm:items-start sm:py-10"><span className={`${styles.display} text-3xl italic text-[#aa8a5d]`}>{step.number}</span><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#876b43]">{step.label}</p><h3 className={`${styles.display} mt-2 text-3xl leading-tight text-[#17372f] sm:text-4xl`}>{step.title}</h3><p className="mt-3 max-w-xl text-sm leading-6 text-[#5b6e68] sm:text-base sm:leading-7">{step.copy}</p></div><ArrowDownRight className="hidden h-6 w-6 text-[#9d7541] transition-transform group-hover:translate-x-1 group-hover:translate-y-1 sm:block" aria-hidden="true" /></article>)}</div>
        </div></div>
      </section>

      <section id="businesses" className="overflow-hidden bg-[#0a3b34] text-white">
        <div className="mx-auto grid max-w-[1440px] lg:grid-cols-2">
          <div className="relative border-b border-white/15 px-5 py-20 sm:px-8 lg:border-b-0 lg:border-r lg:px-12 lg:py-28 xl:px-20">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#ccaf84]">For participating businesses</p><h2 className={`${styles.display} mt-6 max-w-xl text-5xl leading-[1.03] tracking-[-0.035em] sm:text-6xl`}>Know where you stand—and what comes next.</h2><p className="mt-6 max-w-lg text-base leading-7 text-[#d9e5df]/75">The platform gives each MSME a structured path: a trusted business profile, clear requirements, practical actions and a visible support history.</p>
            <div className="mt-10 grid gap-px border border-white/15 bg-white/15 sm:grid-cols-2">{["Fewer repeated submissions", "Clear outstanding actions", "Guided readiness support", "A continuous business history"].map((item) => <div key={item} className="flex items-center gap-3 bg-[#0a3b34] p-5 text-sm font-semibold text-[#edf3ef]"><Check className="h-4 w-4 shrink-0 text-[#ccaf84]" /> {item}</div>)}</div>
          </div>
          <div id="delivery" className="relative bg-[#10332e] px-5 py-20 sm:px-8 lg:px-12 lg:py-28 xl:px-20">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#ccaf84]">For Amaanah &amp; delivery teams</p><h2 className={`${styles.display} mt-6 max-w-xl text-5xl leading-[1.03] tracking-[-0.035em] sm:text-6xl`}>Run one accountable operating model.</h2><p className="mt-6 max-w-lg text-base leading-7 text-[#d9e5df]/75">Internal officers and authorised external partners work against the same case record, standards and handover points—while management sees progress across the portfolio.</p>
            <div className="mt-10 border-t border-white/15">{[["Assign", "Set ownership and due dates for each intervention."], ["Evidence", "Record what was delivered and what changed."], ["Oversee", "See exceptions, bottlenecks and follow-up needs."]].map(([title, copy]) => <div key={title} className="grid grid-cols-[90px_1fr] gap-4 border-b border-white/15 py-5"><p className="font-bold text-[#ccaf84]">{title}</p><p className="text-sm leading-6 text-[#d9e5df]/70">{copy}</p></div>)}</div>
          </div>
        </div>
      </section>

      <section id="governance" className="bg-[#f3efe5] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
        <div className="mx-auto max-w-[1320px]"><div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-24">
          <div><p className={styles.eyebrow}>Operating principles</p><h2 className={`${styles.display} mt-5 text-5xl leading-[1.03] tracking-[-0.035em] text-[#123d34] sm:text-6xl`}>Designed for trust, not just throughput.</h2><p className="mt-6 max-w-lg text-base leading-7 text-[#536860]">Technology supports the relationship; it does not replace institutional judgement. Amaanah remains responsible for eligibility, compliance, appraisal and every financing decision.</p><div className="mt-10 inline-flex items-center gap-3 border-l-2 border-[#a7834e] pl-5 text-sm font-bold text-[#17372f]"><LockKeyhole className="h-5 w-5 text-[#8c6b3d]" /> Permission-bound institutional access</div></div>
          <div className="grid border-l border-t border-[#17372f]/20 sm:grid-cols-2">{operatingPrinciples.map((principle) => <article key={principle.title} className="min-h-64 border-b border-r border-[#17372f]/20 p-7 sm:p-8"><principle.icon className="h-7 w-7 text-[#9d7541]" strokeWidth={1.5} /><h3 className={`${styles.display} mt-12 text-2xl text-[#17372f]`}>{principle.title}</h3><p className="mt-3 text-sm leading-6 text-[#5b6e68]">{principle.copy}</p></article>)}</div>
        </div></div>
      </section>

      <section className="bg-[#ccaf84] px-5 py-16 sm:px-8 lg:px-12 lg:py-20"><div className="mx-auto flex max-w-[1320px] flex-col gap-10 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#17372f]/70"><Route className="h-4 w-4" /> Authorised workspace</div><h2 className={`${styles.display} mt-5 max-w-4xl text-4xl leading-tight tracking-[-0.035em] text-[#123d34] sm:text-6xl`}>Continue the Amaanah enterprise journey.</h2></div><Link href={signInHref} className="group inline-flex min-h-14 shrink-0 items-center justify-between gap-12 bg-[#033531] px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-[#0a4a40]">Sign in securely<ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" /></Link></div></section>

      <footer className="bg-[#082f2b] px-5 py-10 text-white sm:px-8 lg:px-12"><div className="mx-auto flex max-w-[1320px] flex-col gap-8 sm:flex-row sm:items-end sm:justify-between"><div><div className="inline-block bg-white px-3 py-2"><Image src="/brands/amaanah-finance-logo.svg" alt="Amaanah Finance Company" width={1013} height={266} className="h-9 w-auto" /></div><p className="mt-4 text-xs leading-5 text-white/55">MSME Growth Platform · Powered by DBIN</p></div><div className="flex items-center gap-2 text-xs text-white/55"><BadgeCheck className="h-4 w-4 text-[#ccaf84]" /> Secure, role-scoped institutional access</div></div></footer>
    </main>
  );
}
