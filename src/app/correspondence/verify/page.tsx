import { redirect } from "next/navigation";

export default function CorrespondenceVerifyPage() {
  async function verify(formData: FormData) {
    "use server";
    const value = String(formData.get("reference") ?? "").trim();
    redirect(`/correspondence/verify/${encodeURIComponent(value)}`);
  }

  return (
    <main className="min-h-screen bg-[#f8faf5] px-6 py-20">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Public verification</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Verify LCDBO correspondence</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Enter the verification token printed on the letter or scan the QR code provided on the issued document.</p>
        <form action={verify} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input required name="reference" placeholder="Verification token" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm" />
          <button className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white">Verify</button>
        </form>
      </section>
    </main>
  );
}
