import { redirect } from "next/navigation";
import {
  LEPMAAS_ABIA_ASSOCIATION_SLUG,
  LEPMAAS_ABIA_REGISTRATION_SOURCE,
} from "@/lib/auth/registration-campaigns";

export default function LepmaasAbiaRegistrationEntryPage() {
  const params = new URLSearchParams({
    path: "existing_association_member",
    association: LEPMAAS_ABIA_ASSOCIATION_SLUG,
    source: LEPMAAS_ABIA_REGISTRATION_SOURCE,
  });

  redirect(`/register?${params.toString()}`);
}
