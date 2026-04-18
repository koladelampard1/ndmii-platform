import { TaxVatCompliancePage } from "@/components/msme/tax-vat-compliance-page";

type Params = { receipt?: string; q?: string; status?: string; compliance?: string; taxType?: string; taxYear?: string };

export default async function MsmePaymentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  return <TaxVatCompliancePage searchParams={params} msmeOnly />;
}
