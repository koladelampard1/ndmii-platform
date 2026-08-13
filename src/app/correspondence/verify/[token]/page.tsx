import Link from "next/link";
import { getPublicCorrespondenceVerification } from "@/lib/data/lcdbo-correspondence";

export default async function CorrespondenceVerifyTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const verification = await getPublicCorrespondenceVerification(token);
  return (
    <main className="min-h-screen bg-[#f8faf5] px-6 py-20">
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">LCDBO Correspondence Verification</p>
        {verification ? (
          <>
            <h1 className="mt-3 text-3xl font-black text-slate-950">Correspondence verified</h1>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Info label="Reference" value={verification.reference} />
              <Info label="Issuer" value={verification.issuer} />
              <Info label="Status" value={verification.status} />
              <Info label="Issued" value={verification.issuedAt ? new Date(verification.issuedAt).toLocaleString() : "Recorded"} />
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Subject</p>
              <p className="mt-1 font-bold text-slate-950">{verification.subject}</p>
              <p className="mt-4 break-all text-xs font-mono text-slate-500">Document hash: {verification.documentHash}</p>
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">This public verification confirms the status of the issued correspondence only. It does not expose private documents, internal comments, recipients, approvals or signature assets.</p>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-3xl font-black text-slate-950">Verification record not found</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Check the token and try again. Public verification returns only generic results and does not expose internal correspondence data.</p>
          </>
        )}
        <Link href="/correspondence/verify" className="mt-6 inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-800">Verify another record</Link>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>;
}
