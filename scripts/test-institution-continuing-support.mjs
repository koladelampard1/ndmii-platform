import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { completionRequiresNote, isOverdue, supportPathwayForOutcome, validItemStatus, validItemStatusTransition, validSupportPlanStatusTransition } from "../src/lib/institutional/continuing-support-policy.ts";

const migration = readFileSync("supabase/migrations/20261018123209_institution_continuing_support_market_links.sql", "utf8");
const institutionRoute = readFileSync("src/app/api/institutions/[institutionId]/support-plans/route.ts", "utf8");
const detailRoute = readFileSync("src/app/api/institutions/[institutionId]/support-plans/[planId]/route.ts", "utf8");
const itemRoute = readFileSync("src/app/api/institutions/[institutionId]/support-plans/[planId]/items/route.ts", "utf8");
const businessRoute = readFileSync("src/app/api/msme/continuing-support/route.ts", "utf8");
const workbench = readFileSync("src/components/institutional/continuing-support-workbench.tsx", "utf8");
const businessView = readFileSync("src/components/institutional/business-continuing-support.tsx", "utf8");

test("finance outcomes map to the correct continuing-support pathway", () => {
  assert.equal(supportPathwayForOutcome("facility_approved"), "post_finance");
  assert.equal(supportPathwayForOutcome("declined"), "development_return");
  assert.equal(supportPathwayForOutcome("deferred"), "development_return");
  assert.equal(supportPathwayForOutcome("additional_information"), "continuing_support");
  assert.equal(supportPathwayForOutcome("withdrawn"), "closed");
});

test("overdue queue logic excludes terminal work", () => {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  assert.equal(isOverdue({ status: "pending", dueAt: yesterday }), true);
  assert.equal(isOverdue({ status: "completed", dueAt: yesterday }), false);
  assert.equal(isOverdue({ status: "converted", dueAt: yesterday }), false);
  assert.equal(isOverdue({ status: "open", dueAt: null }), false);
});

test("plan and item status rules prevent invalid transitions", () => {
  assert.equal(validSupportPlanStatusTransition("active", "completed"), true);
  assert.equal(validSupportPlanStatusTransition("closed", "active"), false);
  assert.equal(validItemStatus("referral", "converted"), true);
  assert.equal(validItemStatus("milestone", "converted"), false);
  assert.equal(validItemStatusTransition("referral", "proposed", "converted"), false);
  assert.equal(validItemStatusTransition("referral", "engaged", "converted"), true);
  assert.equal(validItemStatusTransition("touchpoint", "completed", "scheduled"), false);
  assert.equal(completionRequiresNote("touchpoint", "completed", ""), false);
  assert.equal(completionRequiresNote("touchpoint", "completed", "Visit completed"), true);
});

test("schema preserves the full journey and isolates browser roles", () => {
  for (const table of ["institution_support_plans", "institution_support_milestones", "institution_support_touchpoints", "institution_support_issues", "institution_market_referrals", "institution_support_history"]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migration, /revoke all on[\s\S]+from public,anon,authenticated/);
  assert.match(migration, /revoke all on public\.institution_support_history from service_role/);
  assert.match(migration, /grant select on public\.institution_support_history to service_role/);
  assert.match(migration, /foreign key\(finance_outcome_id,institution_id\)/);
  assert.match(migration, /foreign key\(plan_id,institution_id\)/);
  assert.match(migration, /institution_finance_outcome_support_plan/);
  assert.match(migration, /new\.outcome in \('declined','deferred'\)[\s\S]+development_return/);
  assert.match(migration, /institution_support_history/);
  assert.match(migration, /institution_support_plans_engagement_fk_idx/);
});

test("institution and business routes revalidate scope, assignment and consent", () => {
  assert.match(institutionRoute, /requireInstitutionActor/);
  assert.match(institutionRoute, /requireDiagnosticAgent/);
  assert.match(detailRoute, /supportPlan\(actor, planId\)/);
  assert.match(itemRoute, /supportPlan\(actor, planId\)/);
  assert.match(businessRoute, /requireVerifiedActor/);
  assert.match(businessRoute, /owner_user_id/);
  assert.match(businessRoute, /passport_access_status/);
  assert.match(businessRoute, /consent\?\.status !== "granted"/);
});

test("both operating journeys expose the complete Sprint 6 workflow", () => {
  for (const term of ["Milestones", "Visits, mentoring and follow-up", "Issues and risks", "Buyer and supplier referrals", "Journey history"]) assert.match(workbench, new RegExp(term));
  for (const term of ["Milestones", "Visits and mentoring", "Market referrals", "Issues being supported"]) assert.match(businessView, new RegExp(term));
  assert.match(workbench, /overdueMilestones/);
  assert.match(workbench, /openCriticalIssues/);
});
