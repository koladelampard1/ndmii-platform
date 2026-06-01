export type ProfileCompletionInput = {
  businessName?: string | null;
  ownerName?: string | null;
  phone?: string | null;
  email?: string | null;
  businessAddress?: string | null;
  tradeSector?: string | null;
  cacNumber?: string | null;
  tin?: string | null;
  passportPhoto?: string | null;
  bankDetailsPresent?: boolean;
};

export type ProfileCompletionFieldKey =
  | "businessName"
  | "ownerName"
  | "phone"
  | "email"
  | "businessAddress"
  | "tradeSector"
  | "cacNumber"
  | "tin"
  | "passportPhoto"
  | "bankDetails";

export type ProfileCompletionField = {
  key: ProfileCompletionFieldKey;
  label: string;
  taskLabel: string;
  href: string;
  weight: number;
  complete: boolean;
};

export type ProfileCompletion = {
  percentage: number;
  completedFields: ProfileCompletionField[];
  missingFields: ProfileCompletionField[];
};

export type ProfileFeature = "verification" | "digitalIdentity" | "funding" | "marketplace";

export type ProfileFeatureGate = {
  feature: ProfileFeature;
  label: string;
  unlocked: boolean;
  explanation: string;
  missingFields: ProfileCompletionField[];
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function calculateProfileCompletion(profile: ProfileCompletionInput): ProfileCompletion {
  const fields: ProfileCompletionField[] = [
    { key: "businessName", label: "Business Name", taskLabel: "Add Business Name", href: "/dashboard/msme/settings#business-information", weight: 10, complete: hasText(profile.businessName) },
    { key: "ownerName", label: "Owner Name", taskLabel: "Add Owner Name", href: "/dashboard/msme/settings#contact-address", weight: 10, complete: hasText(profile.ownerName) },
    { key: "phone", label: "Phone", taskLabel: "Add Phone Number", href: "/dashboard/msme/settings#contact-address", weight: 10, complete: hasText(profile.phone) },
    { key: "email", label: "Email", taskLabel: "Add Email Address", href: "/dashboard/msme/settings#contact-address", weight: 10, complete: hasText(profile.email) },
    { key: "businessAddress", label: "Business Address", taskLabel: "Complete Business Address", href: "/dashboard/msme/settings#contact-address", weight: 10, complete: hasText(profile.businessAddress) },
    { key: "tradeSector", label: "Trade / Sector", taskLabel: "Add Trade or Sector", href: "/dashboard/msme/settings#business-information", weight: 10, complete: hasText(profile.tradeSector) },
    { key: "cacNumber", label: "CAC", taskLabel: "Add CAC Information", href: "/dashboard/msme/settings#business-information", weight: 10, complete: hasText(profile.cacNumber) },
    { key: "tin", label: "TIN", taskLabel: "Add TIN", href: "/dashboard/msme/payments", weight: 10, complete: hasText(profile.tin) },
    { key: "passportPhoto", label: "Passport Photo", taskLabel: "Upload Passport Photo", href: "/dashboard/msme/settings#contact-address", weight: 10, complete: hasText(profile.passportPhoto) },
    { key: "bankDetails", label: "Bank Details", taskLabel: "Add Bank Details", href: "/dashboard/msme/settings#banking-information", weight: 10, complete: Boolean(profile.bankDetailsPresent) },
  ];
  const completedFields = fields.filter((field) => field.complete);
  return {
    percentage: completedFields.reduce((total, field) => total + field.weight, 0),
    completedFields,
    missingFields: fields.filter((field) => !field.complete),
  };
}

const FEATURE_REQUIREMENTS: Record<Exclude<ProfileFeature, "verification">, ProfileCompletionFieldKey[]> = {
  digitalIdentity: ["businessName", "ownerName", "phone", "businessAddress", "tradeSector", "passportPhoto"],
  funding: ["businessName", "ownerName", "phone", "email", "businessAddress", "tradeSector", "bankDetails"],
  marketplace: ["businessName", "phone", "businessAddress", "tradeSector"],
};

const FEATURE_LABELS: Record<ProfileFeature, string> = {
  verification: "Verification",
  digitalIdentity: "Digital Identity",
  funding: "Funding Opportunities",
  marketplace: "Marketplace Visibility",
};

export function getProfileFeatureGate(feature: ProfileFeature, completion: ProfileCompletion): ProfileFeatureGate {
  const missingFields = feature === "verification"
    ? completion.missingFields
    : completion.missingFields.filter((field) => FEATURE_REQUIREMENTS[feature].includes(field.key));
  const unlocked = feature === "verification" ? completion.percentage >= 70 : missingFields.length === 0;
  return {
    feature,
    label: FEATURE_LABELS[feature],
    unlocked,
    explanation: unlocked
      ? `${FEATURE_LABELS[feature]} is available.`
      : feature === "verification"
        ? "Verification requires at least 70% profile completion."
        : "You need to complete these fields first.",
    missingFields,
  };
}

