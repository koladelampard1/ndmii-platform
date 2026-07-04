import type { JsonRecord } from "@/types/platform";

export type PropertyType =
  | "residential"
  | "commercial"
  | "industrial"
  | "agricultural"
  | "mining"
  | "institutional"
  | "mixed_use"
  | "government"
  | "infrastructure"
  | "protected";

export type PropertyLifecycleStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "verified"
  | "active"
  | "transferred"
  | "suspended"
  | "disputed"
  | "archived"
  | "cancelled";

export type PropertyOwnerType =
  | "individual"
  | "joint"
  | "corporate"
  | "government"
  | "institution"
  | "community"
  | "cooperative"
  | "trust"
  | "family_estate";

export type PropertyOwnerVerificationStatus = "unverified" | "pending_review" | "verified" | "rejected" | "superseded";
export type PropertyClaimType = "registration" | "ownership" | "transfer" | "correction" | "dispute" | "verification";
export type PropertyClaimStatus = "draft" | "submitted" | "under_review" | "verified" | "approved" | "rejected" | "withdrawn" | "cancelled";
export type PropertyCredentialStatus = "issued" | "revoked" | "superseded" | "suspended";

export type PropertyDocumentType =
  | "survey_plan"
  | "certificate_of_occupancy"
  | "deed_of_assignment"
  | "allocation_letter"
  | "gazette"
  | "governors_consent"
  | "power_of_attorney"
  | "valuation_report"
  | "court_order"
  | "tax_clearance"
  | "building_approval"
  | "photographs"
  | "supporting_evidence";

export type PropertyDocumentStatus = "pending_review" | "accepted" | "rejected" | "expired" | "superseded" | "archived";

export type PropertyScopedRole =
  | "property_admin"
  | "land_registry_officer"
  | "survey_officer"
  | "gis_officer"
  | "property_reviewer"
  | "valuation_officer"
  | "document_verifier"
  | "title_issuer"
  | "property_data_analyst"
  | "property_auditor"
  | "executive_observer";

export type PropertyModuleKey =
  | "property_registry"
  | "property_verification"
  | "property_documents"
  | "property_intelligence"
  | "property_public_explorer"
  | "property_registry_operations"
  | "property_gis";

export type PropertyCategory = {
  id: string;
  category_key: PropertyType;
  name: string;
  description: string | null;
  status: "active" | "inactive" | "archived";
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type PropertyGeographyStatus = "active" | "inactive" | "archived";

export type PropertyWard = {
  id: string;
  lga_id: string;
  name: string;
  code: string | null;
  status: PropertyGeographyStatus;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type PropertyDistrict = {
  id: string;
  lga_id: string;
  ward_id: string | null;
  name: string;
  code: string | null;
  status: PropertyGeographyStatus;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type PropertyCommunity = {
  id: string;
  lga_id: string;
  ward_id: string | null;
  district_id: string | null;
  name: string;
  code: string | null;
  status: PropertyGeographyStatus;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type PropertyVillage = {
  id: string;
  lga_id: string;
  ward_id: string | null;
  district_id: string | null;
  community_id: string | null;
  name: string;
  code: string | null;
  status: PropertyGeographyStatus;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type SurveyBlock = {
  id: string;
  country_id: string | null;
  state_id: string | null;
  lga_id: string | null;
  ward_id: string | null;
  district_id: string | null;
  community_id: string | null;
  name: string;
  code: string;
  description: string | null;
  geometry_placeholder: JsonRecord;
  status: PropertyGeographyStatus;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type Property = {
  id: string;
  npin: string | null;
  parcel_reference: string | null;
  property_category_id: string | null;
  property_type: PropertyType;
  title: string | null;
  description: string | null;
  country_id: string | null;
  state_id: string | null;
  lga_id: string | null;
  ward_id: string | null;
  district_id: string | null;
  community_id: string | null;
  village_id: string | null;
  survey_block_id: string | null;
  status: PropertyLifecycleStatus;
  registry_status: PropertyLifecycleStatus;
  area_size: number | null;
  area_unit: string | null;
  geometry_placeholder: JsonRecord;
  registered_by: string | null;
  registry_institution_id: string | null;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type PropertyAddress = {
  id: string;
  property_id: string;
  country_id: string | null;
  state_id: string | null;
  lga_id: string | null;
  ward_id: string | null;
  district_id: string | null;
  community_id: string | null;
  village_id: string | null;
  street: string | null;
  building: string | null;
  plot: string | null;
  block: string | null;
  parcel_reference: string | null;
  centroid_latitude: number | null;
  centroid_longitude: number | null;
  traditional_description: string | null;
  is_primary: boolean;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type PropertyClaim = {
  id: string;
  property_id: string | null;
  claim_reference: string;
  claimant_type: PropertyOwnerType;
  claimant_user_id: string | null;
  claimant_institution_id: string | null;
  claimant_msme_id: string | null;
  claimant_name: string | null;
  claim_type: PropertyClaimType;
  status: PropertyClaimStatus;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type PropertyOwner = {
  id: string;
  property_id: string;
  owner_type: PropertyOwnerType;
  owner_user_id: string | null;
  owner_institution_id: string | null;
  owner_msme_id: string | null;
  owner_name: string | null;
  owner_identifier: string | null;
  ownership_percentage: number | null;
  is_primary: boolean;
  verification_status: PropertyOwnerVerificationStatus;
  effective_from: string | null;
  effective_to: string | null;
  source_claim_id: string | null;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type PropertyOwnerHistory = {
  id: string;
  property_id: string;
  property_owner_id: string | null;
  change_type: "added" | "updated" | "verified" | "transferred" | "removed" | "superseded";
  previous_values: JsonRecord;
  new_values: JsonRecord;
  changed_by: string | null;
  change_note: string | null;
  effective_at: string;
  metadata: JsonRecord;
  created_at: string;
};

export type PropertyIdentityCredential = {
  id: string;
  property_id: string;
  npin: string;
  credential_reference: string;
  status: PropertyCredentialStatus;
  issued_by: string | null;
  issued_at: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
  superseded_by: string | null;
  suspended_at: string | null;
  token_expires_at: string | null;
  public_token: string | null;
  public_token_hash: string | null;
  qr_code_ref: string | null;
  verification_url: string | null;
  verification_snapshot: JsonRecord;
  signature_version: string | null;
  public_signature: string | null;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type PropertyDocument = {
  id: string;
  property_id: string | null;
  claim_id: string | null;
  document_type_id: string | null;
  document_type: PropertyDocumentType;
  title: string;
  description: string | null;
  document_reference: string | null;
  issuer: string | null;
  issued_at: string | null;
  status: PropertyDocumentStatus;
  file_name: string | null;
  file_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  checksum_sha256: string | null;
  uploaded_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type PropertyEvent = {
  id: string;
  property_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  actor_user_id: string | null;
  actor_institution_id: string | null;
  summary: string | null;
  metadata: JsonRecord;
  created_at: string;
};
