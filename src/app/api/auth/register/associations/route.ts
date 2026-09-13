import { NextResponse } from "next/server";
import {
  NASSI_ANAMBRA_ASSOCIATION_RECORD,
  NASSI_ANAMBRA_ASSOCIATION_SLUG,
} from "@/lib/auth/registration-campaigns";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const requestedSlug = new URL(request.url).searchParams.get("slug")?.trim().toLowerCase();
    const supabase = await createServiceRoleSupabaseClient();
    let query = supabase
      .from("associations")
      .select("id,name,slug,state,sector,status,category,location")
      .eq("status", "active")
      .order("name", { ascending: true });
    if (requestedSlug) query = query.eq("slug", requestedSlug);

    let { data, error } = await query;

    if (!error && requestedSlug === NASSI_ANAMBRA_ASSOCIATION_SLUG && (data?.length ?? 0) === 0) {
      const { error: seedError } = await supabase
        .from("associations")
        .insert(NASSI_ANAMBRA_ASSOCIATION_RECORD);

      if (seedError && seedError.code !== "23505") {
        console.error("[register:dedicated-association-bootstrap-failed]", {
          slug: requestedSlug,
          code: seedError.code,
          message: seedError.message,
        });
        return NextResponse.json({ error: "This dedicated association registration link is not active yet." }, { status: 503 });
      }

      const retry = await supabase
        .from("associations")
        .select("id,name,slug,state,sector,status,category,location")
        .eq("status", "active")
        .eq("slug", requestedSlug)
        .maybeSingle();

      if (retry.error || !retry.data) {
        return NextResponse.json({ error: "This dedicated association registration link is not active yet." }, { status: 503 });
      }

      data = [retry.data];
      error = null;
    }

    if (error) {
      return NextResponse.json({ error: "Unable to load associations." }, { status: 500 });
    }

    return NextResponse.json({ associations: data ?? [] });
  } catch {
    return NextResponse.json({ associations: [] });
  }
}
