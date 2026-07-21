import { redirect } from "next/navigation";

export default function LegacyNrsVatMonitorRedirect() {
  redirect("/dashboard/nrs/readiness?legacy=vat-monitor");
}
