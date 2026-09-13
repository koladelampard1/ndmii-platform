import { NextResponse } from "next/server";
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

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Unable to load associations." }, { status: 500 });
    }

    return NextResponse.json({ associations: data ?? [] });
  } catch {
    return NextResponse.json({ associations: [] });
  }
}
