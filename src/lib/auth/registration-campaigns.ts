export const NASSI_ANAMBRA_ASSOCIATION_SLUG = "nassi-anambra";
export const NASSI_ANAMBRA_REGISTRATION_SOURCE = "nassi_anambra_cluster_registration";

export const LEPMAAS_ABIA_ASSOCIATION_SLUG = "lepmaas-abia";
export const LEPMAAS_ABIA_REGISTRATION_SOURCE = "lepmaas_abia_registration";

export const NASSI_ANAMBRA_ASSOCIATION_RECORD = {
  name: "National Association of Small Scale Industrialists (NASSI) – Anambra State",
  slug: NASSI_ANAMBRA_ASSOCIATION_SLUG,
  state: "Anambra",
  sector: "Multi-sector industrial clusters",
  status: "active",
  category: "Industry association",
  location: "Anambra",
  lga_coverage: "Statewide",
  profile: "NASSI Anambra State MSME and industrial cluster mobilisation.",
  description: "Dedicated association record for businesses registering through the NASSI Anambra cluster onboarding link.",
} as const;

export const LEPMAAS_ABIA_ASSOCIATION_RECORD = {
  name: "Leather Product Manufacturer's Association of Abia State (LEPMAAS)",
  slug: LEPMAAS_ABIA_ASSOCIATION_SLUG,
  state: "Abia",
  sector: "Leather products manufacturing",
  status: "active",
  category: "Industry association",
  location: "Abia",
  lga_coverage: "Statewide",
  profile: "LEPMAAS Abia State leather product manufacturers and value-chain businesses.",
  description: "Dedicated association record for businesses registering through the LEPMAAS Abia onboarding link.",
} as const;

export type DedicatedAssociationRecord =
  | typeof NASSI_ANAMBRA_ASSOCIATION_RECORD
  | typeof LEPMAAS_ABIA_ASSOCIATION_RECORD;

const DEDICATED_ASSOCIATION_RECORDS: Record<string, DedicatedAssociationRecord> = {
  [NASSI_ANAMBRA_ASSOCIATION_SLUG]: NASSI_ANAMBRA_ASSOCIATION_RECORD,
  [LEPMAAS_ABIA_ASSOCIATION_SLUG]: LEPMAAS_ABIA_ASSOCIATION_RECORD,
};

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
  [LEPMAAS_ABIA_REGISTRATION_SOURCE]: {
    associationSlug: LEPMAAS_ABIA_ASSOCIATION_SLUG,
    badge: "LEPMAAS · Abia State",
    heading: "Register your leather products business with LEPMAAS",
    description:
      "This dedicated DBIN registration securely links your business to the Leather Product Manufacturer's Association of Abia State (LEPMAAS) for association support, visibility and cluster coordination.",
    state: "Abia",
    source: LEPMAAS_ABIA_REGISTRATION_SOURCE,
  },
};

export function getDedicatedAssociationRecord(slug: string | null | undefined) {
  if (!slug) return null;
  return DEDICATED_ASSOCIATION_RECORDS[slug.trim().toLowerCase()] ?? null;
}

export function getRegistrationCampaign(source: string | null | undefined) {
  if (!source) return null;
  return REGISTRATION_CAMPAIGNS[source.trim().toLowerCase()] ?? null;
}
