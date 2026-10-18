import { NextResponse } from "next/server";
import { AdministrationError, administrationErrorResponse, recordInstitutionAudit, requireVerifiedActor } from "@/lib/institutional/administration-server";
import { INSTITUTION_TYPES, type InstitutionType } from "@/lib/institutional/administration-policy";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireVerifiedActor();
    const platformAdmin = ["admin", "super_admin"].includes(actor.role);
    if (platformAdmin) {
      const { data, error } = await actor.db.from("institutions")
        .select("id,name,institution_type,status").order("name").limit(200);
      if (error) throw error;
      return NextResponse.json({ institutions: data ?? [], platformAdmin: true }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const { data: memberships, error: membershipError } = await actor.db.from("institution_members")
      .select("id,institution_id,role,status,expires_at").eq("user_id", actor.userId)
      .in("status", ["active", "invited"]).limit(200);
    if (membershipError) throw membershipError;
    const currentMemberships = (memberships ?? []).filter((row) => !row.expires_at || Date.parse(row.expires_at) > Date.now());
    const ids = [...new Set(currentMemberships.map((row) => row.institution_id))];
    if (!ids.length) return NextResponse.json({ institutions: [], memberships: [], platformAdmin: false }, { headers: { "Cache-Control": "private, no-store" } });
    const { data, error } = await actor.db.from("institutions")
      .select("id,name,institution_type,status").in("id", ids).eq("status", "active").order("name");
    if (error) throw error;
    return NextResponse.json({ institutions: data ?? [], memberships: currentMemberships, platformAdmin: false }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await requireVerifiedActor();
    if (!["admin", "super_admin"].includes(actor.role)) throw new AdministrationError(403, "Platform administrator access is required.");
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
    const type = body?.institutionType as InstitutionType;
    if (name.length < 3 || name.length > 160 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80 ||
        !INSTITUTION_TYPES.includes(type)) throw new AdministrationError(400, "Check the institution name, slug and type.");
    const { data, error } = await actor.db.from("institutions")
      .insert({ name, slug, institution_type: type }).select("id,name,slug,institution_type,status").single();
    if (error?.code === "23505") throw new AdministrationError(409, "That institution slug is already in use.");
    if (error || !data) throw error ?? new Error("Institution could not be created.");
    await recordInstitutionAudit(actor.db, { actorId: actor.userId, institutionId: data.id,
      eventType: "institution.created", entityType: "institutions", entityId: data.id });
    // A new institution has no bank users until an existing verified DBIN account is invited.
    return NextResponse.json({ institution: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return administrationErrorResponse(error); }
}
