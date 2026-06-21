#!/usr/bin/env node
import { createServiceClient, demoMetadata } from "./impact-intelligence-demo-common.mjs";

const DATASET = "lcdbo-national-demo-v1";
const MSME_COUNT = 150;
const CLUSTER_COUNT = 24;
const OFFICER_COUNT = 15;

if (process.env.ALLOW_LCDBO_DEMO_SEED !== "true") {
  throw new Error("LCDBO demo seed is opt-in. Set ALLOW_LCDBO_DEMO_SEED=true to run it against a non-production environment.");
}
if (process.env.LCDBO_DEMO_CONFIRM !== DATASET) {
  throw new Error(`Confirm the target is a demonstration environment by setting LCDBO_DEMO_CONFIRM=${DATASET}.`);
}
if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_DEMO_SEED !== "true") {
  throw new Error("Production demo seeding is disabled. Use a dedicated demonstration or staging project.");
}

const supabase = createServiceClient();
const sectors = ["Manufacturing", "Agro Processing", "Leather", "Textile", "Creative Economy", "Technology", "Pharmaceuticals", "Solid Minerals", "Renewable Energy", "Consumer Goods"];
const locations = [
  ["Lagos", "Ikeja"], ["Ogun", "Abeokuta South"], ["Oyo", "Ibadan North"], ["Kano", "Kano Municipal"], ["Kaduna", "Kaduna North"],
  ["Rivers", "Port Harcourt"], ["Anambra", "Onitsha North"], ["Enugu", "Enugu North"], ["Plateau", "Jos North"], ["Federal Capital Territory", "Abuja Municipal"],
];
const readinessLevels = ["early_stage", "developing", "ready_for_cluster", "ready_for_investment", "ready_for_export"];
const participationStatuses = ["interested", "under_review", "accepted", "onboarding", "needs_documents", "placed", "active"];
const prefixes = ["Apex", "Arewa", "Bluecrest", "Cedar", "Crown", "Dala", "Evergreen", "Frontier", "Golden", "Heritage", "Kora", "Meridian", "New Dawn", "Prime", "Savannah"];
const suffixes = ["Works", "Industries", "Enterprises", "Processing", "Manufacturing", "Innovations", "Ventures", "Collective", "Products", "Solutions"];

function check(result, label) { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data ?? []; }
function meta(key, extra = {}) { return demoMetadata(`${DATASET}:${key}`, { demo_dataset: DATASET, sprint: "B", ...extra }); }
function scoreFor(level, offset) { const base = { early_stage: 1.7, developing: 2.6, ready_for_cluster: 3.5, ready_for_investment: 4.2, ready_for_export: 4.8 }[level]; return Math.max(1, Math.min(5, Math.round((base + ((offset % 3) - 1) * 0.2) * 10) / 10)); }

async function removeExistingDemoRows() {
  console.log("[lcdbo-demo] Removing only rows marked with this demo dataset");
  for (const table of ["lcdbo_document_submissions", "lcdbo_document_requests", "lcdbo_cluster_assessments", "cluster_members", "programme_enrolments", "platform_events"]) {
    check(await supabase.from(table).delete().eq("metadata->>demo_dataset", DATASET), `clear ${table}`);
  }
  check(await supabase.from("industrial_clusters").delete().eq("metadata->>demo_dataset", DATASET), "clear industrial clusters");
  check(await supabase.from("msmes").delete().eq("registration_context->>demo_dataset", DATASET), "clear MSMEs");
}

async function main() {
  const programme = check(await supabase.from("programmes").select("id").eq("slug", "local-content-development-beyond-oil").limit(1), "find LCDBO programme")[0];
  if (!programme) throw new Error("LCDBO programme is not configured.");
  await removeExistingDemoRows();

  console.log(`[lcdbo-demo] Creating ${OFFICER_COUNT} synthetic programme officers`);
  const userPayload = [
    { email: "demo.lcdbo.operator@invalid.dbin.local", full_name: "LCDBO Demonstration Operator", role: "admin" },
    ...Array.from({ length: OFFICER_COUNT }, (_, index) => ({ email: `demo.lcdbo.officer${String(index + 1).padStart(2, "0")}@invalid.dbin.local`, full_name: `Demo Programme Officer ${String(index + 1).padStart(2, "0")}`, role: index % 3 === 0 ? "assessment_officer" : index % 3 === 1 ? "field_officer" : "programme_officer" })),
  ];
  const users = check(await supabase.from("users").upsert(userPayload, { onConflict: "email" }).select("id,email,role"), "upsert demo users");
  const operator = users.find((user) => user.email === "demo.lcdbo.operator@invalid.dbin.local");
  if (!operator) throw new Error("Demo operator could not be resolved.");
  const officers = users.filter((user) => user.email !== operator.email);
  if (officers.length !== OFFICER_COUNT) throw new Error("Demo officers could not be resolved.");

  const states = check(await supabase.from("states").select("id,name"), "load states");
  const stateId = new Map(states.map((state) => [state.name, state.id]));

  console.log(`[lcdbo-demo] Creating ${CLUSTER_COUNT} synthetic industrial clusters`);
  const clusterPayload = Array.from({ length: CLUSTER_COUNT }, (_, index) => {
    const [state, lga] = locations[index % locations.length];
    const sector = sectors[index % sectors.length];
    const clusterType = sector === "Technology" ? "technology_park" : sector === "Leather" ? "leather_hub" : sector === "Solid Minerals" ? "solid_mineral_cluster" : sector === "Renewable Energy" ? "energy_hub" : sector === "Pharmaceuticals" ? "pharmaceutical_cluster" : sector === "Creative Economy" ? "creative_hub" : sector === "Agro Processing" ? "agro_processing_zone" : "processing_hub";
    const name = index < locations.length ? `${state === "Federal Capital Territory" ? "FCT" : state} ${sector} Cluster` : `${state === "Federal Capital Territory" ? "FCT" : state} ${sector} Production Hub ${Math.floor(index / locations.length) + 1}`;
    return { name: `DEMO LCDBO - ${name}`, slug: `demo-lcdbo-${index + 1}-${sector.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, cluster_type: clusterType, sector, state_id: stateId.get(state) ?? null, location_description: `${lga}, ${state} — synthetic demonstration cluster`, status: "active", programme_id: programme.id, description: `Synthetic ${sector.toLowerCase()} cluster used for LCDBO national programme demonstrations.`, infrastructure_status: index % 3 === 0 ? "operational" : index % 3 === 1 ? "development" : "readiness_planning", investment_required: 900000000 + index * 175000000, jobs_target: 1200 + index * 140, msme_target: 180 + index * 15, metadata: meta(`cluster-${index + 1}`, { demo_state: state, demo_lga: lga, clearly_labelled_sample: true }) };
  });
  const clusters = check(await supabase.from("industrial_clusters").upsert(clusterPayload, { onConflict: "slug" }).select("*"), "upsert demo clusters");

  console.log(`[lcdbo-demo] Creating ${MSME_COUNT} synthetic MSMEs`);
  const msmePayload = Array.from({ length: MSME_COUNT }, (_, index) => {
    const [state, lga] = locations[index % locations.length];
    const sector = sectors[(index * 3) % sectors.length];
    return { msme_id: `DEMO-LCDBO-${String(index + 1).padStart(4, "0")}`, business_name: `DEMO - ${prefixes[index % prefixes.length]} ${sector} ${suffixes[(index * 2) % suffixes.length]}`, owner_name: `Synthetic Business Owner ${String(index + 1).padStart(3, "0")}`, state, lga, sector, verification_status: "verified", review_status: "approved", created_by: operator.id, registration_context: { programme: "lcdbo", source: "lcdbo_sprint_b_demo", demo_data: true, demo_dataset: DATASET, estimated_employees: 4 + (index * 7) % 85, women_owned: index % 3 === 0, youth_owned: index % 2 === 0, clearly_labelled_sample: true } };
  });
  const msmes = check(await supabase.from("msmes").upsert(msmePayload, { onConflict: "msme_id" }).select("id,msme_id,state,lga,sector,registration_context"), "upsert demo MSMEs");

  const now = new Date().toISOString();
  const enrolments = msmes.map((msme, index) => ({ programme_id: programme.id, msme_id: msme.id, enrolment_type: "msme", status: index % 9 === 0 ? "pending_review" : "active", enrolled_by: operator.id, reviewed_by: index % 9 === 0 ? null : operator.id, reviewed_at: index % 9 === 0 ? null : now, application_note: "Synthetic LCDBO national programme demonstration enrolment.", metadata: meta(`enrolment-${msme.msme_id}`, { clearly_labelled_sample: true }) }));
  check(await supabase.from("programme_enrolments").insert(enrolments), "insert demo enrolments");

  console.log("[lcdbo-demo] Creating participation, readiness and document records");
  const memberPayload = msmes.map((msme, index) => { const cluster = clusters[index % clusters.length]; const status = participationStatuses[index % participationStatuses.length]; return { cluster_id: cluster.id, msme_id: msme.id, member_type: "msme", role: "participant", status, joined_at: now, interest_reason: `Synthetic interest in ${cluster.sector} production and market access.`, capacity_summary: `${msme.registration_context.estimated_employees} synthetic employees with growing production capacity.`, product_or_service: `${msme.sector} products and services`, current_location: `${msme.lga}, ${msme.state}`, preferred_support: ["Technical training", index % 2 ? "Market access" : "Standards and certification"], reviewed_by: operator.id, reviewed_at: now, assigned_officer_id: officers[index % officers.length].id, assigned_by: operator.id, assigned_at: now, assignment_notes: "Synthetic Sprint B officer assignment.", metadata: meta(`member-${msme.msme_id}`, { clearly_labelled_sample: true }) }; });
  const members = check(await supabase.from("cluster_members").insert(memberPayload).select("id,cluster_id,msme_id,status,assigned_officer_id"), "insert demo cluster members");
  const assessments = members.map((member, index) => { const level = readinessLevels[index % readinessLevels.length]; const score = scoreFor(level, index); const dimension = Math.max(1, Math.min(5, Math.round(score))); return { cluster_member_id: member.id, msme_id: member.msme_id, production_capacity: dimension, equipment_readiness: Math.max(1, Math.min(5, dimension + (index % 2))), workforce_readiness: dimension, finance_readiness: Math.max(1, dimension - (index % 2)), compliance_readiness: dimension, market_readiness: dimension, export_readiness: Math.max(1, dimension - 1), digital_readiness: Math.min(5, dimension + 1), overall_score: score, readiness_level: level, assessor_id: officers[index % officers.length].id, assessment_notes: "Synthetic readiness assessment for programme demonstration.", recommended_support: ["Technical training", "Market access"], metadata: meta(`assessment-${member.id}`, { clearly_labelled_sample: true }) }; });
  check(await supabase.from("lcdbo_cluster_assessments").insert(assessments), "insert demo assessments");

  const requestPayload = members.filter((_, index) => index % 2 === 0).map((member, index) => ({ cluster_member_id: member.id, requested_by: officers[index % officers.length].id, document_type: ["business_registration", "capacity_statement", "compliance_document", "product_photos"][index % 4], title: `DEMO - Evidence request ${index + 1}`, description: "Synthetic document request for LCDBO demonstration.", due_date: new Date(Date.now() + (7 + index % 21) * 86400000).toISOString().slice(0, 10), status: index % 5 === 0 ? "requested" : index % 5 === 1 ? "rejected" : index % 5 === 2 ? "submitted" : "accepted", metadata: meta(`document-request-${member.id}`, { clearly_labelled_sample: true }) }));
  const requests = check(await supabase.from("lcdbo_document_requests").insert(requestPayload).select("id,cluster_member_id,status"), "insert demo document requests");
  const memberById = new Map(members.map((member) => [member.id, member]));
  const submissionPayload = requests.filter((request) => request.status !== "requested").map((request, index) => { const member = memberById.get(request.cluster_member_id); const status = request.status === "accepted" ? "accepted" : request.status === "rejected" ? "rejected" : "submitted"; return { request_id: request.id, msme_id: member.msme_id, submitted_by: operator.id, notes: "Synthetic evidence response. No real document is attached.", reviewed_by: status === "submitted" ? null : officers[index % officers.length].id, reviewed_at: status === "submitted" ? null : now, review_notes: status === "rejected" ? "Synthetic rejection: updated evidence requested." : status === "accepted" ? "Synthetic evidence accepted." : null, status, metadata: meta(`document-submission-${request.id}`, { clearly_labelled_sample: true }) }; });
  if (submissionPayload.length) check(await supabase.from("lcdbo_document_submissions").insert(submissionPayload), "insert demo document submissions");

  const events = members.slice(0, 60).map((member, index) => ({ actor_user_id: officers[index % officers.length].id, event_type: ["lcdbo.enrolment.approved", "lcdbo.cluster_interest.accepted", "lcdbo.readiness_assessment.created", "lcdbo.cluster_member.assigned"][index % 4], entity_type: "cluster_member", entity_id: member.id, scope_type: "cluster", scope_id: member.cluster_id, metadata: meta(`event-${index + 1}`, { msme_id: member.msme_id, clearly_labelled_sample: true }) }));
  check(await supabase.from("platform_events").insert(events), "insert demo events");

  console.log(JSON.stringify({ ok: true, dataset: DATASET, synthetic: true, msmes: msmes.length, clusters: clusters.length, officers: officers.length, assessments: assessments.length, documentRequests: requests.length }, null, 2));
}

main().catch((error) => { console.error("[lcdbo-demo] Seed failed:", error.message); process.exitCode = 1; });
