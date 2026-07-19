import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/auth/authorization";
import { recordPlatformEvent } from "@/lib/data/platform-foundation";
import { recordPropertyEvent } from "@/lib/data/property-foundation";
import { requirePropertyCaseAccess } from "@/lib/property/property-operations-service";
import type { JsonRecord } from "@/types/platform";
import type { Property, PropertyGeometry, PropertyGeometryEvent, PropertyGeometryPrivacy, PropertyGeometrySource, PropertyGeometryStatus, PropertyGeometryType } from "@/types/property";

type Client = SupabaseClient<any>;

export type BoundaryBox = { minLat: number; minLng: number; maxLat: number; maxLng: number };
export type PublicPropertyMapMarker = {
  npin: string;
  title: string;
  category: string;
  state: string;
  lga: string;
  registryStatus: string;
  latitude: number;
  longitude: number;
  profileHref: string;
};

const GEOMETRY_SELECT = "id,property_id,geometry_type,geojson,centroid_latitude,centroid_longitude,bounding_box,area_value,area_unit,coordinate_system,survey_plan_number,surveyor_name,surveyor_registration_number,captured_by,captured_at,verification_status,verified_by,verified_at,source,privacy_visibility,notes,superseded_at,metadata,created_at,updated_at";
const MUTATION_GEOMETRY_STATUSES = new Set<PropertyGeometryStatus>(["draft", "submitted", "rejected", "correction_requested"]);
const GIS_OPERATE_ROLES = new Set(["admin", "super_admin", "property_admin", "gis_officer", "survey_officer", "land_registry_officer"]);
const GIS_VIEW_ROLES = new Set([...GIS_OPERATE_ROLES, "property_reviewer", "property_data_analyst", "executive_observer"]);

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullable(value: string) {
  return value || null;
}

function numberValue(value: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function roleAllowed(ctx: UserContext, roles: Set<string>) {
  return roles.has(ctx.role);
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function hasActiveScopedRole(input: { userId: string; roles: Set<string>; client: Client }) {
  const { data, error } = await input.client
    .from("role_assignments")
    .select("role,expires_at")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .in("role", [...input.roles]);
  if (error) throw error;
  return (data ?? []).some((assignment) => !assignment.expires_at || new Date(assignment.expires_at).getTime() > Date.now());
}

async function canOperateGis(input: { ctx: UserContext; client: Client; override?: boolean }) {
  if (input.override || roleAllowed(input.ctx, GIS_OPERATE_ROLES)) return true;
  return input.ctx.appUserId ? hasActiveScopedRole({ userId: input.ctx.appUserId, roles: GIS_OPERATE_ROLES, client: input.client }) : false;
}

async function canViewGis(input: { ctx: UserContext; client: Client }) {
  if (roleAllowed(input.ctx, GIS_VIEW_ROLES)) return true;
  return input.ctx.appUserId ? hasActiveScopedRole({ userId: input.ctx.appUserId, roles: GIS_VIEW_ROLES, client: input.client }) : false;
}

function assertLatitude(latitude: number | null) {
  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) throw new Error("Latitude must be between -90 and 90.");
}

function assertLongitude(longitude: number | null) {
  if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) throw new Error("Longitude must be between -180 and 180.");
}

function parseGeojson(input: string): JsonRecord {
  if (!input) return {};
  try {
    const parsed = JSON.parse(input);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Boundary GeoJSON must be an object.");
    return parsed as JsonRecord;
  } catch {
    throw new Error("Boundary GeoJSON is not valid JSON.");
  }
}

function coordinatePairs(geojson: JsonRecord): Array<[number, number]> {
  const type = typeof geojson.type === "string" ? geojson.type : "";
  const coordinates = geojson.coordinates;
  if (!coordinates) return [];
  if (type === "Point" && Array.isArray(coordinates) && coordinates.length >= 2) return [[Number(coordinates[0]), Number(coordinates[1])]];
  if (type === "LineString" && Array.isArray(coordinates)) return coordinates.map((pair) => [Number(pair?.[0]), Number(pair?.[1])] as [number, number]);
  if (type === "Polygon" && Array.isArray(coordinates)) return (coordinates[0] ?? []).map((pair: unknown[]) => [Number(pair?.[0]), Number(pair?.[1])] as [number, number]);
  if (type === "MultiPolygon" && Array.isArray(coordinates)) {
    return coordinates.flatMap((polygon: unknown[][][]) => (polygon[0] ?? []).map((pair: unknown[]) => [Number(pair?.[0]), Number(pair?.[1])] as [number, number]));
  }
  return [];
}

function geometryTypeFor(geojson: JsonRecord, fallback: PropertyGeometryType): PropertyGeometryType {
  if (geojson.type === "Polygon") return "polygon";
  if (geojson.type === "MultiPolygon") return "multipolygon";
  if (geojson.type === "LineString") return "line";
  if (geojson.type === "Point") return "point";
  return fallback;
}

function bboxFromCoordinates(pairs: Array<[number, number]>): BoundaryBox | null {
  const valid = pairs.filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng));
  if (!valid.length) return null;
  return {
    minLat: Math.min(...valid.map(([, lat]) => lat)),
    minLng: Math.min(...valid.map(([lng]) => lng)),
    maxLat: Math.max(...valid.map(([, lat]) => lat)),
    maxLng: Math.max(...valid.map(([lng]) => lng)),
  };
}

function centroidFromBox(box: BoundaryBox | null) {
  if (!box) return { latitude: null as number | null, longitude: null as number | null };
  return {
    latitude: Number(((box.minLat + box.maxLat) / 2).toFixed(7)),
    longitude: Number(((box.minLng + box.maxLng) / 2).toFixed(7)),
  };
}

function boxesOverlap(a: BoundaryBox, b: BoundaryBox) {
  return a.minLat <= b.maxLat && a.maxLat >= b.minLat && a.minLng <= b.maxLng && a.maxLng >= b.minLng;
}

export function boxFromRecord(value: unknown): BoundaryBox | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<Record<keyof BoundaryBox, unknown>>;
  const box = {
    minLat: Number(candidate.minLat),
    minLng: Number(candidate.minLng),
    maxLat: Number(candidate.maxLat),
    maxLng: Number(candidate.maxLng),
  };
  return Object.values(box).every(Number.isFinite) ? box : null;
}

function validateGeometryInput(input: {
  geometryType: PropertyGeometryType;
  geojson: JsonRecord;
  latitude: number | null;
  longitude: number | null;
  areaValue: number | null;
  coordinateSystem: string;
  surveyPlanNumber: string | null;
  surveyorName: string | null;
  surveyorRegistrationNumber: string | null;
}) {
  assertLatitude(input.latitude);
  assertLongitude(input.longitude);
  if (input.areaValue !== null && (!Number.isFinite(input.areaValue) || input.areaValue <= 0)) throw new Error("Area estimate must be positive when provided.");
  const hasSurveyMetadata = Boolean(input.surveyPlanNumber || input.surveyorName || input.surveyorRegistrationNumber);
  if (hasSurveyMetadata && !input.coordinateSystem) throw new Error("Coordinate system is required when survey metadata is entered.");
  const pairs = coordinatePairs(input.geojson);
  if (input.geometryType === "polygon" && pairs.length > 0 && pairs.length < 4) throw new Error("Polygon boundaries require at least four coordinate points including closure.");
  for (const [longitude, latitude] of pairs) {
    assertLatitude(latitude);
    assertLongitude(longitude);
  }
}

async function insertGeometryEvent(input: {
  propertyId: string;
  geometryId: string | null;
  eventType: PropertyGeometryEvent["event_type"];
  actorUserId: string | null;
  summary: string;
  metadata?: JsonRecord;
  client: Client;
}) {
  const { error } = await input.client.from("property_geometry_events").insert({
    property_id: input.propertyId,
    geometry_id: input.geometryId,
    event_type: input.eventType,
    actor_user_id: input.actorUserId,
    summary: input.summary,
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
  await recordPropertyEvent({
    propertyId: input.propertyId,
    eventType: `property.${input.eventType}`,
    entityType: "property_geometry",
    entityId: input.geometryId,
    actorUserId: input.actorUserId,
    summary: input.summary,
    metadata: input.metadata,
    client: input.client,
  });
  await recordPlatformEvent({
    actorUserId: input.actorUserId,
    eventType: `property.${input.eventType}`,
    entityType: "property_geometry",
    entityId: input.geometryId,
    scopeType: "property",
    scopeId: input.propertyId,
    metadata: input.metadata,
    client: input.client,
  });
}

export async function getActivePropertyGeometry(input: { propertyId: string; client: Client }) {
  const { data, error } = await input.client
    .from("property_geometries")
    .select(GEOMETRY_SELECT)
    .eq("property_id", input.propertyId)
    .is("superseded_at", null)
    .neq("verification_status", "superseded")
    .maybeSingle();
  if (error) throw error;
  return data as PropertyGeometry | null;
}

export async function getPropertyGeometryHistory(input: { propertyId: string; client: Client }) {
  const { data, error } = await input.client
    .from("property_geometry_events")
    .select("*")
    .eq("property_id", input.propertyId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as PropertyGeometryEvent[];
}

export async function findPotentialGeometryOverlaps(input: { propertyId: string; boundingBox: BoundaryBox | null; client: Client }) {
  if (!input.boundingBox) return [];
  const { data, error } = await input.client
    .from("property_geometries")
    .select(`${GEOMETRY_SELECT},properties!inner(id,npin,title,status,registry_status)`)
    .neq("property_id", input.propertyId)
    .is("superseded_at", null)
    .in("verification_status", ["submitted", "verified"]);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<PropertyGeometry & { properties?: Pick<Property, "id" | "npin" | "title" | "status" | "registry_status"> | Array<Pick<Property, "id" | "npin" | "title" | "status" | "registry_status">> | null }>)
    .map((geometry) => ({ ...geometry, properties: one(geometry.properties) }))
    .filter((geometry) => {
      const box = boxFromRecord(geometry.bounding_box);
      return box ? boxesOverlap(input.boundingBox!, box) : false;
    })
    .slice(0, 8);
}

export function parseGeometryForm(formData: FormData) {
  const geojson = parseGeojson(value(formData, "boundary_geojson"));
  const explicitGeometryType = (value(formData, "geometry_type") || "point") as PropertyGeometryType;
  const geometryType = geometryTypeFor(geojson, explicitGeometryType);
  const pairs = coordinatePairs(geojson);
  const bbox = bboxFromCoordinates(pairs);
  const centroid = centroidFromBox(bbox);
  const latitude = numberValue(value(formData, "centroid_latitude")) ?? centroid.latitude;
  const longitude = numberValue(value(formData, "centroid_longitude")) ?? centroid.longitude;
  const areaValue = numberValue(value(formData, "geometry_area_value"));
  const coordinateSystem = value(formData, "coordinate_system") || "WGS84";
  const parsed = {
    geometryType,
    geojson,
    latitude,
    longitude,
    boundingBox: bbox ?? (latitude !== null && longitude !== null ? { minLat: latitude, maxLat: latitude, minLng: longitude, maxLng: longitude } : null),
    areaValue,
    areaUnit: nullable(value(formData, "geometry_area_unit")),
    coordinateSystem,
    surveyPlanNumber: nullable(value(formData, "survey_plan_number")),
    surveyorName: nullable(value(formData, "surveyor_name")),
    surveyorRegistrationNumber: nullable(value(formData, "surveyor_registration_number")),
    source: (value(formData, "geometry_source") || "manual") as PropertyGeometrySource,
    privacyVisibility: (value(formData, "privacy_visibility") || "registry_only") as PropertyGeometryPrivacy,
    notes: nullable(value(formData, "geometry_notes")),
    submitGeometry: formData.get("submit_geometry") === "on",
  };
  validateGeometryInput(parsed);
  return parsed;
}

export async function upsertPropertyGeometryFromForm(input: {
  propertyId: string;
  actorUserId: string;
  formData: FormData;
  client: Client;
}) {
  const parsed = parseGeometryForm(input.formData);
  const hasGeometry = parsed.latitude !== null || parsed.longitude !== null || Object.keys(parsed.geojson).length > 0 || parsed.surveyPlanNumber || parsed.surveyorName || parsed.surveyorRegistrationNumber;
  if (!hasGeometry) return null;
  const existing = await getActivePropertyGeometry({ propertyId: input.propertyId, client: input.client });
  if (existing && !MUTATION_GEOMETRY_STATUSES.has(existing.verification_status)) return existing;
  const overlaps = await findPotentialGeometryOverlaps({ propertyId: input.propertyId, boundingBox: parsed.boundingBox, client: input.client });
  const payload = {
    property_id: input.propertyId,
    geometry_type: parsed.geometryType,
    geojson: Object.keys(parsed.geojson).length ? parsed.geojson : {},
    centroid_latitude: parsed.latitude,
    centroid_longitude: parsed.longitude,
    bounding_box: parsed.boundingBox ?? {},
    area_value: parsed.areaValue,
    area_unit: parsed.areaUnit,
    coordinate_system: parsed.coordinateSystem,
    survey_plan_number: parsed.surveyPlanNumber,
    surveyor_name: parsed.surveyorName,
    surveyor_registration_number: parsed.surveyorRegistrationNumber,
    captured_by: input.actorUserId,
    captured_at: new Date().toISOString(),
    verification_status: parsed.submitGeometry ? "submitted" : "draft",
    source: parsed.source,
    privacy_visibility: parsed.privacyVisibility,
    notes: parsed.notes,
    metadata: {
      phase: "dlpi_property_gis_phase5",
      potential_overlap_count: overlaps.length,
      potential_overlap_npins: overlaps.map((item) => item.properties?.npin).filter(Boolean),
    },
  };
  const result = existing
    ? await input.client.from("property_geometries").update(payload).eq("id", existing.id).select(GEOMETRY_SELECT).single()
    : await input.client.from("property_geometries").insert(payload).select(GEOMETRY_SELECT).single();
  if (result.error) throw result.error;
  const geometry = result.data as PropertyGeometry;
  await insertGeometryEvent({
    propertyId: input.propertyId,
    geometryId: geometry.id,
    eventType: existing ? "geometry.updated" : "geometry.created",
    actorUserId: input.actorUserId,
    summary: existing ? "Property geometry updated." : "Property geometry captured.",
    metadata: { potential_overlap_count: overlaps.length },
    client: input.client,
  });
  if (parsed.submitGeometry) {
    await insertGeometryEvent({
      propertyId: input.propertyId,
      geometryId: geometry.id,
      eventType: "geometry.submitted",
      actorUserId: input.actorUserId,
      summary: "Property boundary submitted for registry GIS review.",
      metadata: { potential_overlap_count: overlaps.length },
      client: input.client,
    });
  }
  return geometry;
}

export async function reviewPropertyGeometry(input: { caseId: string; ctx: UserContext; formData: FormData; client: Client }) {
  if (!input.ctx.appUserId) throw new Error("Authentication is required.");
  const access = await requirePropertyCaseAccess({ caseId: input.caseId, ctx: input.ctx, client: input.client, mode: "operate" });
  if (!await canOperateGis({ ctx: input.ctx, client: input.client, override: access.canOverrideCase })) throw new Error("You do not have permission to review property boundaries.");
  const action = value(input.formData, "geometry_action");
  const notes = nullable(value(input.formData, "geometry_note"));
  const geometry = await getActivePropertyGeometry({ propertyId: access.registryCase.property_id, client: input.client });
  if (!geometry) throw new Error("No active property geometry is available for review.");
  const status: PropertyGeometryStatus =
    action === "verify" ? "verified"
      : action === "reject" ? "rejected"
        : action === "request_correction" ? "correction_requested"
          : (() => { throw new Error("Unsupported geometry review action."); })();
  const now = new Date().toISOString();
  const { error } = await input.client
    .from("property_geometries")
    .update({
      verification_status: status,
      verified_by: status === "verified" ? input.ctx.appUserId : null,
      verified_at: status === "verified" ? now : null,
      notes,
      metadata: { ...(geometry.metadata ?? {}), last_review_action: action, last_reviewed_at: now },
    })
    .eq("id", geometry.id);
  if (error) throw error;
  const eventType = status === "verified" ? "geometry.verified" : status === "rejected" ? "geometry.rejected" : "geometry.correction_requested";
  await insertGeometryEvent({
    propertyId: access.registryCase.property_id,
    geometryId: geometry.id,
    eventType,
    actorUserId: input.ctx.appUserId,
    summary: status === "verified" ? "Property boundary verified." : status === "rejected" ? "Property boundary rejected." : "Property boundary correction requested.",
    metadata: { note: notes },
    client: input.client,
  });
}

export async function loadGisWorkbench(input: { client: Client; ctx: UserContext }) {
  await input.client.from("platform_modules").select("id").eq("module_key", "property_gis").maybeSingle();
  if (!input.ctx.appUserId || !await canViewGis({ ctx: input.ctx, client: input.client })) {
    throw new Error("You do not have access to the GIS workbench.");
  }
  const { data, error } = await input.client
    .from("property_geometries")
    .select(`${GEOMETRY_SELECT},properties!inner(id,npin,application_reference,title,property_type,status,registry_status,state_id,lga_id,registered_by)`)
    .is("superseded_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const geometries = ((data ?? []) as unknown as Array<PropertyGeometry & { properties: Property | Property[] }>).map((geometry) => ({
    ...geometry,
    properties: one(geometry.properties) as Property,
  }));
  const overlaps = await Promise.all(geometries.map(async (geometry) => ({
    geometryId: geometry.id,
    overlaps: await findPotentialGeometryOverlaps({ propertyId: geometry.property_id, boundingBox: boxFromRecord(geometry.bounding_box), client: input.client }),
  })));
  const overlapByGeometry = new Map(overlaps.map((item) => [item.geometryId, item.overlaps]));
  return {
    geometries,
    overlapByGeometry,
    metrics: {
      submitted: geometries.filter((item) => item.verification_status === "submitted").length,
      verified: geometries.filter((item) => item.verification_status === "verified").length,
      rejected: geometries.filter((item) => item.verification_status === "rejected").length,
      overlapWarnings: overlaps.reduce((sum, item) => sum + (item.overlaps.length ? 1 : 0), 0),
    },
  };
}

export async function getPublicPropertyMapMarkers(input: { client: Client }) {
  const { data, error } = await input.client
    .from("property_geometries")
    .select(`${GEOMETRY_SELECT},properties!inner(npin,title,property_type,status,registry_status,state_id,lga_id,property_category_id)`)
    .eq("privacy_visibility", "public_generalized")
    .eq("verification_status", "verified")
    .not("centroid_latitude", "is", null)
    .not("centroid_longitude", "is", null)
    .limit(200);
  if (error) throw error;
  const rows = ((data ?? []) as unknown as Array<PropertyGeometry & { properties: Property | Property[] }>).map((geometry) => ({
    ...geometry,
    properties: one(geometry.properties) as Property,
  }));
  const stateIds = [...new Set(rows.map((row) => row.properties?.state_id).filter(Boolean))] as string[];
  const lgaIds = [...new Set(rows.map((row) => row.properties?.lga_id).filter(Boolean))] as string[];
  const categoryIds = [...new Set(rows.map((row) => row.properties?.property_category_id).filter(Boolean))] as string[];
  const [states, lgas, categories] = await Promise.all([
    stateIds.length ? input.client.from("states").select("id,name").in("id", stateIds) : Promise.resolve({ data: [], error: null }),
    lgaIds.length ? input.client.from("lgas").select("id,name").in("id", lgaIds) : Promise.resolve({ data: [], error: null }),
    categoryIds.length ? input.client.from("property_categories").select("id,name").in("id", categoryIds) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [states, lgas, categories]) if (result.error) throw result.error;
  const stateMap = new Map((states.data ?? []).map((item) => [item.id, item.name]));
  const lgaMap = new Map((lgas.data ?? []).map((item) => [item.id, item.name]));
  const categoryMap = new Map((categories.data ?? []).map((item) => [item.id, item.name]));
  return rows
    .filter((row) => row.properties?.npin && row.centroid_latitude !== null && row.centroid_longitude !== null)
    .map((row): PublicPropertyMapMarker => ({
      npin: row.properties.npin!,
      title: row.properties.title || row.properties.property_type.replaceAll("_", " "),
      category: row.properties.property_category_id ? categoryMap.get(row.properties.property_category_id) ?? row.properties.property_type.replaceAll("_", " ") : row.properties.property_type.replaceAll("_", " "),
      state: row.properties.state_id ? stateMap.get(row.properties.state_id) ?? "State unavailable" : "State unavailable",
      lga: row.properties.lga_id ? lgaMap.get(row.properties.lga_id) ?? "LGA unavailable" : "LGA unavailable",
      registryStatus: row.properties.registry_status.replaceAll("_", " "),
      latitude: Number(Number(row.centroid_latitude).toFixed(2)),
      longitude: Number(Number(row.centroid_longitude).toFixed(2)),
      profileHref: `/property/${encodeURIComponent(row.properties.npin!)}`,
    }));
}
