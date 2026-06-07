#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const RECORD_PREFIX = "DEMO - RBAC";
const METADATA_PREFIX = "impact-rbac-uat-v1";
const EXPECTED_USERS = [
  ["superadmin@uat.ndmii.test", "super_admin"],
  ["admin@uat.ndmii.test", "admin"],
  ["executive@uat.ndmii.test", "boi_executive"],
  ["po.a@uat.ndmii.test", "programme_officer"],
  ["po.b@uat.ndmii.test", "programme_officer"],
  ["ao.a@uat.ndmii.test", "assessment_officer"],
  ["fo.a@uat.ndmii.test", "field_officer"],
  ["analyst@uat.ndmii.test", "data_analyst"],
  ["auditor@uat.ndmii.test", "auditor"],
];

function loadLocalEnv() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fail(label, error) {
  throw new Error(`${label}: ${error?.message ?? String(error)}`);
}

loadLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listAllAuthUsers() {
  const users = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) fail("Could not list Auth users", error);
    users.push(...data.users);
    if (data.users.length < perPage) return users;
    page += 1;
  }
}

async function main() {
  const checks = [];
  const pass = (message) => {
    checks.push(message);
    console.log(`[impact-rbac-uat] PASS ${message}`);
  };

  const authUsers = await listAllAuthUsers();
  const emails = EXPECTED_USERS.map(([email]) => email);
  const { data: appUsers, error: appUsersError } = await supabase
    .from("users")
    .select("id,email,full_name,role,auth_user_id")
    .in("email", emails);
  if (appUsersError) fail("Could not query public.users", appUsersError);

  const usersByEmail = new Map(appUsers.map((user) => [user.email.toLowerCase(), user]));
  for (const [email, role] of EXPECTED_USERS) {
    const authUser = authUsers.find((user) => user.email?.toLowerCase() === email);
    const appUser = usersByEmail.get(email);
    assert(authUser, `Missing Supabase Auth user ${email}.`);
    assert(appUser, `Missing public.users record ${email}.`);
    assert(appUser.role === role, `${email} has public.users role ${appUser.role}, expected ${role}.`);
    assert(appUser.auth_user_id === authUser.id, `${email} Auth linkage is incorrect.`);
    assert(appUser.full_name.startsWith(RECORD_PREFIX), `${email} is not clearly labelled as UAT data.`);
    assert(authUser.app_metadata?.role === role, `${email} Auth app_metadata role is incorrect.`);
  }
  pass("all Auth and public.users records exist with correct roles and linkage");

  const { data: programmes, error: programmesError } = await supabase
    .from("impact_programmes")
    .select("id,name,programme_code,metadata")
    .in("programme_code", ["DEMO-RBAC-A", "DEMO-RBAC-B"]);
  if (programmesError) fail("Could not query UAT programmes", programmesError);
  assert(programmes.length === 2, "Expected exactly two DEMO RBAC programmes.");
  const programmeA = programmes.find((row) => row.programme_code === "DEMO-RBAC-A");
  const programmeB = programmes.find((row) => row.programme_code === "DEMO-RBAC-B");
  assert(programmeA?.name === "DEMO - RBAC Programme A", "Programme A is missing or mislabeled.");
  assert(programmeB?.name === "DEMO - RBAC Programme B", "Programme B is missing or mislabeled.");
  assert(programmeA.metadata?.demo_key === `${METADATA_PREFIX}:programme-a`, "Programme A demo metadata is incorrect.");
  assert(programmeB.metadata?.demo_key === `${METADATA_PREFIX}:programme-b`, "Programme B demo metadata is incorrect.");
  pass("Programme A and Programme B exist and are clearly marked as UAT data");

  const { data: cohorts, error: cohortsError } = await supabase
    .from("impact_beneficiary_cohorts")
    .select("id,programme_id,name,metadata")
    .in("programme_id", [programmeA.id, programmeB.id]);
  if (cohortsError) fail("Could not query UAT cohorts", cohortsError);
  const cohortA = cohorts.find((row) => row.metadata?.demo_key === `${METADATA_PREFIX}:programme-a:cohort`);
  const cohortB = cohorts.find((row) => row.metadata?.demo_key === `${METADATA_PREFIX}:programme-b:cohort`);
  assert(cohortA?.programme_id === programmeA.id, "Programme A cohort is missing or incorrectly linked.");
  assert(cohortB?.programme_id === programmeB.id, "Programme B cohort is missing or incorrectly linked.");

  const { data: members, error: membersError } = await supabase
    .from("impact_cohort_members")
    .select("id,programme_id,cohort_id,msme_id,assigned_to_user_id,metadata")
    .in("cohort_id", [cohortA.id, cohortB.id]);
  if (membersError) fail("Could not query UAT cohort members", membersError);
  const memberA = members.find((row) => row.metadata?.demo_key === `${METADATA_PREFIX}:programme-a:member`);
  const memberB = members.find((row) => row.metadata?.demo_key === `${METADATA_PREFIX}:programme-b:member`);
  assert(memberA?.programme_id === programmeA.id, "Programme A beneficiary is missing or incorrectly linked.");
  assert(memberB?.programme_id === programmeB.id, "Programme B beneficiary is missing or incorrectly linked.");
  pass("each programme has a cohort and beneficiary");

  const poA = usersByEmail.get("po.a@uat.ndmii.test");
  const poB = usersByEmail.get("po.b@uat.ndmii.test");
  const aoA = usersByEmail.get("ao.a@uat.ndmii.test");
  const expectedAssignments = [
    [poA, programmeA, "programme_officer"],
    [poB, programmeB, "programme_officer"],
    [aoA, programmeA, "assessment_officer"],
  ];
  const { data: assignments, error: assignmentsError } = await supabase
    .from("impact_user_programme_assignments")
    .select("id,user_id,programme_id,assignment_role,status")
    .in("user_id", [poA.id, poB.id, aoA.id])
    .eq("status", "active");
  if (assignmentsError) fail("Could not query programme assignments", assignmentsError);

  for (const [user, programme, role] of expectedAssignments) {
    const matches = assignments.filter(
      (row) =>
        row.user_id === user.id &&
        row.programme_id === programme.id &&
        row.assignment_role === role,
    );
    assert(matches.length === 1, `${user.email} must have exactly one active ${role} assignment.`);
  }
  pass("required Programme A and Programme B assignments exist");

  const poAProgrammeIds = assignments
    .filter((row) => row.user_id === poA.id && row.assignment_role === "programme_officer")
    .map((row) => row.programme_id);
  const poBProgrammeIds = assignments
    .filter((row) => row.user_id === poB.id && row.assignment_role === "programme_officer")
    .map((row) => row.programme_id);
  assert(poAProgrammeIds.includes(programmeA.id), "PO A cannot be tested against Programme A.");
  assert(poBProgrammeIds.includes(programmeB.id), "PO B cannot be tested against Programme B.");
  assert(!poAProgrammeIds.includes(programmeB.id), "PO A unexpectedly has Programme B assignment.");
  assert(!poBProgrammeIds.includes(programmeA.id), "PO B unexpectedly has Programme A assignment.");
  pass("PO A and PO B have isolated programme test scopes");

  const noAssignmentEmails = [
    "executive@uat.ndmii.test",
    "analyst@uat.ndmii.test",
    "auditor@uat.ndmii.test",
  ];
  const noAssignmentIds = noAssignmentEmails.map((email) => usersByEmail.get(email).id);
  const { data: unexpectedAssignments, error: unexpectedError } = await supabase
    .from("impact_user_programme_assignments")
    .select("id,user_id,status")
    .in("user_id", noAssignmentIds)
    .eq("status", "active");
  if (unexpectedError) fail("Could not verify unassigned aggregate roles", unexpectedError);
  assert(
    unexpectedAssignments.length === 0,
    "Executive, analyst, and auditor UAT users must not have active programme assignments.",
  );
  pass("executive, analyst, and auditor have no programme assignment");

  const duplicateKeys = new Map();
  for (const row of assignments) {
    const key = `${row.user_id}:${row.programme_id}:${row.assignment_role}`;
    duplicateKeys.set(key, (duplicateKeys.get(key) ?? 0) + 1);
  }
  assert(
    [...duplicateKeys.values()].every((count) => count === 1),
    "Duplicate active UAT programme assignments exist.",
  );
  pass("no duplicate active programme assignments exist");

  const fieldOfficer = usersByEmail.get("fo.a@uat.ndmii.test");
  assert(memberA.assigned_to_user_id === fieldOfficer.id, "Programme A beneficiary is not assigned to FO A.");
  const { data: visits, error: visitsError } = await supabase
    .from("impact_field_visits")
    .select("id,programme_id,cohort_id,cohort_member_id,assigned_to_user_id,metadata")
    .eq("metadata->>demo_key", `${METADATA_PREFIX}:programme-a:field-visit`);
  if (visitsError) fail("Could not query FO A field visit", visitsError);
  assert(visits.length === 1, "Expected exactly one Programme A UAT field visit.");
  assert(visits[0].assigned_to_user_id === fieldOfficer.id, "Programme A visit is not assigned to FO A.");
  assert(visits[0].cohort_member_id === memberA.id, "Programme A visit beneficiary linkage is incorrect.");
  const { data: visitAssignments, error: visitAssignmentsError } = await supabase
    .from("impact_field_visit_assignments")
    .select("id,field_visit_id,assigned_to_user_id,assignment_status")
    .eq("field_visit_id", visits[0].id)
    .eq("assigned_to_user_id", fieldOfficer.id)
    .in("assignment_status", ["assigned", "accepted"]);
  if (visitAssignmentsError) fail("Could not query FO A field visit assignments", visitAssignmentsError);
  assert(visitAssignments.length === 1, "FO A must have exactly one active Programme A visit assignment.");
  pass("FO A is assigned to Programme A beneficiary and field visit");

  console.log(JSON.stringify({
    ok: true,
    checksPassed: checks.length,
    usersVerified: EXPECTED_USERS.length,
    programmeAssignmentsVerified: expectedAssignments.length,
    programmeAId: programmeA.id,
    programmeBId: programmeB.id,
  }, null, 2));
}

main().catch((error) => {
  console.error(`[impact-rbac-uat] Verification failed: ${error.message}`);
  process.exitCode = 1;
});
