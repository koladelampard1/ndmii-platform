"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function AuthCallbackPageContent() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      const code = searchParams.get("code");
      const next = searchParams.get("next") || "/update-password";

      if (!code) {
        router.replace(next);
        router.refresh();
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        if (mounted) {
          setError(exchangeError.message || "Authentication link is invalid or has expired.");
        }
        return;
      }

      router.replace(next);
      router.refresh();
    }

    run();

    return () => {
      mounted = false;
    };
  }, [router, searchParams, supabase]);

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Processing secure sign-in link...</h1>
        <p className="mt-2 text-sm text-slate-600">Please wait while we verify your password setup request.</p>
        {error && <p className="mt-3 rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
      </section>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-16" />}>
      <AuthCallbackPageContent />
    </Suspense>
  );
}
