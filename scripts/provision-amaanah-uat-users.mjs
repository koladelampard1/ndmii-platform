#!/usr/bin/env node
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const institutionSlug = "amaanah-finance";
const partnerName = "Northstar Enterprise Support Partners (Build Partner)";

const personas = [
  { email: "admin.amaanah@build.dbin.ng", fullName: "Amina Yusuf", title: "Institution Administrator", institutionRole: "institution_admin" },
  { email: "executive.amaanah@build.dbin.ng", fullName: "Idris Bello", title: "Executive Sponsor", institutionRole: "institution_reviewer" },
  { email: "programme.amaanah@build.dbin.ng", fullName: "Zainab Lawal", title: "Enterprise Programme Owner", institutionRole: "institution_officer" },
  { email: "financing.amaanah@build.dbin.ng", fullName: "Tunde Akinwale", title: "Financing Operations Owner", institutionRole: "institution_officer" },
  { email: "compliance.amaanah@build.dbin.ng", fullName: "Mariam Sulaiman", title: "Shariah and Compliance Approver", institutionRole: "institution_reviewer" },
  { email: "partners.amaanah@build.dbin.ng", fullName: "Chinedu Okafor", title: "External Partner Agent", institutionRole: "institution_agent", deliveryType: "external_agent" },
  { email: "technical.amaanah@build.dbin.ng", fullName: "Kemi Adeyemi", title: "Platform Technical Owner", institutionRole: "institution_admin" },
];

function fail(message, error) {
  throw new Error(`${message}${error ? `: ${error.message ?? String(error)}` : ""}`);
}

function temporaryPassword() {
  return `Am!${crypto.randomBytes(12).toString("base64url")}7a`;
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  fail("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const service = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function findAuthUser(email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`Unable to list Auth users for ${email}`, error);
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match || data.users.length < 1000) return match ?? null;
  }
}

const { data: institution, error: institutionError } = await service
  .from("institutions").select("id,name").eq("slug", institutionSlug).single();
if (institutionError || !institution) fail("Amaanah institution was not found", institutionError);

const { data: partner, error: partnerError } = await service
  .from("institution_bdsp_organisations")
  .select("id,name")
  .eq("institution_id", institution.id)
  .eq("name", partnerName)
  .single();
if (partnerError || !partner) fail("Amaanah build partner was not found", partnerError);

const credentials = [];

for (const persona of personas) {
  const password = temporaryPassword();
  const existingAuth = await findAuthUser(persona.email);
  const userMetadata = {
    ...(existingAuth?.user_metadata ?? {}),
    full_name: persona.fullName,
    role: "workspace_user",
    institution_id: institution.id,
    institution_role: persona.institutionRole,
    uat_workspace: "amaanah",
    must_change_password: true,
  };
  const appMetadata = {
    ...(existingAuth?.app_metadata ?? {}),
    role: "workspace_user",
    account_type: "amaanah_uat",
    institution_id: institution.id,
    institution_role: persona.institutionRole,
  };

  const authResult = existingAuth
    ? await service.auth.admin.updateUserById(existingAuth.id, {
        password, email_confirm: true, user_metadata: userMetadata, app_metadata: appMetadata,
      })
    : await service.auth.admin.createUser({
        email: persona.email, password, email_confirm: true,
        user_metadata: userMetadata, app_metadata: appMetadata,
      });
  if (authResult.error || !authResult.data.user) fail(`Unable to provision ${persona.email}`, authResult.error);
  const authUser = authResult.data.user;

  const { data: existingProfile, error: profileLookupError } = await service
    .from("users").select("id,auth_user_id").eq("email", persona.email).maybeSingle();
  if (profileLookupError) fail(`Unable to look up ${persona.email}`, profileLookupError);
  if (existingProfile?.auth_user_id && existingProfile.auth_user_id !== authUser.id) {
    fail(`Refusing to relink ${persona.email}; it belongs to a different Auth user`);
  }

  const profileQuery = existingProfile
    ? service.from("users").update({ full_name: persona.fullName, role: "workspace_user", auth_user_id: authUser.id }).eq("id", existingProfile.id)
    : service.from("users").insert({ email: persona.email, full_name: persona.fullName, role: "workspace_user", auth_user_id: authUser.id });
  const { data: profile, error: profileError } = await profileQuery.select("id,email,full_name,role,auth_user_id").single();
  if (profileError || !profile) fail(`Unable to write profile for ${persona.email}`, profileError);

  const { data: memberships, error: membershipLookupError } = await service
    .from("institution_members")
    .select("id,role")
    .eq("institution_id", institution.id)
    .eq("user_id", profile.id)
    .in("status", ["active", "invited"]);
  if (membershipLookupError) fail(`Unable to check membership for ${persona.email}`, membershipLookupError);
  const membership = memberships?.[0];
  const membershipPayload = {
    role: persona.institutionRole,
    title: persona.title,
    status: "active",
    joined_at: new Date().toISOString(),
    expires_at: null,
    metadata: { uat_workspace: "amaanah", build_persona: true },
  };
  const membershipResult = membership
    ? await service.from("institution_members").update(membershipPayload).eq("id", membership.id).select("id").single()
    : await service.from("institution_members").insert({
        institution_id: institution.id, user_id: profile.id, ...membershipPayload,
      }).select("id").single();
  if (membershipResult.error || !membershipResult.data) fail(`Unable to write membership for ${persona.email}`, membershipResult.error);

  if (persona.institutionRole === "institution_agent") {
    const agentPayload = {
      institution_id: institution.id,
      member_id: membershipResult.data.id,
      bdsp_organisation_id: partner.id,
      service_states: [],
      delivery_type: persona.deliveryType,
    };
    const { data: agent, error: agentLookupError } = await service
      .from("institution_agent_profiles").select("id").eq("member_id", membershipResult.data.id).maybeSingle();
    if (agentLookupError) fail(`Unable to check agent profile for ${persona.email}`, agentLookupError);
    const agentResult = agent
      ? await service.from("institution_agent_profiles").update(agentPayload).eq("id", agent.id)
      : await service.from("institution_agent_profiles").insert(agentPayload);
    if (agentResult.error) fail(`Unable to write agent profile for ${persona.email}`, agentResult.error);
  }

  const verifier = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: signIn, error: signInError } = await verifier.auth.signInWithPassword({ email: persona.email, password });
  if (signInError || !signIn.user || !signIn.session) fail(`Credential verification failed for ${persona.email}`, signInError);
  await verifier.auth.signOut({ scope: "local" });

  credentials.push({
    name: persona.fullName,
    title: persona.title,
    email: persona.email,
    temporaryPassword: password,
    platformRole: "workspace_user",
    institutionRole: persona.institutionRole,
    signInVerified: true,
    mustChangePassword: true,
  });
}

console.log(JSON.stringify({
  ok: true,
  institution: institution.name,
  loginUrl: "https://amaanah.dbin.ng/login?workspace=amaanah",
  credentials,
}, null, 2));
