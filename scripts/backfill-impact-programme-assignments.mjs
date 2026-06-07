#!/usr/bin/env node
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const eligibleRoles = ["programme_officer", "assessment_officer"];

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() || null : null;
}

const userEmail = argumentValue("--user-email");
const programmeCode = argumentValue("--programme-code");
const requestedRole = argumentValue("--role");

function log(message, details) {
  if (details === undefined) console.log(message);
  else console.log(message, details);
}

async function main() {
  log(`Impact programme assignment backfill (${apply ? "APPLY" : "DRY RUN"})`);
  log("Filters", { userEmail, programmeCode, role: requestedRole });

  if (requestedRole && !eligibleRoles.includes(requestedRole)) {
    throw new Error(`--role must be one of: ${eligibleRoles.join(", ")}`);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    log("No database connection was attempted.");
    log("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY to inspect assignments.");
    log("Dry-run mode is the default. Add --apply only after reviewing the proposed assignments.");
    if (apply) process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let usersQuery = supabase.from("users").select("id,email,role").in("role", eligibleRoles).order("role");
  let programmesQuery = supabase.from("impact_programmes").select("id,name,programme_code,status").order("created_at");
  if (userEmail) usersQuery = usersQuery.ilike("email", userEmail);
  if (requestedRole) usersQuery = usersQuery.eq("role", requestedRole);
  if (programmeCode) programmesQuery = programmesQuery.ilike("programme_code", programmeCode);

  const [usersResult, programmesResult, assignmentsResult] = await Promise.all([
    usersQuery,
    programmesQuery,
    supabase
      .from("impact_user_programme_assignments")
      .select("user_id,programme_id,assignment_role,status")
      .eq("status", "active")
      .in("assignment_role", eligibleRoles),
  ]);

  const error = usersResult.error || programmesResult.error || assignmentsResult.error;
  if (error) throw new Error(`Backfill source unavailable: ${error.message}`);

  const users = usersResult.data ?? [];
  const programmes = programmesResult.data ?? [];
  const existing = new Set(
    (assignmentsResult.data ?? []).map(
      (row) => `${row.user_id}:${row.programme_id}:${row.assignment_role}`,
    ),
  );

  log(`Eligible users: ${users.length}`);
  log(`Existing programmes: ${programmes.length}`);
  log(`Existing active matching assignments: ${existing.size}`);

  if (!userEmail || !programmeCode) {
    log("No assignments proposed. Provide both --user-email and --programme-code to target an assignment explicitly.");
    log("Optional: add --role to validate the user's assignment role, and --apply after reviewing the dry run.");
    return;
  }

  if (users.length === 0) {
    log("No programme or assessment officers require backfill.");
    return;
  }
  if (programmes.length === 0) {
    log("No programme exists. No assignments will be created.");
    return;
  }

  const proposed = [];
  for (const user of users) {
    for (const programme of programmes) {
      const key = `${user.id}:${programme.id}:${user.role}`;
      if (existing.has(key)) continue;
      proposed.push({
        user_id: user.id,
        programme_id: programme.id,
        assignment_role: user.role,
        status: "active",
        reason: "Phase 2 explicit programme assignment backfill",
        metadata: {
          source: "backfill-impact-programme-assignments",
          explicit_user_email: userEmail,
          explicit_programme_code: programmeCode,
        },
      });
      log(
        `WOULD ASSIGN ${user.role} ${user.email} to programme ${programme.programme_code ?? programme.id} (${programme.name})`,
      );
    }
  }

  if (proposed.length === 0) {
    log("No new active assignments are required.");
    return;
  }
  if (!apply) {
    log(`Dry run complete. ${proposed.length} assignment(s) would be created.`);
    log("Re-run with --apply to write these assignments.");
    return;
  }

  const { error: insertError } = await supabase
    .from("impact_user_programme_assignments")
    .insert(proposed);
  if (insertError) throw new Error(`Assignment backfill failed: ${insertError.message}`);
  log(`Applied ${proposed.length} programme assignment(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
