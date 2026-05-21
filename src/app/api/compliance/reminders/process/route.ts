import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

function isAuthorized(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  const cronSecret = process.env.CRON_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headerSecret = request.headers.get("x-cron-secret") ?? "";

  if (cronSecret) {
    return bearerToken === cronSecret || headerSecret === cronSecret;
  }

  return Boolean(serviceRoleKey && bearerToken === serviceRoleKey);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceRoleSupabaseClient();

  const { data: expiryProcessed, error: expiryError } = await supabase.rpc("run_compliance_expiry_job");
  if (expiryError) {
    console.info("[compliance-reminders-process]", {
      operation: "run_compliance_expiry_job",
      status: "failed",
      code: expiryError.code,
      message: expiryError.message,
    });
    return NextResponse.json({ error: "Expiry job failed", code: expiryError.code }, { status: 500 });
  }

  const { data: reminderProcessed, error: reminderError } = await supabase.rpc("process_due_compliance_reminders");
  if (reminderError) {
    console.info("[compliance-reminders-process]", {
      operation: "process_due_compliance_reminders",
      status: "failed",
      processedCount: expiryProcessed ?? 0,
      code: reminderError.code,
      message: reminderError.message,
    });
    return NextResponse.json({ error: "Reminder processing failed", code: reminderError.code }, { status: 500 });
  }

  console.info("[compliance-reminders-process]", {
    operation: "process",
    status: "sent",
    processedCount: {
      expiry: expiryProcessed ?? 0,
      reminders: reminderProcessed ?? 0,
    },
  });

  return NextResponse.json({
    ok: true,
    expiryProcessed: expiryProcessed ?? 0,
    remindersProcessed: reminderProcessed ?? 0,
  });
}
