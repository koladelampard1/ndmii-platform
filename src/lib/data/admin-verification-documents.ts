export const DOCUMENT_CATEGORIES = [
  "CAC_CERTIFICATE",
  "TIN_PROOF",
  "UTILITY_BILL",
  "TAX_CLEARANCE",
  "BUSINESS_PREMISES_PERMIT",
  "BANK_PROOF",
  "PRODUCT_CERTIFICATION",
  "OTHER",
] as const;

export type VerificationDocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];
export type VerificationDocumentStatus = "missing" | "uploaded" | "accepted" | "rejected" | "expired" | "deleted" | "requested";
export type VerificationDocumentRequestStatus = "requested" | "fulfilled" | "cancelled";
export type VerificationDocumentSignalConfidence = "low" | "medium" | "high";

export type VerificationDocumentChecklistItem = {
  category: VerificationDocumentCategory;
  label: string;
  required: boolean;
  applicable: boolean;
  status: VerificationDocumentStatus | "unavailable";
  uploadedCount: number | null;
  notes: string[];
};

export type VerificationEvidenceDocument = {
  id: string;
  category: VerificationDocumentCategory;
  documentType: string;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  uploadedAt: string | null;
  expiresAt: string | null;
  status: VerificationDocumentStatus;
  stale: boolean;
  previewHref: string;
  downloadHref: string;
};

export type VerificationDocumentRequest = {
  id: string;
  category: VerificationDocumentCategory;
  label: string;
  status: VerificationDocumentRequestStatus;
  requestedBy: string | null;
  requestedAt: string | null;
  fulfilledAt: string | null;
  reason: string | null;
  source: "verification_document_requests" | "verification_reviews" | "verification_review_events";
};

export type VerificationDocumentRiskSignal = {
  id: string;
  category: VerificationDocumentCategory | "MULTIPLE";
  label: string;
  linkedMsmeCount: number | null;
  confidence: VerificationDocumentSignalConfidence;
  reason: string;
};

export type VerificationDocumentCompleteness = {
  percentage: number | null;
  uploadedCount: number | null;
  missingCount: number | null;
  rejectedCount: number | null;
  requestedCount: number | null;
  missingCriticalCount: number | null;
  outstandingRequestCount: number | null;
  reusedSignalCount: number | null;
  rejectedSignalCount: number | null;
};

export type VerificationDocumentIntelligence = {
  available: boolean;
  completeness: VerificationDocumentCompleteness;
  checklist: VerificationDocumentChecklistItem[];
  evidence: VerificationEvidenceDocument[];
  evidenceByCategory: Array<{ category: VerificationDocumentCategory; label: string; documents: VerificationEvidenceDocument[] }>;
  requestedDocuments: VerificationDocumentRequest[];
  outstandingRequests: VerificationDocumentRequest[];
  fulfilledRequests: VerificationDocumentRequest[];
  riskSignals: VerificationDocumentRiskSignal[];
  reviewerFocus: string[];
};

export type VerificationDocumentSourceStates = Partial<Record<string, { available: boolean; message?: string | null }>>;

export type BuildVerificationDocumentIntelligenceInput = {
  msmeId: string;
  documents: Array<Record<string, unknown>>;
  allDocuments?: Array<Record<string, unknown>>;
  complianceItems?: Array<Record<string, unknown>>;
  requirementDefinitions?: Array<Record<string, unknown>>;
  documentEvents?: Array<Record<string, unknown>>;
  review?: Record<string, unknown> | null;
  reviewEvents?: Array<Record<string, unknown>>;
  reviewComments?: Array<Record<string, unknown>>;
  documentRequests?: Array<Record<string, unknown>>;
  usersById?: Map<string, Record<string, unknown>>;
  sources?: VerificationDocumentSourceStates;
  now?: Date;
};

const STALE_DOCUMENT_DAYS = 730;
const ACCEPTED_STATUSES = new Set(["accepted", "approved", "verified", "valid", "complete"]);
const REJECTED_STATUSES = new Set(["rejected", "failed", "invalid", "changes_requested"]);
const EXPIRED_STATUSES = new Set(["expired"]);

const CATEGORY_LABELS: Record<VerificationDocumentCategory, string> = {
  CAC_CERTIFICATE: "CAC certificate",
  TIN_PROOF: "TIN proof",
  UTILITY_BILL: "Address proof / utility bill",
  TAX_CLEARANCE: "Tax clearance",
  BUSINESS_PREMISES_PERMIT: "Business premises permit",
  BANK_PROOF: "Bank proof",
  PRODUCT_CERTIFICATION: "Product certification",
  OTHER: "Other requested documents",
};

const BASE_CHECKLIST: Array<{ category: VerificationDocumentCategory; required: boolean; conditional?: boolean }> = [
  { category: "CAC_CERTIFICATE", required: true },
  { category: "TIN_PROOF", required: true },
  { category: "UTILITY_BILL", required: true },
  { category: "BUSINESS_PREMISES_PERMIT", required: false, conditional: true },
  { category: "TAX_CLEARANCE", required: false, conditional: true },
  { category: "PRODUCT_CERTIFICATION", required: false, conditional: true },
  { category: "BANK_PROOF", required: false, conditional: true },
  { category: "OTHER", required: false, conditional: true },
];

function asString(value: unknown) {
  return String(value ?? "").trim();
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalize(value: unknown) {
  return asString(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizedText(value: unknown) {
  return asString(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function categoryLabel(category: VerificationDocumentCategory) {
  return CATEGORY_LABELS[category];
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function metadataText(value: unknown) {
  const metadata = parseMetadata(value);
  return Object.values(metadata).map((item) => (typeof item === "string" || typeof item === "number" ? String(item) : "")).join(" ");
}

function requestedDocumentsFromReview(value: unknown): string[] {
  const raw = typeof value === "string" ? safeJson(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return asString((item as Record<string, unknown>).label ?? (item as Record<string, unknown>).document_type);
      return "";
    })
    .map(asString)
    .filter(Boolean);
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function canonicalCategory(value: unknown): VerificationDocumentCategory | null {
  const normalized = normalize(value);
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(normalized) ? normalized as VerificationDocumentCategory : null;
}

export function mapEvidenceToDocumentCategory(params: {
  requirementCode?: unknown;
  documentType?: unknown;
  fileName?: unknown;
  metadata?: unknown;
}): VerificationDocumentCategory {
  const text = normalizedText([
    params.requirementCode,
    params.documentType,
    params.fileName,
    metadataText(params.metadata),
  ].map(asString).join(" "));

  if (/\bcac\b|corporate affairs|incorporation|registration certificate|business name certificate/.test(text)) return "CAC_CERTIFICATE";
  if (/\btin\b|tax identification|taxpayer/.test(text)) return "TIN_PROOF";
  if (/utility|address proof|electricity|water bill|tenancy|rent|lease|premises address|proof of address/.test(text)) return "UTILITY_BILL";
  if (/tax clearance|tcc|clearance certificate/.test(text)) return "TAX_CLEARANCE";
  if (/business premises|premises permit|trade permit|shop permit|local government permit/.test(text)) return "BUSINESS_PREMISES_PERMIT";
  if (/bank|account statement|bank proof|bank letter|account confirmation/.test(text)) return "BANK_PROOF";
  if (/product certification|nafdac|son|standard organisation|standard organization|certificate of analysis|product approval/.test(text)) return "PRODUCT_CERTIFICATION";
  return "OTHER";
}

function documentStatus(params: { document: Record<string, unknown>; item?: Record<string, unknown>; now: Date }): VerificationDocumentStatus {
  const itemStatus = normalize(params.item?.status);
  const documentStatusText = normalize(params.document.status);
  const status = itemStatus || documentStatusText;
  if (Boolean(params.document.is_deleted)) return "deleted";
  const expiresAt = asString(params.document.expires_at ?? params.item?.expires_at);
  if (expiresAt && (Date.parse(expiresAt) || 0) < params.now.getTime()) return "expired";
  if (EXPIRED_STATUSES.has(status)) return "expired";
  if (REJECTED_STATUSES.has(status)) return "rejected";
  if (ACCEPTED_STATUSES.has(status) || asString(params.document.verified_at)) return "accepted";
  return "uploaded";
}

function isStale(value: string | null, now: Date) {
  const time = Date.parse(value ?? "");
  if (!Number.isFinite(time)) return false;
  return (now.getTime() - time) / 86_400_000 > STALE_DOCUMENT_DAYS;
}

function findItem(document: Record<string, unknown>, itemsById: Map<string, Record<string, unknown>>) {
  return itemsById.get(asString(document.compliance_item_id));
}

function findRequirementCode(document: Record<string, unknown>, item: Record<string, unknown> | undefined, requirementsById: Map<string, Record<string, unknown>>) {
  const fromItem = asString(item?.requirement_code);
  if (fromItem) return fromItem;
  const requirement = requirementsById.get(asString(document.requirement_id ?? item?.requirement_id));
  return asString(requirement?.code ?? requirement?.requirement_code ?? requirement?.slug);
}

function buildEvidence(input: BuildVerificationDocumentIntelligenceInput, itemsById: Map<string, Record<string, unknown>>, requirementsById: Map<string, Record<string, unknown>>, now: Date) {
  return input.documents.slice(0, 250).map((document) => {
    const item = findItem(document, itemsById);
    const requirementCode = findRequirementCode(document, item, requirementsById);
    const category = mapEvidenceToDocumentCategory({
      requirementCode,
      documentType: document.document_type,
      fileName: document.original_filename,
      metadata: document.metadata,
    });
    const uploadedAt = asString(document.uploaded_at ?? document.created_at) || null;
    const expiresAt = asString(document.expires_at ?? item?.expires_at) || null;
    const id = asString(document.id) || `${category}-${uploadedAt ?? "unknown"}`;
    return {
      id,
      category,
      documentType: asString(document.document_type) || "verification_file",
      fileName: asString(document.original_filename) || "Uploaded verification file",
      mimeType: asString(document.mime_type) || null,
      fileSizeBytes: asNumber(document.file_size_bytes),
      uploadedAt,
      expiresAt,
      status: documentStatus({ document, item, now }),
      stale: isStale(uploadedAt, now),
      previewHref: `/api/msme/compliance/evidence/${encodeURIComponent(id)}?disposition=inline`,
      downloadHref: `/api/msme/compliance/evidence/${encodeURIComponent(id)}?disposition=attachment`,
    } satisfies VerificationEvidenceDocument;
  });
}

function bestStatus(documents: VerificationEvidenceDocument[], outstandingRequests: VerificationDocumentRequest[]): VerificationDocumentStatus {
  if (!documents.length) return outstandingRequests.length ? "requested" : "missing";
  if (documents.some((document) => document.status === "accepted")) return "accepted";
  if (documents.some((document) => document.status === "uploaded")) return "uploaded";
  if (documents.some((document) => document.status === "expired")) return "expired";
  if (documents.some((document) => document.status === "rejected")) return "rejected";
  if (documents.some((document) => document.status === "deleted")) return "deleted";
  return "missing";
}

function requestStatus(value: unknown): VerificationDocumentRequestStatus {
  const normalized = normalize(value);
  if (normalized === "fulfilled" || normalized === "cancelled") return normalized;
  return "requested";
}

function actorLabel(id: unknown, usersById?: Map<string, Record<string, unknown>>) {
  const user = usersById?.get(asString(id));
  return asString(user?.full_name) || asString(user?.email) || asString(id) || null;
}

function buildStructuredRequests(input: BuildVerificationDocumentIntelligenceInput): VerificationDocumentRequest[] {
  return (input.documentRequests ?? [])
    .filter((row) => asString(row.msme_id) === input.msmeId)
    .map((row) => {
      const category = canonicalCategory(row.document_type) ?? mapEvidenceToDocumentCategory({ documentType: row.document_type, fileName: row.label, metadata: row.metadata });
      return {
        id: asString(row.id) || `request-${category}-${asString(row.requested_at)}`,
        category,
        label: asString(row.label) || categoryLabel(category),
        status: requestStatus(row.status),
        requestedBy: actorLabel(row.requested_by, input.usersById),
        requestedAt: asString(row.requested_at ?? row.created_at) || null,
        fulfilledAt: asString(row.fulfilled_at) || null,
        reason: asString(parseMetadata(row.metadata).reason) || null,
        source: "verification_document_requests",
      };
    });
}

function buildLegacyRequests(input: BuildVerificationDocumentIntelligenceInput, existingKeys: Set<string>): VerificationDocumentRequest[] {
  const reviewId = asString(input.review?.id);
  const labels = requestedDocumentsFromReview(input.review?.requested_documents);
  const fromReview = labels.map((label) => {
    const category = mapEvidenceToDocumentCategory({ documentType: label, fileName: label });
    return {
      id: `legacy-review-${reviewId || input.msmeId}-${category}-${normalize(label)}`,
      category,
      label,
      status: "requested" as const,
      requestedBy: actorLabel(input.review?.assigned_reviewer_id, input.usersById),
      requestedAt: asString(input.review?.updated_at ?? input.review?.created_at) || null,
      fulfilledAt: null,
      reason: asString(input.review?.internal_notes) || null,
      source: "verification_reviews" as const,
    };
  });

  const fromEvents = (input.reviewEvents ?? [])
    .filter((row) => asString(row.verification_review_id) === reviewId && normalize(row.event_type) === "request_documents")
    .flatMap((row) => {
      const metadata = parseMetadata(row.metadata);
      return requestedDocumentsFromReview(metadata.requested_documents).map((label) => {
        const category = mapEvidenceToDocumentCategory({ documentType: label, fileName: label });
        return {
          id: `legacy-event-${asString(row.id)}-${category}-${normalize(label)}`,
          category,
          label,
          status: "requested" as const,
          requestedBy: actorLabel(row.actor_id, input.usersById) || asString(row.actor_role) || null,
          requestedAt: asString(row.created_at) || null,
          fulfilledAt: null,
          reason: asString(metadata.reason) || null,
          source: "verification_review_events" as const,
        };
      });
    });

  return [...fromReview, ...fromEvents].filter((request) => {
    const key = `${request.category}:${normalize(request.label)}:${request.requestedAt ?? ""}`;
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });
}

function requestFulfilled(request: VerificationDocumentRequest, evidence: VerificationEvidenceDocument[]) {
  if (request.status !== "requested") return request;
  const matching = evidence.find((document) => document.category === request.category && !["deleted", "rejected", "expired"].includes(document.status));
  if (!matching) return request;
  return { ...request, status: "fulfilled" as const, fulfilledAt: matching.uploadedAt };
}

function documentKey(row: Record<string, unknown>, field: string) {
  const value = asString(row[field]).toLowerCase();
  return value.length >= 3 ? value : "";
}

function storagePattern(value: unknown) {
  const path = asString(value).toLowerCase();
  if (!path) return "";
  return path.split("/").map((part) => (part.length > 20 ? "{id}" : part.replace(/[0-9a-f-]{8,}/g, "{id}"))).join("/");
}

function buildReuseSignals(input: BuildVerificationDocumentIntelligenceInput, evidence: VerificationEvidenceDocument[]): VerificationDocumentRiskSignal[] {
  const all = (input.allDocuments ?? input.documents).filter((row) => !Boolean(row.is_deleted));
  const currentIds = new Set(input.documents.map((row) => asString(row.id)).filter(Boolean));
  const signals: VerificationDocumentRiskSignal[] = [];

  for (const field of ["checksum_sha256", "original_filename"] as const) {
    const grouped = new Map<string, Set<string>>();
    for (const row of all) {
      const key = documentKey(row, field);
      const msmeId = asString(row.msme_id);
      if (!key || !msmeId) continue;
      const set = grouped.get(key) ?? new Set<string>();
      set.add(msmeId);
      grouped.set(key, set);
    }
    for (const row of input.documents) {
      const key = documentKey(row, field);
      const linked = key ? grouped.get(key) : null;
      if (!linked || linked.size < 2) continue;
      const category = evidence.find((document) => document.id === asString(row.id))?.category ?? mapEvidenceToDocumentCategory({ documentType: row.document_type, fileName: row.original_filename, metadata: row.metadata });
      const byChecksum = field === "checksum_sha256";
      signals.push({
        id: `${field}-${asString(row.id)}`,
        category,
        label: byChecksum ? "Possible reused document" : "Original filename reused",
        linkedMsmeCount: linked.size,
        confidence: byChecksum ? "high" : "medium",
        reason: byChecksum ? "Same checksum appears across multiple MSMEs." : "Same original filename appears across multiple MSMEs.",
      });
    }
  }

  const storageGroups = new Map<string, Set<string>>();
  for (const row of all) {
    const pattern = storagePattern(row.storage_path);
    const msmeId = asString(row.msme_id);
    if (!pattern || !msmeId) continue;
    const set = storageGroups.get(pattern) ?? new Set<string>();
    set.add(msmeId);
    storageGroups.set(pattern, set);
  }
  for (const row of input.documents) {
    const pattern = storagePattern(row.storage_path);
    const linked = pattern ? storageGroups.get(pattern) : null;
    if (!linked || linked.size < 2) continue;
    signals.push({
      id: `storage-pattern-${asString(row.id)}`,
      category: mapEvidenceToDocumentCategory({ documentType: row.document_type, fileName: row.original_filename, metadata: row.metadata }),
      label: "Storage path pattern anomaly",
      linkedMsmeCount: linked.size,
      confidence: "low",
      reason: "Similar storage path pattern appears across multiple MSMEs. Private paths are not displayed.",
    });
  }

  const rejectedEvents = (input.documentEvents ?? []).filter((row) => currentIds.has(asString(row.document_id)) && REJECTED_STATUSES.has(normalize(row.event_type)));
  const rejectedByCategory = new Map<VerificationDocumentCategory, number>();
  for (const row of rejectedEvents) {
    const category = mapEvidenceToDocumentCategory({ documentType: row.document_type, fileName: metadataText(row.metadata), metadata: row.metadata });
    rejectedByCategory.set(category, (rejectedByCategory.get(category) ?? 0) + 1);
  }
  for (const [category, count] of rejectedByCategory.entries()) {
    if (count < 2) continue;
    signals.push({
      id: `repeated-rejection-${category}`,
      category,
      label: "Repeated rejected submission",
      linkedMsmeCount: null,
      confidence: "medium",
      reason: `${count} rejection events are linked to this document category.`,
    });
  }

  return Array.from(new Map(signals.map((signal) => [signal.id, signal])).values()).slice(0, 12);
}

function buildChecklist(params: {
  evidence: VerificationEvidenceDocument[];
  requests: VerificationDocumentRequest[];
  input: BuildVerificationDocumentIntelligenceInput;
  available: boolean;
}) {
  const categoriesWithEvidence = new Set(params.evidence.map((document) => document.category));
  const categoriesWithRequests = new Set(params.requests.map((request) => request.category));
  const requirementCategories = new Set(
    (params.input.complianceItems ?? [])
      .filter((item) => asString(item.requirement_code ?? item.requirement_id ?? item.metadata))
      .map((item) => mapEvidenceToDocumentCategory({ requirementCode: item.requirement_code ?? item.requirement_id, metadata: item.metadata })),
  );

  return BASE_CHECKLIST.map((definition) => {
    const category = definition.category;
    const documents = params.evidence.filter((document) => document.category === category && document.status !== "deleted");
    const outstanding = params.requests.filter((request) => request.category === category && request.status === "requested");
    const applicable = definition.required || categoriesWithEvidence.has(category) || categoriesWithRequests.has(category) || requirementCategories.has(category);
    const status = params.available ? bestStatus(documents, outstanding) : "unavailable";
    const notes: string[] = [];
    if (!params.available) notes.push("Unavailable");
    if (status === "missing") notes.push("Missing from available evidence.");
    if (status === "requested") notes.push("Requested but not fulfilled.");
    if (documents.some((document) => document.status === "rejected")) notes.push("Rejected evidence requires reviewer attention.");
    if (documents.some((document) => document.status === "expired")) notes.push("Expired evidence detected where expiry is available.");
    if (documents.some((document) => document.stale)) notes.push("Older upload; check whether a fresh copy is needed.");
    if (!definition.required && !applicable) notes.push("Optional unless required by the reviewer or compliance profile.");
    return {
      category,
      label: categoryLabel(category),
      required: definition.required,
      applicable,
      status,
      uploadedCount: params.available ? documents.length : null,
      notes,
    } satisfies VerificationDocumentChecklistItem;
  });
}

function buildCompleteness(checklist: VerificationDocumentChecklistItem[], evidence: VerificationEvidenceDocument[], requests: VerificationDocumentRequest[], riskSignals: VerificationDocumentRiskSignal[], available: boolean): VerificationDocumentCompleteness {
  if (!available) {
    return {
      percentage: null,
      uploadedCount: null,
      missingCount: null,
      rejectedCount: null,
      requestedCount: null,
      missingCriticalCount: null,
      outstandingRequestCount: null,
      reusedSignalCount: null,
      rejectedSignalCount: null,
    };
  }
  const relevant = checklist.filter((item) => item.required || item.applicable);
  const complete = relevant.filter((item) => item.status === "uploaded" || item.status === "accepted");
  const missing = relevant.filter((item) => item.status === "missing" || item.status === "requested");
  const outstanding = requests.filter((request) => request.status === "requested");
  return {
    percentage: relevant.length ? Math.round((complete.length / relevant.length) * 100) : 100,
    uploadedCount: evidence.filter((document) => document.status !== "deleted").length,
    missingCount: missing.length,
    rejectedCount: checklist.filter((item) => item.status === "rejected").length + evidence.filter((document) => document.status === "rejected").length,
    requestedCount: requests.length,
    missingCriticalCount: checklist.filter((item) => item.required && (item.status === "missing" || item.status === "requested" || item.status === "rejected" || item.status === "expired")).length,
    outstandingRequestCount: outstanding.length,
    reusedSignalCount: riskSignals.filter((signal) => ["Possible reused document", "Original filename reused", "Storage path pattern anomaly"].includes(signal.label)).length,
    rejectedSignalCount: riskSignals.filter((signal) => signal.label === "Repeated rejected submission").length,
  };
}

function buildReviewerFocus(checklist: VerificationDocumentChecklistItem[], requests: VerificationDocumentRequest[], signals: VerificationDocumentRiskSignal[], evidence: VerificationEvidenceDocument[]) {
  const focus: string[] = [];
  const cac = checklist.find((item) => item.category === "CAC_CERTIFICATE");
  if (cac?.status === "uploaded" || cac?.status === "accepted") focus.push("Review CAC certificate");
  const tin = checklist.find((item) => item.category === "TIN_PROOF");
  if (tin?.status === "missing" || tin?.status === "requested") focus.push("TIN proof missing");
  if (requests.some((request) => request.category === "UTILITY_BILL" && request.status === "requested")) focus.push("Address proof requested but not fulfilled");
  if (signals.some((signal) => signal.label.includes("reused") || signal.label.includes("filename"))) focus.push("Possible reused file detected");
  if (evidence.some((document) => document.status === "expired")) focus.push("Expired document requires reviewer check");
  if (evidence.some((document) => document.stale)) focus.push("Stale upload requires freshness review");
  for (const item of checklist) {
    if (focus.length >= 8) break;
    if (item.required && item.status === "missing") focus.push(`${item.label} missing`);
    if (item.status === "rejected") focus.push(`${item.label} has rejected evidence`);
  }
  return Array.from(new Set(focus)).slice(0, 8);
}

export function buildVerificationDocumentIntelligence(input: BuildVerificationDocumentIntelligenceInput): VerificationDocumentIntelligence {
  const now = input.now ?? new Date();
  const available = input.sources?.compliance_documents?.available !== false;
  const itemsById = new Map((input.complianceItems ?? []).map((row) => [asString(row.id), row]));
  const requirementsById = new Map((input.requirementDefinitions ?? []).map((row) => [asString(row.id), row]));
  const evidence = available ? buildEvidence(input, itemsById, requirementsById, now) : [];
  const structured = buildStructuredRequests(input);
  const requestKeys = new Set(structured.map((request) => `${request.category}:${normalize(request.label)}:${request.requestedAt ?? ""}`));
  const requests = [...structured, ...buildLegacyRequests(input, requestKeys)].map((request) => requestFulfilled(request, evidence));
  const riskSignals = available ? buildReuseSignals(input, evidence) : [];
  const checklist = buildChecklist({ evidence, requests, input, available });
  const evidenceByCategory = DOCUMENT_CATEGORIES.map((category) => ({
    category,
    label: categoryLabel(category),
    documents: evidence.filter((document) => document.category === category),
  }));
  return {
    available,
    completeness: buildCompleteness(checklist, evidence, requests, riskSignals, available),
    checklist,
    evidence,
    evidenceByCategory,
    requestedDocuments: requests,
    outstandingRequests: requests.filter((request) => request.status === "requested"),
    fulfilledRequests: requests.filter((request) => request.status === "fulfilled"),
    riskSignals,
    reviewerFocus: buildReviewerFocus(checklist, requests, riskSignals, evidence),
  };
}

export function documentCategoryLabel(category: VerificationDocumentCategory) {
  return categoryLabel(category);
}
