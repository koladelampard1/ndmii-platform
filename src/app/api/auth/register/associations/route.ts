import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from("associations")
      .select("id,name,state,sector,status")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Unable to load associations." }, { status: 500 });
    }

    const associations = (data ?? []).filter((association) => {
      const status = String(association.status ?? "active").toLowerCase();
      return status === "active";
    });

    return NextResponse.json({ associations });
  } catch {
    return NextResponse.json({ associations: [] });
  }
}
