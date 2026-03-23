import { redirect } from "next/navigation";

export default function LegacyFirsPage() {
  redirect("/dashboard/nrs");
}
