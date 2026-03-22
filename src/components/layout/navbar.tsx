import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";

async function signOutAction() {
  "use server";
  const store = await cookies();
  ["ndmii_auth", "ndmii_role", "ndmii_email", "ndmii_auth_user_id", "ndmii_app_user_id"].forEach((name) => store.delete(name));
  redirect("/login?message=Signed out successfully");
}

export async function Navbar() {
  const { email, role } = await getCurrentUserContext();

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold">NDMII Platform</Link>
        <nav className="flex items-center gap-3">
          <Link href="/verify" className="text-sm text-slate-600">Verify ID</Link>
          {email ? (
            <>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs uppercase tracking-wide text-slate-600">{role}</span>
              <form action={signOutAction}>
                <Button size="sm" variant="secondary">Sign out</Button>
              </form>
            </>
          ) : (
            <Link href="/login"><Button size="sm">Sign in</Button></Link>
          )}
        </nav>
      </div>
    </header>
  );
}
