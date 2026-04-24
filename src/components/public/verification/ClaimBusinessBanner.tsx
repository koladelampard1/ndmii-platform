import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClaimBusinessBanner() {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <span className="rounded-full bg-white p-2 text-emerald-700">
          <Store className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Is this your business?</h3>
          <p className="mt-1 text-sm text-slate-600">Claim and manage your business identity profile to unlock verification upgrades and institutional visibility.</p>
        </div>
      </div>
      <Button className="bg-emerald-700 hover:bg-emerald-600">Claim this business</Button>
    </section>
  );
}
