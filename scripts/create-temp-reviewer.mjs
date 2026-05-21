import { createClient } from "@supabase/supabase-js";

const allowFlag = process.env.NDMII_ALLOW_TEMP_REVIEWER;
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.TEMP_REVIEWER_EMAIL ?? "").trim().toLowerCase();
const password = process.env.TEMP_REVIEWER_PASSWORD ?? "";
const fullName = (process.env.TEMP_REVIEWER_FULL_NAME ?? "Temporary Compliance Test Reviewer").trim();
const expiresAt = process.env.TEMP_REVIEWER_EXPIRES_AT ?? null;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (allowFlag !== "true") {
  fail("Refusing to create reviewer. Set NDMII_ALLOW_TEMP_REVIEWER=true for this one-time setup.");
}

if (!supabaseUrl || !serviceRoleKey) {
  fail("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

if (!email || !email.includes("@")) {
  fail("TEMP_REVIEWER_EMAIL must be a valid email address.");
}

if (password.length < 12) {
  fail("TEMP_REVIEWER_PASSWORD must be at least 12 characters.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findAuthUserByEmail(targetEmail) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = data.users.find((user) => (user.email ?? "").toLowerCase() === targetEmail);
    if (match) return match;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

const metadata = {
  role: "reviewer",
  account_type: "temporary_test_reviewer",
  purpose: "production_vercel_compliance_review_testing",
  must_change_password: true,
  expires_at: expiresAt,
};

const existingAuthUser = await findAuthUserByEmail(email);
const authResult = existingAuthUser
  ? await supabase.auth.admin.updateUserById(existingAuthUser.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(existingAuthUser.user_metadata ?? {}),
        ...metadata,
        full_name: fullName,
      },
      app_metadata: {
        ...(existingAuthUser.app_metadata ?? {}),
        role: "reviewer",
        account_type: "temporary_test_reviewer",
      },
    })
  : await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        ...metadata,
        full_name: fullName,
      },
      app_metadata: {
        role: "reviewer",
        account_type: "temporary_test_reviewer",
      },
    });

if (authResult.error || !authResult.data.user?.id) {
  throw authResult.error ?? new Error("Supabase Auth did not return a user.");
}

const authUserId = authResult.data.user.id;

const { data: appUser, error: appUserError } = await supabase
  .from("users")
  .upsert(
    {
      email,
      full_name: fullName,
      role: "reviewer",
      auth_user_id: authUserId,
    },
    { onConflict: "email" },
  )
  .select("id,email,role,auth_user_id")
  .single();

if (appUserError) throw appUserError;

const { data: linkedMsmes, error: linkedMsmesError } = await supabase
  .from("msmes")
  .select("id,msme_id,business_name")
  .eq("created_by", appUser.id)
  .limit(5);

if (linkedMsmesError) throw linkedMsmesError;

if ((linkedMsmes ?? []).length > 0) {
  fail(`Unsafe reviewer setup: app user ${appUser.id} owns MSME records. Use a clean reviewer email.`);
}

const { error: auditError } = await supabase.from("activity_logs").insert({
  actor_user_id: appUser.id,
  action: "temporary_reviewer_account_created",
  entity_type: "user",
  entity_id: appUser.id,
  metadata,
});

if (auditError) {
  console.warn("Reviewer was created, but audit log insert failed:", auditError.message);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      email: appUser.email,
      role: appUser.role,
      appUserId: appUser.id,
      authUserId: appUser.auth_user_id,
      reviewerOnly: true,
      msmeOwnershipCount: (linkedMsmes ?? []).length,
      passwordChangeRequiredByPolicy: true,
      passwordChangeEnforcedByApp: false,
      expiresAt,
    },
    null,
    2,
  ),
);
