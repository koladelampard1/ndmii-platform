import { redirect } from "next/navigation";

export default function LegacyNrsInvoicesRedirect() {
  redirect("/dashboard/nrs/integrations?legacy=invoices");
}
