import { NextRequest, NextResponse } from "next/server";
import {
  createBusinessPlanSession,
  getBusinessPlanWorkspace,
  listBusinessPlanSessions,
  type BusinessPlanPurpose,
} from "@/lib/data/business-plan";

export async function GET() {
  const workspace = await getBusinessPlanWorkspace();
  const sessions = await listBusinessPlanSessions(workspace);
  return NextResponse.json({ sessions }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const workspace = await getBusinessPlanWorkspace();
  const body = await request.json().catch(() => ({}));
  const session = await createBusinessPlanSession(workspace, body?.purpose as BusinessPlanPurpose | undefined);
  return NextResponse.json({ session }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
