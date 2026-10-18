import { NextResponse } from "next/server";
import { administrationErrorResponse, AdministrationError, requireVerifiedActor } from "@/lib/institutional/administration-server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const actor = await requireVerifiedActor();
    if (actor.role !== "msme") throw new AdministrationError(403, "A business account is required.");
    const { data, error } = await actor.db.from("institutions")
      .select("id,name,institution_type").eq("status", "active")
      .in("institution_type", ["microfinance_bank", "development_finance_institution"])
      .order("name").limit(200);
    if (error) throw error;
    return NextResponse.json({ institutions: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
