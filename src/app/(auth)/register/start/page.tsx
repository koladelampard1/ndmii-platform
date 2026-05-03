import Link from "next/link";
import { Building2, Network, UserRound } from "lucide-react";

const options = [
  {
    href: "/register?path=existing_association_member",
    title: "I already belong to an association",
    description: "Choose your association so its officers can confirm your existing membership before DBIN verification.",
    icon: Network,
  },
  {
    href: "/register?path=new_association_applicant",
    title: "I want to join an association",
    description: "Select an association you want to join and submit your business for membership review.",
    icon: Building2,
  },
  {
    href: "/register?path=independent",
    title: "I want to register independently",
    description: "Continue directly to DBIN verification without association membership approval.",
    icon: UserRound,
  },
];

export default function RegistrationStartPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-emerald-900/20 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">MSME Registration Path</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">Do you belong to an MSME association?</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Your answer sets the approval route for your business identity record.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <Link
                key={option.href}
                href={option.href}
                className="group flex min-h-56 flex-col rounded-xl border border-slate-200 bg-slate-50 p-5 transition hover:border-emerald-600 hover:bg-emerald-50"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="mt-5 text-lg font-semibold leading-snug text-slate-950">{option.title}</span>
                <span className="mt-3 text-sm leading-6 text-slate-600">{option.description}</span>
                <span className="mt-auto pt-5 text-sm font-semibold text-emerald-700 group-hover:text-emerald-800">
                  Continue
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
