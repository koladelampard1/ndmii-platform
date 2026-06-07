#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const PASSWORD = "ChangeMe123!";
const RECORD_PREFIX = "DEMO - RBAC";
const METADATA_PREFIX = "impact-rbac-uat-v1";

const UAT_USERS = [
  ["superadmin@uat.ndmii.test", "super_admin", "Super Administrator"],
  ["admin@uat.ndmii.test", "admin", "Administrator"],
  ["executive@uat.ndmii.test", "boi_executive", "BOI Executive"],
  ["po.a@uat.ndmii.test", "programme_officer", "Programme Officer A"],
  ["po.b@uat.ndmii.test", "programme_officer", "Programme Officer B"],
  ["ao.a@uat.ndmii.test", "assessment_officer", "Assessment Officer A"],
  ["fo.a@uat.ndmii.test", "field_officer", "Field Officer A"],
  ["analyst@uat.ndmii.test", "data_analyst", "Data Analyst"],
  ["auditor@uat.ndmii.test", "auditor", "Auditor"],
].map(([email, role, label]) => ({
  email,
  role,
  fullName: `${RECORD_PREFIX} UAT ${label}`,
}));

const PROGRAMMES = [
  {
    key: "programme-a",
    name: "DEMO - RBAC Programme A",
    code: "DEMO-RBAC-A",
    cohortName: "DEMO - RBAC Programme A Cohort",
    msmeId: "DEMO-RBAC-MSME-A",
    businessName: "DEMO - RBAC Programme A Beneficiary",
    state: "Lagos",
    lga: "Ikeja",
    sector: "Light Manufacturing",
  },
  {
    key: "programme-b",
    name: "DEMO - RBAC Programme B",
    code: "DEMO-RBAC-B",
    cohortName: "DEMO - RBAC Programme B Cohort",
    msmeId: "DEMO-RBAC-MSME-B",
    businessName: "DEMO - RBAC Programme B Beneficiary",
    state: "Kano",
    lga: "Nasarawa",
    sector: "Agro Processing",
  },
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

loadLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function metadata(key, extra = {}) {
  return {
    demo_data: true,
    demo_prefix: RECORD_PREFIX,
    demo_key: `${METADATA_PREFIX}:${key}`,
    purpose: "Impact Intelligence RBAC UAT",
    ...extra,
  };
}

function fail(label, error) {
  throw new Error(`${label}: ${error?.message ?? String(error)}`);
}

async function findAuthUser(email) {
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) fail(`Could not list Auth users for ${email}`, error);
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user || data.users.length < perPage) return user ?? null;
    page += 1;
  }
}

async function ensureUser(definition) {
  const existingAuth = await findAuthUser(definition.email);
  const authPayload = {
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      ...(existingAuth?.user_metadata ?? {}),
      full_name: definition.fullName,
      role: definition.role,
      demo_prefix: RECORD_PREFIX,
      purpose: "Impact Intelligence RBAC UAT",
      must_change_password: true,
    },
    app_metadata: {
      ...(existingAuth?.app_metadata ?? {}),
      role: definition.role,
      account_type: "impact_rbac_uat",
    },
  };
  const authResult = existingAuth
    ? await supabase.auth.admin.updateUserById(existingAuth.id, authPayload)
    : await supabase.auth.admin.createUser({
        email: definition.email,
        ...authPayload,
      });
  if (authResult.error || !authResult.data.user) {
    fail(`Could not create or update Auth user ${definition.email}`, authResult.error);
  }

  const authUser = authResult.data.user;
  const { data: existingAppUser, error: lookupError } = await supabase
    .from("users")
    .select("id,email,role,auth_user_id")
    .eq("email", definition.email)
    .maybeSingle();
  if (lookupError) fail(`Could not query public.users for ${definition.email}`, lookupError);
  if (existingAppUser?.auth_user_id && existingAppUser.auth_user_id !== authUser.id) {
    throw new Error(
      `Refusing to relink ${definition.email}: public.users is linked to another Auth user.`,
    );
  }

  const query = existingAppUser
    ? supabase
        .from("users")
        .update({
          full_name: definition.fullName,
          role: definition.role,
          auth_user_id: authUser.id,
        })
        .eq("id", existingAppUser.id)
    : supabase.from("users").insert({
        email: definition.email,
        full_name: definition.fullName,
        role: definition.role,
        auth_user_id: authUser.id,
      });
  const { data: appUser, error: appUserError } = await query
    .select("id,email,role,auth_user_id")
    .single();
  if (appUserError) fail(`Could not create or update public.users for ${definition.email}`, appUserError);

  return {
    ...appUser,
    authUserId: authUser.id,
    created: !existingAuth,
  };
}

async function findDemoRow(table, key, fallbackColumn, fallbackValue) {
  const demoKey = `${METADATA_PREFIX}:${key}`;
  let result = await supabase
    .from(table)
    .select("*")
    .eq("metadata->>demo_key", demoKey)
    .limit(1)
    .maybeSingle();
  if (result.error) fail(`Could not query ${table}`, result.error);
  if (result.data) return result.data;

  result = await supabase
    .from(table)
    .select("*")
    .eq(fallbackColumn, fallbackValue)
    .limit(1)
    .maybeSingle();
  if (result.error) fail(`Could not query ${table}`, result.error);
  return result.data;
}

async function ensureProgrammeBundle(definition, actorId) {
  let programme = await findDemoRow(
    "impact_programmes",
    definition.key,
    "programme_code",
    definition.code,
  );
  if (programme && programme.name !== definition.name) {
    throw new Error(`Programme code ${definition.code} belongs to non-UAT record "${programme.name}".`);
  }
  if (!programme) {
    const { data, error } = await supabase
      .from("impact_programmes")
      .insert({
        name: definition.name,
        programme_code: definition.code,
        sponsor_name: `${RECORD_PREFIX} UAT Sponsor`,
        description: `${RECORD_PREFIX} UAT programme for access-control testing.`,
        status: "active",
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        created_by_user_id: actorId,
        metadata: metadata(definition.key),
      })
      .select("*")
      .single();
    if (error) fail(`Could not create ${definition.name}`, error);
    programme = data;
  }

  let cohort = await findDemoRow(
    "impact_beneficiary_cohorts",
    `${definition.key}:cohort`,
    "name",
    definition.cohortName,
  );
  if (cohort && cohort.programme_id !== programme.id) {
    throw new Error(`${definition.cohortName} belongs to another programme.`);
  }
  if (!cohort) {
    const { data, error } = await supabase
      .from("impact_beneficiary_cohorts")
      .insert({
        programme_id: programme.id,
        name: definition.cohortName,
        description: `${RECORD_PREFIX} UAT beneficiary cohort.`,
        state: definition.state,
        lga: definition.lga,
        sector: definition.sector,
        target_beneficiaries: 10,
        status: "active",
        start_date: "2026-01-15",
        end_date: "2026-11-30",
        created_by_user_id: actorId,
        metadata: metadata(`${definition.key}:cohort`),
      })
      .select("*")
      .single();
    if (error) fail(`Could not create ${definition.cohortName}`, error);
    cohort = data;
  }

  const { data: existingMsme, error: msmeLookupError } = await supabase
    .from("msmes")
    .select("*")
    .eq("msme_id", definition.msmeId)
    .maybeSingle();
  if (msmeLookupError) fail(`Could not query ${definition.msmeId}`, msmeLookupError);
  if (existingMsme && existingMsme.business_name !== definition.businessName) {
    throw new Error(`${definition.msmeId} belongs to non-UAT record "${existingMsme.business_name}".`);
  }
  let msme = existingMsme;
  if (!msme) {
    const { data, error } = await supabase
      .from("msmes")
      .insert({
        msme_id: definition.msmeId,
        business_name: definition.businessName,
        owner_name: `${RECORD_PREFIX} UAT Beneficiary Owner`,
        state: definition.state,
        sector: definition.sector,
        verification_status: "verified",
        created_by: actorId,
      })
      .select("*")
      .single();
    if (error) fail(`Could not create ${definition.msmeId}`, error);
    msme = data;
  }

  let member = await findDemoRow(
    "impact_cohort_members",
    `${definition.key}:member`,
    "msme_id",
    msme.id,
  );
  if (member && member.cohort_id !== cohort.id) {
    member = null;
  }
  if (!member) {
    const { data, error } = await supabase
      .from("impact_cohort_members")
      .insert({
        cohort_id: cohort.id,
        programme_id: programme.id,
        msme_id: msme.id,
        member_status: "active",
        created_by_user_id: actorId,
        metadata: metadata(`${definition.key}:member`),
      })
      .select("*")
      .single();
    if (error) fail(`Could not enrol ${definition.msmeId}`, error);
    member = data;
  }

  return { programme, cohort, msme, member };
}

async function ensureProgrammeAssignment(user, programme, assignmentRole, actorId) {
  const { data: active, error: lookupError } = await supabase
    .from("impact_user_programme_assignments")
    .select("*")
    .eq("user_id", user.id)
    .eq("programme_id", programme.id)
    .eq("assignment_role", assignmentRole)
    .eq("status", "active");
  if (lookupError) fail(`Could not query assignment for ${user.email}`, lookupError);
  if (active.length > 1) {
    throw new Error(`Duplicate active assignment already exists for ${user.email}.`);
  }
  if (active.length === 1) {
    const { error } = await supabase
      .from("impact_user_programme_assignments")
      .update({
        assigned_by_user_id: actorId,
        reason: `${RECORD_PREFIX} UAT role-access assignment`,
        metadata: metadata(`assignment:${user.email}:${programme.programme_code}`),
      })
      .eq("id", active[0].id);
    if (error) fail(`Could not refresh assignment for ${user.email}`, error);
    return { ...active[0], created: false };
  }

  const { data, error } = await supabase
    .from("impact_user_programme_assignments")
    .insert({
      user_id: user.id,
      programme_id: programme.id,
      assignment_role: assignmentRole,
      status: "active",
      assigned_by_user_id: actorId,
      reason: `${RECORD_PREFIX} UAT role-access assignment`,
      metadata: metadata(`assignment:${user.email}:${programme.programme_code}`),
    })
    .select("*")
    .single();
  if (error) fail(`Could not assign ${user.email}`, error);
  return { ...data, created: true };
}

function isMissingRelation(error) {
  return error?.code === "42P01" || /does not exist|schema cache/i.test(error?.message ?? "");
}

async function ensureFieldOfficerScope(fieldOfficer, bundle, actorId) {
  const warnings = [];
  const { error: memberError } = await supabase
    .from("impact_cohort_members")
    .update({
      assigned_to_user_id: fieldOfficer.id,
      metadata: {
        ...(bundle.member.metadata ?? {}),
        ...metadata("programme-a:member", { field_officer_email: fieldOfficer.email }),
      },
    })
    .eq("id", bundle.member.id);
  if (memberError) {
    if (!isMissingRelation(memberError) && memberError.code !== "PGRST204") {
      fail("Could not assign Programme A beneficiary to the field officer", memberError);
    }
    warnings.push(`Beneficiary assignment unavailable: ${memberError.message}`);
    return { warnings, visit: null, visitAssignmentCreated: false };
  }

  const visitKey = `${METADATA_PREFIX}:programme-a:field-visit`;
  let visitResult = await supabase
    .from("impact_field_visits")
    .select("*")
    .eq("metadata->>demo_key", visitKey)
    .limit(1)
    .maybeSingle();
  if (visitResult.error) {
    if (isMissingRelation(visitResult.error)) {
      warnings.push(`Field visit assignment unavailable: ${visitResult.error.message}`);
      return { warnings, visit: null, visitAssignmentCreated: false };
    }
    fail("Could not query UAT field visit", visitResult.error);
  }

  let visit = visitResult.data;
  if (!visit) {
    visitResult = await supabase
      .from("impact_field_visits")
      .insert({
        title: `${RECORD_PREFIX} Programme A Field Visit`,
        programme_id: bundle.programme.id,
        cohort_id: bundle.cohort.id,
        cohort_member_id: bundle.member.id,
        msme_id: bundle.msme.id,
        visit_date: "2026-06-15",
        scheduled_at: "2026-06-15T09:00:00+01:00",
        location_text: `${bundle.cohort.lga}, ${bundle.cohort.state}`,
        status: "assigned",
        assigned_to_user_id: fieldOfficer.id,
        assigned_at: new Date().toISOString(),
        priority: "normal",
        created_by_user_id: actorId,
        metadata: metadata("programme-a:field-visit"),
      })
      .select("*")
      .single();
    if (visitResult.error) fail("Could not create UAT field visit", visitResult.error);
    visit = visitResult.data;
  } else {
    const { data, error } = await supabase
      .from("impact_field_visits")
      .update({
        assigned_to_user_id: fieldOfficer.id,
        assigned_at: visit.assigned_at ?? new Date().toISOString(),
        status: visit.status === "reviewed" || visit.status === "completed" ? visit.status : "assigned",
      })
      .eq("id", visit.id)
      .select("*")
      .single();
    if (error) fail("Could not refresh UAT field visit assignment", error);
    visit = data;
  }

  const { data: assignments, error: assignmentLookupError } = await supabase
    .from("impact_field_visit_assignments")
    .select("*")
    .eq("field_visit_id", visit.id)
    .eq("assigned_to_user_id", fieldOfficer.id)
    .in("assignment_status", ["assigned", "accepted"]);
  if (assignmentLookupError) {
    if (isMissingRelation(assignmentLookupError)) {
      warnings.push(`Field visit assignment history unavailable: ${assignmentLookupError.message}`);
      return { warnings, visit, visitAssignmentCreated: false };
    }
    fail("Could not query field visit assignment history", assignmentLookupError);
  }
  if (assignments.length > 1) {
    throw new Error(`Duplicate active field visit assignments already exist for ${fieldOfficer.email}.`);
  }
  if (assignments.length === 0) {
    const { error } = await supabase.from("impact_field_visit_assignments").insert({
      field_visit_id: visit.id,
      assigned_to_user_id: fieldOfficer.id,
      assigned_by_user_id: actorId,
      assignment_status: "assigned",
      metadata: metadata("programme-a:field-visit-assignment"),
    });
    if (error) fail("Could not create field visit assignment history", error);
    return { warnings, visit, visitAssignmentCreated: true };
  }
  return { warnings, visit, visitAssignmentCreated: false };
}

async function main() {
  console.log(`[impact-rbac-uat] Seeding ${UAT_USERS.length} UAT users without deleting existing data.`);
  const users = new Map();
  for (const definition of UAT_USERS) {
    const user = await ensureUser(definition);
    users.set(definition.email, user);
    console.log(`[impact-rbac-uat] ${user.created ? "CREATED" : "REUSED"} ${definition.email} (${definition.role})`);
  }

  const actorId = users.get("superadmin@uat.ndmii.test").id;
  const [programmeA, programmeB] = await Promise.all(
    PROGRAMMES.map((definition) => ensureProgrammeBundle(definition, actorId)),
  );

  const assignmentSpecs = [
    ["po.a@uat.ndmii.test", programmeA.programme, "programme_officer"],
    ["po.b@uat.ndmii.test", programmeB.programme, "programme_officer"],
    ["ao.a@uat.ndmii.test", programmeA.programme, "assessment_officer"],
  ];
  const assignments = [];
  for (const [email, programme, role] of assignmentSpecs) {
    assignments.push(
      await ensureProgrammeAssignment(users.get(email), programme, role, actorId),
    );
  }

  const fieldScope = await ensureFieldOfficerScope(
    users.get("fo.a@uat.ndmii.test"),
    programmeA,
    actorId,
  );
  for (const warning of fieldScope.warnings) {
    console.warn(`[impact-rbac-uat] WARNING ${warning}`);
  }

  console.log("\nImpact Intelligence RBAC UAT login credentials");
  console.log("================================================");
  for (const user of UAT_USERS) {
    console.log(`${user.email.padEnd(34)} ${PASSWORD}  (${user.role})`);
  }
  console.log("================================================");
  console.log("These are temporary UAT credentials. Change or remove them outside UAT environments.");
  console.log(JSON.stringify({
    ok: true,
    usersCreated: [...users.values()].filter((user) => user.created).length,
    usersReused: [...users.values()].filter((user) => !user.created).length,
    programmes: [programmeA.programme.id, programmeB.programme.id],
    cohorts: [programmeA.cohort.id, programmeB.cohort.id],
    beneficiaries: [programmeA.msme.id, programmeB.msme.id],
    programmeAssignmentsCreated: assignments.filter((assignment) => assignment.created).length,
    fieldVisitId: fieldScope.visit?.id ?? null,
    fieldVisitAssignmentCreated: fieldScope.visitAssignmentCreated,
    warnings: fieldScope.warnings,
  }, null, 2));
}

main().catch((error) => {
  console.error(`[impact-rbac-uat] Seed failed: ${error.message}`);
  process.exitCode = 1;
});
