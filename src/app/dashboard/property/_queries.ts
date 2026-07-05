import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { canAccessPropertyRegistrationWorkspace } from "@/lib/data/property-foundation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { Property, PropertyAddress, PropertyDocument, PropertyOwner } from "@/types/property";

export type PropertyWorkspaceContext = Awaited<ReturnType<typeof requirePropertyWorkspaceAccess>>;
export type PropertyWithAddress = Property & { primaryAddress?: PropertyAddress | null };
export type EditableProperty = Property & {
  addresses: PropertyAddress[];
  owners: PropertyOwner[];
  documents: PropertyDocument[];
};

export async function requirePropertyWorkspaceAccess() {
  const ctx = await getCurrentUserContext();
  if (ctx.role === "public" || !ctx.appUserId) {
    console.info("[property-workspace-access-denied]", {
      operation: "requirePropertyWorkspaceAccess",
      reason: !ctx.appUserId ? "missing_app_user" : "public_role",
      role: ctx.role,
      authUserId: ctx.authUserId,
      email: ctx.email,
    });
    redirect("/access-denied");
  }
  const supabase = await createServiceRoleSupabaseClient();
  const access = await canAccessPropertyRegistrationWorkspace({ ctx, client: supabase });
  if (!access.allowed) {
    console.info("[property-workspace-access-denied]", {
      operation: "requirePropertyWorkspaceAccess",
      reason: access.source,
      role: ctx.role,
      appUserId: ctx.appUserId,
      moduleStatus: access.moduleStatus,
      roles: access.roles,
    });
    redirect("/access-denied");
  }
  return { ctx, supabase };
}

export async function getPropertyLookups(supabase: PropertyWorkspaceContext["supabase"]) {
  const [countries, states, lgas, categories, wards, communities, villages] = await Promise.all([
    supabase.from("countries").select("id,name,iso2").eq("status", "active").order("name"),
    supabase.from("states").select("id,name,code,country_id").eq("status", "active").order("name"),
    supabase.from("lgas").select("id,name,state_id").eq("status", "active").order("name"),
    supabase.from("property_categories").select("id,category_key,name").eq("status", "active").order("name"),
    supabase.from("property_wards").select("id,name,lga_id").eq("status", "active").order("name"),
    supabase.from("property_communities").select("id,name,lga_id,ward_id").eq("status", "active").order("name"),
    supabase.from("property_villages").select("id,name,lga_id,community_id").eq("status", "active").order("name"),
  ]);
  for (const result of [countries, states, lgas, categories, wards, communities, villages]) {
    if (result.error) throw result.error;
  }
  return {
    countries: countries.data ?? [],
    states: states.data ?? [],
    lgas: lgas.data ?? [],
    categories: categories.data ?? [],
    wards: wards.data ?? [],
    communities: communities.data ?? [],
    villages: villages.data ?? [],
  };
}

export async function listMyProperties(supabase: PropertyWorkspaceContext["supabase"], appUserId: string): Promise<PropertyWithAddress[]> {
  const { data: registered, error: registeredError } = await supabase
    .from("properties")
    .select("*")
    .eq("registered_by", appUserId)
    .order("updated_at", { ascending: false });
  if (registeredError) throw registeredError;

  const { data: ownedRows, error: ownerError } = await supabase
    .from("property_owners")
    .select("properties(*)")
    .eq("owner_user_id", appUserId);
  if (ownerError) throw ownerError;

  const map = new Map<string, Property>();
  for (const property of (registered ?? []) as Property[]) map.set(property.id, property);
  for (const row of ownedRows ?? []) {
    const property = Array.isArray(row.properties) ? row.properties[0] : row.properties;
    if (property?.id) map.set(property.id, property as Property);
  }

  const properties = [...map.values()];
  if (!properties.length) return [];
  const { data: addresses, error: addressError } = await supabase
    .from("property_addresses")
    .select("*")
    .in("property_id", properties.map((property) => property.id))
    .order("is_primary", { ascending: false });
  if (addressError) throw addressError;
  const addressByProperty = new Map<string, PropertyAddress>();
  for (const address of (addresses ?? []) as PropertyAddress[]) if (!addressByProperty.has(address.property_id)) addressByProperty.set(address.property_id, address);
  return properties.map((property) => ({ ...property, primaryAddress: addressByProperty.get(property.id) ?? null }));
}

export async function getEditableProperty(supabase: PropertyWorkspaceContext["supabase"], propertyId: string | null, appUserId: string): Promise<EditableProperty | null> {
  if (!propertyId) return null;
  const [property, addresses, owners, documents] = await Promise.all([
    supabase.from("properties").select("*").eq("id", propertyId).eq("registered_by", appUserId).maybeSingle(),
    supabase.from("property_addresses").select("*").eq("property_id", propertyId).order("is_primary", { ascending: false }),
    supabase.from("property_owners").select("*").eq("property_id", propertyId).order("is_primary", { ascending: false }),
    supabase.from("property_documents").select("*").eq("property_id", propertyId).order("created_at", { ascending: false }),
  ]);
  for (const result of [property, addresses, owners, documents]) {
    if (result.error) throw result.error;
  }
  if (!property.data) return null;
  return {
    ...(property.data as Property),
    addresses: (addresses.data ?? []) as PropertyAddress[],
    owners: (owners.data ?? []) as PropertyOwner[],
    documents: (documents.data ?? []) as PropertyDocument[],
  };
}
