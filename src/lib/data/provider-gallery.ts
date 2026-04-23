import type { SupabaseClient } from "@supabase/supabase-js";

const PORTFOLIO_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_PORTFOLIO_BUCKET || "provider-gallery";

const providerGallerySchemaCache = new Map<string, ProviderGallerySchema>();

type ProviderGallerySchema = {
  columns: Set<string>;
  idColumn: string;
  providerRefColumn: string;
  urlColumn: string;
  captionColumn: string | null;
  isFeaturedColumn: string | null;
  sortOrderColumn: string | null;
  updatedAtColumn: string | null;
  createdAtColumn: string | null;
};

function pickFirstExisting(columns: Set<string>, candidates: string[]) {
  for (const candidate of candidates) {
    if (columns.has(candidate)) return candidate;
  }
  return null;
}

export async function getProviderGallerySchema(supabase: SupabaseClient<any>, opts?: { forceRefresh?: boolean }) {
  const cacheKey = "public.provider_gallery";
  if (!opts?.forceRefresh && providerGallerySchemaCache.has(cacheKey)) {
    return providerGallerySchemaCache.get(cacheKey)!;
  }

  const { data, error } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "provider_gallery");

  if (error) {
    throw new Error(`provider_gallery schema introspection failed: ${error.message}`);
  }

  const columns = new Set((data ?? []).map((row: any) => String(row.column_name)));
  const schema: ProviderGallerySchema = {
    columns,
    idColumn: pickFirstExisting(columns, ["id"]) ?? "id",
    providerRefColumn: pickFirstExisting(columns, ["provider_profile_id", "provider_id"]) ?? "provider_id",
    urlColumn: pickFirstExisting(columns, ["asset_url", "image_url", "url", "storage_path", "asset_path", "file_path"]) ?? "asset_url",
    captionColumn: pickFirstExisting(columns, ["caption", "title", "description"]),
    isFeaturedColumn: pickFirstExisting(columns, ["is_featured", "featured"]),
    sortOrderColumn: pickFirstExisting(columns, ["sort_order", "display_order", "position", "order_index"]),
    updatedAtColumn: pickFirstExisting(columns, ["updated_at"]),
    createdAtColumn: pickFirstExisting(columns, ["created_at"]),
  };

  providerGallerySchemaCache.set(cacheKey, schema);
  return schema;
}

function toPublicAssetUrl(supabase: SupabaseClient<any>, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const cleanPath = trimmed.replace(/^\/+/, "");
  return supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(cleanPath).data.publicUrl;
}

export function buildProviderGalleryInsertPayload(params: {
  schema: ProviderGallerySchema;
  providerId: string;
  publicAssetUrl: string;
  storagePath: string;
  caption: string | null;
  isFeatured: boolean;
  sortOrder: number;
}) {
  const { schema, providerId, publicAssetUrl, storagePath, caption, isFeatured, sortOrder } = params;
  const payload: Record<string, unknown> = {
    [schema.providerRefColumn]: providerId,
  };

  payload[schema.urlColumn] = schema.urlColumn.includes("path") ? storagePath : publicAssetUrl;

  if (schema.captionColumn) {
    payload[schema.captionColumn] = caption;
  }
  if (schema.isFeaturedColumn) {
    payload[schema.isFeaturedColumn] = isFeatured;
  }
  if (schema.sortOrderColumn) {
    payload[schema.sortOrderColumn] = sortOrder;
  }
  if (schema.updatedAtColumn) {
    payload[schema.updatedAtColumn] = new Date().toISOString();
  }

  return payload;
}

export async function readProviderGalleryItems(params: {
  supabase: SupabaseClient<any>;
  providerId: string;
  limit?: number;
}) {
  const { supabase, providerId, limit } = params;
  const schema = await getProviderGallerySchema(supabase);

  const selectColumns = [
    schema.idColumn,
    schema.providerRefColumn,
    schema.urlColumn,
    schema.captionColumn,
    schema.isFeaturedColumn,
    schema.sortOrderColumn,
    schema.updatedAtColumn,
    schema.createdAtColumn,
  ].filter(Boolean) as string[];

  let query = supabase
    .from("provider_gallery")
    .select(Array.from(new Set(selectColumns)).join(","))
    .eq(schema.providerRefColumn, providerId);

  if (schema.isFeaturedColumn) {
    query = query.order(schema.isFeaturedColumn, { ascending: false });
  }
  if (schema.sortOrderColumn) {
    query = query.order(schema.sortOrderColumn, { ascending: true });
  }
  if (schema.createdAtColumn) {
    query = query.order(schema.createdAtColumn, { ascending: false });
  }
  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  const normalized = (data ?? [])
    .map((item: Record<string, any>) => {
      const rawAsset = item[schema.urlColumn];
      if (typeof rawAsset !== "string" || rawAsset.trim().length === 0) return null;
      const caption = schema.captionColumn ? item[schema.captionColumn] : null;
      const isFeatured = schema.isFeaturedColumn ? Boolean(item[schema.isFeaturedColumn]) : false;
      const sortOrder = schema.sortOrderColumn ? Number(item[schema.sortOrderColumn] ?? 0) : 0;
      const updatedAt = schema.updatedAtColumn ? item[schema.updatedAtColumn] : null;
      return {
        id: String(item[schema.idColumn]),
        asset_url: toPublicAssetUrl(supabase, rawAsset),
        caption: typeof caption === "string" ? caption : null,
        is_featured: isFeatured,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
        updated_at: typeof updatedAt === "string" ? updatedAt : null,
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    asset_url: string;
    caption: string | null;
    is_featured: boolean;
    sort_order: number;
    updated_at: string | null;
  }>;

  return { schema, items: normalized };
}
