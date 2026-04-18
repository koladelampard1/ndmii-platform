import { redirect } from "next/navigation";
import { TaxVatCompliancePage } from "@/components/msme/tax-vat-compliance-page";
import { getCurrentUserContext } from "@/lib/auth/session";

type Params = { receipt?: string; q?: string; status?: string; compliance?: string; taxType?: string; taxYear?: string };

function toQueryString(params: Params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();

  if (ctx?.role === "msme") {
    redirect(`/dashboard/msme/payments${toQueryString(params)}`);
  }

  return <TaxVatCompliancePage searchParams={params} />;
}
