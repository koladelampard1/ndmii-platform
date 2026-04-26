import { BadgeCheck, FileCheck2, Handshake } from "lucide-react";

const cards = [
  {
    title: "Identity Exists",
    description: "This credential confirms the business is registered within the DBIN network.",
    icon: BadgeCheck,
  },
  {
    title: "Registry Checked",
    description: "Key registry validation checks have been initiated.",
    icon: FileCheck2,
  },
  {
    title: "Partner Ready",
    description: "This identity can be used for institutional verification workflows.",
    icon: Handshake,
  },
];

export function VerificationMeaningCards() {
  return (
    <section>
      <h3 className="text-center text-2xl font-semibold text-slate-900">What this verification means</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {cards.map(({ title, description, icon: Icon }) => (
          <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="rounded-full bg-emerald-50 p-2 text-emerald-700">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-lg font-semibold text-slate-900">{title}</h4>
                <p className="mt-1 text-sm text-slate-600">{description}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
