export const NASSI_ANAMBRA_ASSOCIATION_SLUG = "nassi-anambra";
export const NASSI_ANAMBRA_REGISTRATION_SOURCE = "nassi_anambra_cluster_registration";

export type RegistrationCampaign = {
  associationSlug: string;
  badge: string;
  heading: string;
  description: string;
  state: string;
  source: string;
};

const REGISTRATION_CAMPAIGNS: Record<string, RegistrationCampaign> = {
  [NASSI_ANAMBRA_REGISTRATION_SOURCE]: {
    associationSlug: NASSI_ANAMBRA_ASSOCIATION_SLUG,
    badge: "NASSI · Anambra State",
    heading: "Register your business with the NASSI Anambra clusters",
    description:
      "This dedicated DBIN registration securely links your business to the National Association of Small Scale Industrialists (NASSI), Anambra State, for association support and cluster coordination.",
    state: "Anambra",
    source: NASSI_ANAMBRA_REGISTRATION_SOURCE,
  },
};

export function getRegistrationCampaign(source: string | null | undefined) {
  if (!source) return null;
  return REGISTRATION_CAMPAIGNS[source.trim().toLowerCase()] ?? null;
}

