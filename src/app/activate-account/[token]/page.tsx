import { redirect } from "next/navigation";
import { activateInviteToken } from "@/lib/associations/invites";

export default async function ActivateAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;

  async function activateAction(formData: FormData) {
    "use server";
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirm_password") ?? "");

    if (password.length < 8) redirect(`/activate-account/${token}?error=Password must be at least 8 characters.`);
    if (password !== confirmPassword) redirect(`/activate-account/${token}?error=Passwords do not match.`);

    const result = await activateInviteToken({ token, password });
    if (!result.ok) redirect(`/activate-account/${token}?error=${encodeURIComponent(result.error ?? "Activation failed")}`);

    redirect("/login?message=Account activated successfully. Sign in to continue.");
  }

  return (
    <main className="mx-auto max-w-md space-y-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Activate your NDMII MSME account</h1>
      <p className="text-sm text-slate-600">Set your secure password to complete account activation.</p>
      {query.error && <p className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{query.error}</p>}

      <form action={activateAction} className="space-y-3 rounded-xl border bg-white p-4">
        <input type="password" name="password" minLength={8} required placeholder="Create password" className="w-full rounded border px-3 py-2" />
        <input type="password" name="confirm_password" minLength={8} required placeholder="Confirm password" className="w-full rounded border px-3 py-2" />
        <button className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Activate account</button>
      </form>
    </main>
  );
}
