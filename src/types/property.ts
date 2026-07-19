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
  | "awaiting_documents"
  | "awaiting_survey"
  | "awaiting_ownership"
  | "approved"
  | "verified"
  | "active"
  | "transferred"
  | "suspended"
  | "disputed"
  | "archived"
  | "cancelled"
  | "rejected"
  | "returned";

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
export type PropertyGeometryType = "point" | "polygon" | "multipolygon" | "line";
export type PropertyGeometryStatus = "draft" | "submitted" | "verified" | "rejected" | "correction_requested" | "superseded";
export type PropertyGeometrySource = "manual" | "gps" | "survey_plan" | "imported" | "satellite_reference";
export type PropertyGeometryPrivacy = "private" | "registry_only" | "public_generalized";

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
  application_reference: string | null;
  application_submitted_at: string | null;
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

export type PropertyGeometry = {
  id: string;
  property_id: string;
  geometry_type: PropertyGeometryType;
  geojson: JsonRecord;
  centroid_latitude: number | null;
  centroid_longitude: number | null;
  bounding_box: JsonRecord;
  area_value: number | null;
  area_unit: string | null;
  coordinate_system: string;
  survey_plan_number: string | null;
  surveyor_name: string | null;
  surveyor_registration_number: string | null;
  captured_by: string | null;
  captured_at: string;
  verification_status: PropertyGeometryStatus;
  verified_by: string | null;
  verified_at: string | null;
  source: PropertyGeometrySource;
  privacy_visibility: PropertyGeometryPrivacy;
  notes: string | null;
  superseded_at: string | null;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type PropertyGeometryEvent = {
  id: string;
  property_id: string;
  geometry_id: string | null;
  event_type:
    | "geometry.created"
    | "geometry.updated"
    | "geometry.submitted"
    | "geometry.verified"
    | "geometry.rejected"
    | "geometry.correction_requested"
    | "geometry.superseded"
    | "geometry.privacy_changed";
  actor_user_id: string | null;
  summary: string | null;
  metadata: JsonRecord;
  created_at: string;
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
  superseded_by: string | null;
  superseded_at: string | null;
  superseded_by_user_id: string | null;
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

export type PropertyRegistryCaseStatus =
  | "submitted"
  | "under_review"
  | "awaiting_documents"
  | "awaiting_survey"
  | "awaiting_ownership"
  | "approved"
  | "rejected"
  | "returned"
  | "suspended"
  | "cancelled"
  | "verified";

export type PropertyRegistryCase = {
  id: string;
  case_reference: string;
  application_reference: string | null;
  property_id: string;
  claim_id: string | null;
  status: PropertyRegistryCaseStatus;
  priority: "low" | "normal" | "high" | "urgent";
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  decision: string | null;
  decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type PropertyCaseAssignment = {
  id: string;
  case_id: string;
  property_id: string;
  assignment_role: "registry_manager" | "land_registry_officer" | "survey_officer" | "document_verifier" | "property_reviewer" | "title_issuer";
  assigned_to: string | null;
  assigned_by: string | null;
  status: "active" | "reassigned" | "completed" | "cancelled";
  assigned_at: string;
  unassigned_at: string | null;
  notes: string | null;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};

export type PropertyCaseComment = {
  id: string;
  case_id: string;
  property_id: string;
  actor_user_id: string | null;
  comment: string;
  visibility: "internal" | "applicant_visible";
  comment_type: "comment" | "decision_note" | "correction_request" | "assignment_note";
  metadata: JsonRecord;
  created_at: string;
};

export type PropertyCertificate = {
  id: string;
  case_id: string | null;
  property_id: string;
  credential_id: string | null;
  certificate_reference: string;
  certificate_type: "property_registration";
  status: "generated" | "voided" | "superseded";
  generated_by: string | null;
  generated_at: string;
  certificate_payload: JsonRecord;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
};
