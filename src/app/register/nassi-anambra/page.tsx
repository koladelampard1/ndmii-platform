import { redirect } from "next/navigation";
import {
  NASSI_ANAMBRA_ASSOCIATION_SLUG,
  NASSI_ANAMBRA_REGISTRATION_SOURCE,
} from "@/lib/auth/registration-campaigns";

export default function NassiAnambraRegistrationEntryPage() {
  const params = new URLSearchParams({
    path: "existing_association_member",
    association: NASSI_ANAMBRA_ASSOCIATION_SLUG,
    source: NASSI_ANAMBRA_REGISTRATION_SOURCE,
  });

  redirect(`/register?${params.toString()}`);
}

