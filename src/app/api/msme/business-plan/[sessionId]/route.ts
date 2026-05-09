import { NextRequest, NextResponse } from "next/server";
import {
  generateAndPersistBusinessPlan,
  getBusinessPlanSession,
  getBusinessPlanVersions,
  getBusinessPlanWorkspace,
  updateBusinessPlanSession,
} from "@/lib/data/business-plan";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const workspace = await getBusinessPlanWorkspace();
  const session = await getBusinessPlanSession(sessionId, workspace);
  if (!session) return NextResponse.json({ error: "Business plan session not found" }, { status: 404 });

  const versions = await getBusinessPlanVersions(sessionId, workspace);
  return NextResponse.json({ session, versions }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const workspace = await getBusinessPlanWorkspace();
  const body = await request.json().catch(() => ({}));

  if (body?.intent === "generate") {
    const saved = await updateBusinessPlanSession({
      sessionId,
      workspace,
      answers: body?.answers,
      purpose: body?.purpose,
    });
    if (!saved) return NextResponse.json({ error: "Business plan session not found" }, { status: 404 });

    const generated = await generateAndPersistBusinessPlan(sessionId, workspace);
    if (!generated) return NextResponse.json({ error: "Business plan session not found" }, { status: 404 });
    const versions = await getBusinessPlanVersions(sessionId, workspace);
    return NextResponse.json({ session: generated, versions }, { headers: { "Cache-Control": "no-store" } });
  }

  const session = await updateBusinessPlanSession({
    sessionId,
    workspace,
    answers: body?.answers,
    purpose: body?.purpose,
  });
  if (!session) return NextResponse.json({ error: "Business plan session not found" }, { status: 404 });

  return NextResponse.json({ session }, { headers: { "Cache-Control": "no-store" } });
}
