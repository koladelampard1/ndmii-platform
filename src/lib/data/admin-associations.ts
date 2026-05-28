import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SourceState = {
  available: boolean;
  message?: string;
};

export type AdminAssociationFilters = {
  q?: string;
  state?: string;
  sector?: string;
  status?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
};

export type AdminAssociationRow = {
  id: string;
  name: string;
  sector: string | null;
  state: string | null;
  lgaCoverage: string | null;
  status: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  officerUserId: string | null;
  officerName: string | null;
  officerEmail: string | null;
  createdAt: string | null;
  linkedMembersCount: number | null;
  pendingMembershipCount: number | null;
  msmesLinkedCount: number | null;
  importJobsCount: number | null;
};

export type AdminAssociationsKpis = {
  totalAssociations: number | null;
  activeAssociations: number | null;
  totalLinkedMembers: number | null;
  pendingMembershipRequests: number | null;
  msmesLinkedToAssociations: number | null;
  importJobsRecorded: number | null;
};

export type AdminAssociationsDirectory = {
  rows: AdminAssociationRow[];
  kpis: AdminAssociationsKpis;
  sources: Record<string, SourceState>;
  pagination: {
    page: number;
    pageSize: number;
    total: number | null;
    totalPages: number | null;
    from: number;
    to: number;
  };
  filters: Required<Pick<AdminAssociationFilters, "q" | "state" | "sector" | "status" | "sort">>;
  canonicalStrategy: string[];
};

export type AdminAssociationImportRow = {
  id: string;
  associationId: string | null;
  associationName: string | null;
  fileName: string | null;
  totalRows: number | null;
  successRows: number | null;
  failedRows: number | null;
  status: string | null;
  notes: string | null;
  createdAt: string | null;
};

export type AdminAssociationImportRowDetail = {
  id: string;
  rowNumber: number | null;
  businessName: string | null;
  memberName: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
  sector: string | null;
  status: string | null;
  errorMessage: string | null;
};

export type AdminAssociationUploadWorkspace = {
  associations: Array<{ id: string; name: string; state: string | null; sector: string | null }>;
  imports: AdminAssociationImportRow[];
  selectedImportRows: AdminAssociationImportRowDetail[];
  sources: Record<string, SourceState>;
};

export type AdminAssociationMembersWorkspace = {
  association: AdminAssociationRow | null;
  memberPreview: Array<{
    id: string;
    msmeId: string | null;
    businessName: string | null;
    status: string | null;
    inviteStatus: string | null;
    email: string | null;
    phone: string | null;
    source: "association_members" | "msmes.association_id";
  }>;
  pendingMembershipPreview: Array<{
    id: string;
    businessName: string | null;
    msmeId: string | null;
    membershipType: string | null;
    approvalStatus: string | null;
    createdAt: string | null;
  }>;
  imports: AdminAssociationImportRow[];
  sources: Record<string, SourceState>;
  canonicalStrategy: string[];
};

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type AnyRow = Record<string, unknown>;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export const ADMIN_ASSOCIATION_CANONICAL_STRATEGY = [
  "association_members is the Phase 1 operational member table for linked-member counts.",
  "association_memberships is treated as the onboarding/join-request table for pending membership requests.",
  "msmes.association_id is a linkage fallback and rollout-planning signal, not the primary member-management table.",
  "Phase 1 does not migrate, delete, auto-approve, or auto-create MSME records from association imports.",
];

function toString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function nullableString(value: unknown) {
  const stringValue = toString(value).trim();
  return stringValue || null;
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sourceUnavailable(error: unknown): SourceState {
  const message = error instanceof Error ? error.message : "Source unavailable.";
  return { available: false, message };
}

function sourceAvailable(): SourceState {
  return { available: true };
}

export function maskEmail(email: string | null) {
  if (!email) return null;
  const [name, domain] = email.split("@");
  if (!name || !domain) return "Masked email";
  const prefix = name.slice(0, Math.min(2, name.length));
  return `${prefix}${"*".repeat(Math.max(2, name.length - prefix.length))}@${domain}`;
}

export function maskPhone(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "Masked phone";
  return `${phone.slice(0, 4)}****${digits.slice(-3)}`;
}

export function parseAssociationDirectoryFilters(filters: AdminAssociationFilters) {
  const page = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);
  const requestedPageSize = Number.parseInt(filters.pageSize ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(5, requestedPageSize));

  return {
    q: (filters.q ?? "").trim(),
    state: (filters.state ?? "").trim(),
    sector: (filters.sector ?? "").trim(),
    status: (filters.status ?? "").trim(),
    sort: (filters.sort ?? "created_desc").trim() || "created_desc",
    page,
    pageSize,
  };
}

async function safeExactCount(
  supabase: SupabaseClient,
  table: string,
  apply?: (query: any) => any,
) {
  try {
    let query = supabase.from(table).select("id", { count: "exact", head: true });
    if (apply) query = apply(query as never) as typeof query;
    const { count, error } = await query;
    if (error) return { count: null, source: sourceUnavailable(new Error(error.message)) };
    return { count: count ?? 0, source: sourceAvailable() };
  } catch (error) {
    return { count: null, source: sourceUnavailable(error) };
  }
}

async function safeSelect<T extends AnyRow>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  apply?: (query: any) => any,
) {
  try {
    let query = supabase.from(table).select(columns);
    if (apply) query = apply(query as never) as typeof query;
    const { data, error } = await query;
    if (error) return { rows: [] as T[], source: sourceUnavailable(new Error(error.message)) };
    return { rows: (data ?? []) as unknown as T[], source: sourceAvailable() };
  } catch (error) {
    return { rows: [] as T[], source: sourceUnavailable(error) };
  }
}

async function safeSelectWithCount<T extends AnyRow>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  apply?: (query: any) => any,
) {
  try {
    let query = supabase.from(table).select(columns, { count: "exact" });
    if (apply) query = apply(query as never) as typeof query;
    const { data, count, error } = await query;
    if (error) return { rows: [] as T[], count: null, source: sourceUnavailable(new Error(error.message)) };
    return { rows: (data ?? []) as unknown as T[], count: count ?? 0, source: sourceAvailable() };
  } catch (error) {
    return { rows: [] as T[], count: null, source: sourceUnavailable(error) };
  }
}

function applyAssociationFilters(query: any, filters: ReturnType<typeof parseAssociationDirectoryFilters>) {
  let next = query;
  if (filters.q) {
    next = next.or(`name.ilike.%${filters.q}%,profile.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);
  }
  if (filters.state) {
    next = next.or(`state.eq.${filters.state},location.eq.${filters.state}`);
  }
  if (filters.sector) {
    next = next.or(`sector.eq.${filters.sector},category.eq.${filters.sector}`);
  }
  if (filters.status) {
    next = next.ilike("status", filters.status);
  }

  switch (filters.sort) {
    case "created_asc":
      return next.order("created_at", { ascending: true });
    case "name_asc":
      return next.order("name", { ascending: true });
    case "name_desc":
      return next.order("name", { ascending: false });
    case "state_asc":
      return next.order("state", { ascending: true }).order("name", { ascending: true });
    case "status_asc":
      return next.order("status", { ascending: true }).order("name", { ascending: true });
    case "created_desc":
    default:
      return next.order("created_at", { ascending: false });
  }
}

function mapAssociation(row: AnyRow, counts?: Partial<AdminAssociationRow>): AdminAssociationRow {
  const officer = row.users as AnyRow | null | undefined;
  return {
    id: toString(row.id),
    name: toString(row.name) || "Unnamed association",
    sector: nullableString(row.category) ?? nullableString(row.sector),
    state: nullableString(row.location) ?? nullableString(row.state),
    lgaCoverage: nullableString(row.lga_coverage),
    status: nullableString(row.status),
    contactEmail: maskEmail(nullableString(row.contact_email)),
    contactPhone: maskPhone(nullableString(row.contact_phone)),
    officerUserId: nullableString(row.officer_user_id),
    officerName: nullableString(officer?.full_name),
    officerEmail: maskEmail(nullableString(officer?.email)),
    createdAt: nullableString(row.created_at),
    linkedMembersCount: counts?.linkedMembersCount ?? null,
    pendingMembershipCount: counts?.pendingMembershipCount ?? null,
    msmesLinkedCount: counts?.msmesLinkedCount ?? null,
    importJobsCount: counts?.importJobsCount ?? null,
  };
}

async function getAssociationPageRows(
  supabase: SupabaseClient,
  filters: ReturnType<typeof parseAssociationDirectoryFilters>,
) {
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const columns =
    "id,name,state,sector,lga_coverage,profile,status,contact_email,contact_phone,officer_user_id,created_at,category,location,description,slug,users:officer_user_id(full_name,email)";

  let result = await safeSelectWithCount<AnyRow>(supabase, "associations", columns, (query) =>
    applyAssociationFilters(query, filters).range(from, to),
  );

  if (!result.source.available) {
    result = await safeSelectWithCount<AnyRow>(
      supabase,
      "associations",
      "id,name,state,sector,lga_coverage,profile,status,contact_email,contact_phone,officer_user_id,created_at",
      (query) => {
        let next = query;
        if (filters.q) next = next.or(`name.ilike.%${filters.q}%,profile.ilike.%${filters.q}%`);
        if (filters.state) next = next.eq("state", filters.state);
        if (filters.sector) next = next.eq("sector", filters.sector);
        if (filters.status) next = next.ilike("status", filters.status);
        return applyAssociationFilters(next, { ...filters, q: "", state: "", sector: "", status: "" }).range(from, to);
      },
    );
  }

  return { ...result, from, to };
}

async function countsForAssociation(supabase: SupabaseClient, associationId: string) {
  const [members, pending, msmes, imports] = await Promise.all([
    safeExactCount(supabase, "association_members", (query: any) => query.eq("association_id", associationId)),
    safeExactCount(supabase, "association_memberships", (query: any) =>
      query.eq("association_id", associationId).eq("approval_status", "pending"),
    ),
    safeExactCount(supabase, "msmes", (query: any) => query.eq("association_id", associationId)),
    safeExactCount(supabase, "association_member_imports", (query: any) => query.eq("association_id", associationId)),
  ]);

  return {
    counts: {
      linkedMembersCount: members.count,
      pendingMembershipCount: pending.count,
      msmesLinkedCount: msmes.count,
      importJobsCount: imports.count,
    },
    sources: {
      association_members: members.source,
      association_memberships: pending.source,
      msmes: msmes.source,
      association_member_imports: imports.source,
    },
  };
}

export async function getAdminAssociationsDirectory(filtersInput: AdminAssociationFilters): Promise<AdminAssociationsDirectory> {
  const supabase = await createServerSupabaseClient();
  const filters = parseAssociationDirectoryFilters(filtersInput);

  const [associationRows, totalAssociations, activeAssociations, totalLinkedMembers, pendingMemberships, linkedMsmes, importJobs] =
    await Promise.all([
      getAssociationPageRows(supabase, filters),
      safeExactCount(supabase, "associations"),
      safeExactCount(supabase, "associations", (query: any) => query.ilike("status", "active")),
      safeExactCount(supabase, "association_members"),
      safeExactCount(supabase, "association_memberships", (query: any) => query.eq("approval_status", "pending")),
      safeExactCount(supabase, "msmes", (query: any) => query.not("association_id", "is", null)),
      safeExactCount(supabase, "association_member_imports"),
    ]);

  const perAssociationCounts = await Promise.all(associationRows.rows.map((row) => countsForAssociation(supabase, toString(row.id))));
  const countByAssociation = new Map(perAssociationCounts.map((item, index) => [toString(associationRows.rows[index]?.id), item.counts]));

  const rowSources = perAssociationCounts.reduce<Record<string, SourceState>>((acc, item) => {
    for (const [key, source] of Object.entries(item.sources)) {
      acc[key] = acc[key]?.available === false ? acc[key] : source;
    }
    return acc;
  }, {});

  const total = associationRows.count;

  return {
    rows: associationRows.rows.map((row) => mapAssociation(row, countByAssociation.get(toString(row.id)))),
    kpis: {
      totalAssociations: totalAssociations.count,
      activeAssociations: activeAssociations.count,
      totalLinkedMembers: totalLinkedMembers.count,
      pendingMembershipRequests: pendingMemberships.count,
      msmesLinkedToAssociations: linkedMsmes.count,
      importJobsRecorded: importJobs.count,
    },
    sources: {
      associations: associationRows.source.available ? totalAssociations.source : associationRows.source,
      active_associations: activeAssociations.source,
      association_members: totalLinkedMembers.source.available ? rowSources.association_members ?? totalLinkedMembers.source : totalLinkedMembers.source,
      association_memberships: pendingMemberships.source.available
        ? rowSources.association_memberships ?? pendingMemberships.source
        : pendingMemberships.source,
      msmes: linkedMsmes.source.available ? rowSources.msmes ?? linkedMsmes.source : linkedMsmes.source,
      association_member_imports: importJobs.source.available
        ? rowSources.association_member_imports ?? importJobs.source
        : importJobs.source,
    },
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total == null ? null : Math.max(1, Math.ceil(total / filters.pageSize)),
      from: associationRows.from,
      to: associationRows.to,
    },
    filters: {
      q: filters.q,
      state: filters.state,
      sector: filters.sector,
      status: filters.status,
      sort: filters.sort,
    },
    canonicalStrategy: ADMIN_ASSOCIATION_CANONICAL_STRATEGY,
  };
}

export async function getAssociationById(supabase: SupabaseClient, associationId: string) {
  let result = await safeSelect<AnyRow>(
    supabase,
    "associations",
    "id,name,state,sector,lga_coverage,profile,status,contact_email,contact_phone,officer_user_id,created_at,category,location,description,slug,users:officer_user_id(full_name,email)",
    (query: any) => query.eq("id", associationId).limit(1),
  );

  if (!result.source.available) {
    result = await safeSelect<AnyRow>(
      supabase,
      "associations",
      "id,name,state,sector,lga_coverage,profile,status,contact_email,contact_phone,officer_user_id,created_at",
      (query: any) => query.eq("id", associationId).limit(1),
    );
  }

  if (!result.rows[0]) return { association: null, source: result.source };
  const counts = await countsForAssociation(supabase, associationId);
  return {
    association: mapAssociation(result.rows[0], counts.counts),
    source: result.source,
    countSources: counts.sources,
  };
}

function mapImport(row: AnyRow, associationNameById: Map<string, string>): AdminAssociationImportRow {
  const associationId = nullableString(row.association_id);
  return {
    id: toString(row.id),
    associationId,
    associationName: associationId ? associationNameById.get(associationId) ?? null : null,
    fileName: nullableString(row.file_name),
    totalRows: toNumber(row.total_rows),
    successRows: toNumber(row.success_rows),
    failedRows: toNumber(row.failed_rows),
    status: nullableString(row.status),
    notes: nullableString(row.notes),
    createdAt: nullableString(row.created_at),
  };
}

export async function getAdminAssociationUploadWorkspace(selectedImportId?: string | null): Promise<AdminAssociationUploadWorkspace> {
  const supabase = await createServerSupabaseClient();
  const [associationsResult, importsResult] = await Promise.all([
    safeSelect<AnyRow>(supabase, "associations", "id,name,state,sector", (query: any) => query.order("name", { ascending: true }).limit(500)),
    safeSelect<AnyRow>(
      supabase,
      "association_member_imports",
      "id,association_id,file_name,total_rows,success_rows,failed_rows,status,notes,created_at",
      (query: any) => query.order("created_at", { ascending: false }).limit(25),
    ),
  ]);

  const associationNameById = new Map(associationsResult.rows.map((row) => [toString(row.id), toString(row.name)]));
  let importRowsResult = { rows: [] as AnyRow[], source: { available: true } as SourceState };
  if (selectedImportId) {
    importRowsResult = await safeSelect<AnyRow>(
      supabase,
      "association_member_import_rows",
      "id,row_number,member_name,email,phone,business_name,state,sector,status,error_message",
      (query: any) => query.eq("import_id", selectedImportId).order("row_number", { ascending: true }).limit(50),
    );
  }

  return {
    associations: associationsResult.rows.map((row) => ({
      id: toString(row.id),
      name: toString(row.name) || "Unnamed association",
      state: nullableString(row.state),
      sector: nullableString(row.sector),
    })),
    imports: importsResult.rows.map((row) => mapImport(row, associationNameById)),
    selectedImportRows: importRowsResult.rows.map((row) => ({
      id: toString(row.id),
      rowNumber: toNumber(row.row_number),
      businessName: nullableString(row.business_name),
      memberName: nullableString(row.member_name),
      email: maskEmail(nullableString(row.email)),
      phone: maskPhone(nullableString(row.phone)),
      state: nullableString(row.state),
      sector: nullableString(row.sector),
      status: nullableString(row.status),
      errorMessage: nullableString(row.error_message),
    })),
    sources: {
      associations: associationsResult.source,
      association_member_imports: importsResult.source,
      association_member_import_rows: importRowsResult.source,
    },
  };
}

export async function getAdminAssociationMembersWorkspace(associationId?: string | null): Promise<AdminAssociationMembersWorkspace> {
  const supabase = await createServerSupabaseClient();
  const associationResult = associationId ? await getAssociationById(supabase, associationId) : { association: null, source: sourceAvailable() };

  const [membersResult, pendingResult, importsWorkspace] = await Promise.all([
    associationId
      ? safeSelect<AnyRow>(
          supabase,
          "association_members",
          "id,member_status,invite_status,msmes(id,msme_id,business_name,contact_email,contact_phone)",
          (query: any) => query.eq("association_id", associationId).order("created_at", { ascending: false }).limit(25),
        )
      : Promise.resolve({ rows: [] as AnyRow[], source: sourceAvailable() }),
    associationId
      ? safeSelect<AnyRow>(
          supabase,
          "association_memberships",
          "id,membership_type,approval_status,created_at,msmes(id,msme_id,business_name)",
          (query: any) => query.eq("association_id", associationId).order("created_at", { ascending: false }).limit(25),
        )
      : Promise.resolve({ rows: [] as AnyRow[], source: sourceAvailable() }),
    getAdminAssociationUploadWorkspace(null),
  ]);

  return {
    association: associationResult.association,
    memberPreview: membersResult.rows.map((row) => {
      const msme = row.msmes as AnyRow | null | undefined;
      return {
        id: toString(row.id),
        msmeId: nullableString(msme?.msme_id),
        businessName: nullableString(msme?.business_name),
        status: nullableString(row.member_status),
        inviteStatus: nullableString(row.invite_status),
        email: maskEmail(nullableString(msme?.contact_email)),
        phone: maskPhone(nullableString(msme?.contact_phone)),
        source: "association_members",
      };
    }),
    pendingMembershipPreview: pendingResult.rows.map((row) => {
      const msme = row.msmes as AnyRow | null | undefined;
      return {
        id: toString(row.id),
        businessName: nullableString(msme?.business_name),
        msmeId: nullableString(msme?.msme_id),
        membershipType: nullableString(row.membership_type),
        approvalStatus: nullableString(row.approval_status),
        createdAt: nullableString(row.created_at),
      };
    }),
    imports: associationId ? importsWorkspace.imports.filter((item) => item.associationId === associationId) : importsWorkspace.imports,
    sources: {
      associations: associationResult.source,
      association_members: membersResult.source,
      association_memberships: pendingResult.source,
      association_member_imports: importsWorkspace.sources.association_member_imports,
    },
    canonicalStrategy: ADMIN_ASSOCIATION_CANONICAL_STRATEGY,
  };
}

export async function writeAssociationActivityLog({
  supabase,
  actorUserId,
  action,
  associationId,
  metadata,
}: {
  supabase: SupabaseClient;
  actorUserId: string | null;
  action: string;
  associationId: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("activity_logs").insert({
    actor_user_id: actorUserId,
    action,
    entity_type: "associations",
    entity_id: associationId,
    metadata: {
      association_id: associationId,
      source_workspace: "dashboard_admin_associations",
      ...metadata,
    },
  });

  if (error) {
    console.warn("[admin-associations:audit-log-failed]", {
      operation: action,
      associationId,
      code: error.code ?? null,
      message: error.message,
    });
  }
}
