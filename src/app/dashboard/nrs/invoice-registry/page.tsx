import { redirect } from "next/navigation";

export default function LegacyNrsInvoiceRegistryRedirect() {
  redirect("/dashboard/nrs/integrations?legacy=invoice-registry");
}
