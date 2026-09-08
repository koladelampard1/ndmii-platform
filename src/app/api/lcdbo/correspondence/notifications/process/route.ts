import { NextResponse } from "next/server";
import { processCorrespondenceNotificationJobs } from "@/lib/data/lcdbo-correspondence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const results = await processCorrespondenceNotificationJobs();
  return NextResponse.json({ processed: results.length, results });
}
