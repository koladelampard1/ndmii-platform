import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Landmark, MapPin, ShieldCheck } from "lucide-react";
import { getPublicPropertyByNpin } from "@/lib/data/public-property-explorer";
import { PrivacyNotice, PropertyPublicShell } from "@/components/property/public-property-explorer";

export const dynamic = "force-dynamic";

export default async function PublicPropertyProfilePage({ params }: { params: Promise<{ npin: string }> }) {
  const { npin } = await params;
  const profile = await getPublicPropertyByNpin(decodeURIComponent(npin));
  if (!profile) notFound();

  return (
    <PropertyPublicShell>
      <section className="bg-[#06172f] px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Link href="/property/search" className="inline-flex items-center gap-2 text-sm font-bold text-slate-200"><ArrowLeft className="h-4 w-4" /> Back to search</Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-[#D4A017]">Public Property Profile</p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">{profile.title}</h1>
          <p className="mt-4 max-w-2xl text-slate-200">Privacy-safe registry profile for {profile.npin}. This page intentionally excludes ownership and internal case data.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Badge>{profile.registryStatus}</Badge>
            <Badge>{profile.verificationStatus}</Badge>
            <Badge>{profile.credentialStatus ?? "credential unavailable"}</Badge>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_0.85fr]">
        <div className="space-y-6">
          <Panel title="Registry identity" icon={ShieldCheck}>
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="NPIN" value={profile.npin} />
              <Info label="Application Reference" value={profile.applicationReference ?? "Not published"} />
              <Info label="Credential Status" value={profile.credentialStatus ?? "Unavailable"} />
              <Info label="Certificate Status" value={profile.certificateStatus ?? "Unavailable"} />
              <Info label="Issuing Authority" value={profile.issuingAuthority} />
              <Info label="Issue Date" value={profile.issuedAt ? new Date(profile.issuedAt).toLocaleDateString("en-NG") : "Unavailable"} />
            </div>
          </Panel>

          <Panel title="Property information" icon={Landmark}>
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Category" value={profile.category} />
              <Info label="Property Type" value={profile.propertyType} />
              <Info label="Area" value={profile.area ?? "Not published"} />
              <Info label="Registry Status" value={profile.registryStatus} />
            </div>
            {profile.description ? <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{profile.description}</p> : null}
          </Panel>

          <Panel title="Available public documents" icon={FileText}>
            {profile.documents.length ? (
              <div className="space-y-3">
                {profile.documents.map((document) => (
                  <div key={`${document.title}-${document.documentType}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="font-black text-[#06172f]">{document.title}</p>
                    <p className="mt-1 text-sm capitalize text-slate-500">{document.documentType} · {document.issuer ?? "Issuer not published"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-500">No documents are marked public for this property. Private evidence and registry documents are never exposed here.</p>
            )}
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="General location" icon={MapPin}>
            <div className="space-y-3">
              <Info label="State" value={profile.state} />
              <Info label="LGA" value={profile.lga} />
              <Info label="Ward" value={profile.ward ?? "Not published"} />
              <Info label="Community" value={profile.community ?? "Not published"} />
            </div>
          </Panel>
          <PrivacyNotice />
          <Link href={`/property/verify?npin=${encodeURIComponent(profile.npin)}`} className="block rounded-2xl bg-[#008751] px-5 py-4 text-center text-sm font-black text-white">Verify this NPIN</Link>
        </aside>
      </section>
    </PropertyPublicShell>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof ShieldCheck; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-[#008751]"><Icon className="h-5 w-5" /></span>
        <h2 className="text-2xl font-black text-[#06172f]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 font-black capitalize text-[#06172f]">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black capitalize">{children}</span>;
}
