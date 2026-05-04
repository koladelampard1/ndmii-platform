import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from("associations")
      .select("id,name,state,sector,status")
      .eq("status", "active")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Unable to load associations." }, { status: 500 });
    }

    return NextResponse.json({ associations: data ?? [] });
  } catch {
    return NextResponse.json({ associations: [] });
  }
}
