import { redirect } from "next/navigation";

export default function LegacyNrsRevenueRedirect() {
  redirect("/dashboard/nrs/intelligence?legacy=revenue");
}
