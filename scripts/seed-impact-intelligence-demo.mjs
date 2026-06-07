#!/usr/bin/env node
import {
  assert,
  createServiceClient,
  createTinyPdf,
  DEMO_KEYS,
  DEMO_PREFIX,
  demoMetadata,
  ensureByDemoKey,
  ensureStorageObject,
  expectOne,
  findByDemoKey,
  insertOne,
  REPORT_BUCKET,
  EVIDENCE_BUCKET,
  sha256,
  step,
  updateOne,
} from "./impact-intelligence-demo-common.mjs";

const supabase = createServiceClient();
const now = new Date().toISOString();
const today = now.slice(0, 10);
const actorEmail = "demo-impact-uat@invalid.ndmii.local";
const evidencePath = "demo/impact-intelligence-uat-v1/verified-monitoring-evidence.pdf";

async function ensureOperator() {
  step("1/12 Creating or reusing the demo service operator");
  const existing = await expectOne(
    supabase.from("users").select("*").eq("email", actorEmail).limit(1),
    "Could not query demo operator",
  );
  if (existing) return existing;
  return insertOne(supabase, "users", {
    email: actorEmail,
    full_name: `${DEMO_PREFIX} Operator`,
    role: "admin",
  });
}

async function ensureProgramme(actorId) {
  step("2/12 Creating or reusing programme and cohort");
  const programme = (await ensureByDemoKey(supabase, "impact_programmes", DEMO_KEYS.programme, {
    name: `${DEMO_PREFIX} Programme`,
    programme_code: "DEMO-II-UAT-001",
    sponsor_name: "Development Bank of Nigeria - Demo",
    description: `${DEMO_PREFIX} end-to-end lifecycle programme.`,
    status: "active",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    created_by_user_id: actorId,
  })).row;
  const cohort = (await ensureByDemoKey(supabase, "impact_beneficiary_cohorts", DEMO_KEYS.cohort, {
    programme_id: programme.id,
    name: `${DEMO_PREFIX} Lagos Cohort`,
    description: `${DEMO_PREFIX} beneficiary cohort.`,
    state: "Lagos",
    lga: "Ikeja",
    sector: "Light Manufacturing",
    target_beneficiaries: 25,
    status: "active",
    start_date: "2026-01-15",
    end_date: "2026-11-30",
    created_by_user_id: actorId,
  })).row;
  assert(cohort.programme_id === programme.id, "Demo cohort is linked to a different programme.");
  return { programme, cohort };
}

async function ensureBeneficiary(actorId, programme, cohort) {
  step("3/12 Creating or reusing beneficiary MSME and cohort membership");
  let msme = await expectOne(
    supabase.from("msmes").select("*").eq("msme_id", "DEMO-II-UAT-MSME-001").limit(1),
    "Could not query demo MSME",
  );
  if (!msme) {
    msme = await insertOne(supabase, "msmes", {
      msme_id: "DEMO-II-UAT-MSME-001",
      business_name: `${DEMO_PREFIX} Foods Limited`,
      owner_name: "Amina Bello (Demo)",
      state: "Lagos",
      sector: "Food Processing",
      verification_status: "verified",
      created_by: actorId,
    });
  }
  assert(msme.business_name.startsWith(DEMO_PREFIX), "The fixed demo MSME ID belongs to non-demo data.");

  const member = (await ensureByDemoKey(supabase, "impact_cohort_members", DEMO_KEYS.member, {
    cohort_id: cohort.id,
    programme_id: programme.id,
    msme_id: msme.id,
    member_status: "active",
    enrolled_at: now,
    created_by_user_id: actorId,
  })).row;
  assert(
    member.programme_id === programme.id &&
      member.cohort_id === cohort.id &&
      member.msme_id === msme.id,
    "Demo cohort member anchors do not match.",
  );
  return { msme, member };
}

async function ensureIntervention(actorId, programme, cohort, member, msme) {
  step("4/12 Creating or reusing intervention");
  const intervention = (await ensureByDemoKey(supabase, "impact_interventions", DEMO_KEYS.intervention, {
    programme_id: programme.id,
    cohort_id: cohort.id,
    cohort_member_id: member.id,
    msme_id: msme.id,
    intervention_type: "capacity_building",
    title: `${DEMO_PREFIX} Production Readiness Support`,
    description: "Demo equipment-readiness, bookkeeping, and market-access intervention.",
    status: "active",
    approved_amount: 2500000,
    disbursed_amount: 1750000,
    start_date: "2026-02-01",
    end_date: "2026-10-31",
    approved_at: now,
    disbursed_at: now,
    created_by_user_id: actorId,
    metadata: { stage: "delivery" },
  })).row;
  assert(intervention.cohort_member_id === member.id, "Demo intervention is linked to another member.");
  return intervention;
}

async function ensureAssessment(actorId, programme, cohort, member, msme, intervention) {
  step("5/12 Creating or reusing assessment template, response, score run, and approval");
  const template = (await ensureByDemoKey(supabase, "impact_assessment_templates", DEMO_KEYS.template, {
    name: `${DEMO_PREFIX} Readiness Assessment`,
    description: `${DEMO_PREFIX} scored readiness template.`,
    assessment_type: "baseline",
    version: 1,
    status: "active",
    created_by_user_id: actorId,
    scoring_model_version: 1,
  })).row;
  const section = (await ensureByDemoKey(supabase, "impact_assessment_sections", DEMO_KEYS.section, {
    template_id: template.id,
    title: `${DEMO_PREFIX} Operational Readiness`,
    description: "Demo scored section.",
    display_order: 1,
    weight: 100,
  })).row;
  const questionText = `${DEMO_PREFIX} production records are current`;
  let question = await expectOne(
    supabase
      .from("impact_assessment_questions")
      .select("*")
      .eq("template_id", template.id)
      .eq("question_text", questionText)
      .limit(1),
    "Could not query demo assessment question",
  );
  if (!question) {
    question = await insertOne(supabase, "impact_assessment_questions", {
      template_id: template.id,
      section_id: section.id,
      question_text: questionText,
      question_type: "boolean",
      category: "operations",
      display_order: 1,
      is_required: true,
      weight: 100,
      scoring_config: { true_score: 1, false_score: 0, max_score: 1 },
    });
  }
  let assessment = (await ensureByDemoKey(supabase, "impact_assessments", DEMO_KEYS.assessment, {
    programme_id: programme.id,
    cohort_id: cohort.id,
    cohort_member_id: member.id,
    intervention_id: intervention.id,
    msme_id: msme.id,
    template_id: template.id,
    template_version: 1,
    assessment_type: "baseline",
    title: `${DEMO_PREFIX} Baseline Readiness Assessment`,
    status: "draft",
    created_by_user_id: actorId,
  })).row;
  await ensureByDemoKey(supabase, "impact_assessment_responses", DEMO_KEYS.response, {
    assessment_id: assessment.id,
    question_id: question.id,
    msme_id: msme.id,
    response_text: "Yes",
    response_boolean: true,
    score: 1,
    max_score: 1,
    responded_by_user_id: actorId,
  });
  let scoreRun = await findByDemoKey(supabase, "impact_assessment_score_runs", DEMO_KEYS.scoreRun);
  if (!scoreRun) {
    scoreRun = await insertOne(supabase, "impact_assessment_score_runs", {
      assessment_id: assessment.id,
      template_id: template.id,
      template_version: 1,
      run_type: "review",
      score: 1,
      max_score: 1,
      weighted_score: 100,
      readiness_category: "strong",
      calculated_by_user_id: actorId,
      calculated_at: now,
      scoring_model_version: 1,
      scoring_snapshot: { demo: true, section_id: section.id, question_id: question.id },
      metadata: demoMetadata(DEMO_KEYS.scoreRun),
    });
  }
  await ensureByDemoKey(supabase, "impact_assessment_scores", DEMO_KEYS.score, {
    assessment_id: assessment.id,
    score_run_id: scoreRun.id,
    section_id: null,
    section_title: "Overall",
    score: 1,
    max_score: 1,
    weighted_score: 100,
    readiness_category: "strong",
    is_latest: true,
    scoring_model_version: 1,
  });
  await ensureByDemoKey(supabase, "impact_assessment_reviews", DEMO_KEYS.assessmentReview, {
    assessment_id: assessment.id,
    reviewer_user_id: actorId,
    review_status: "approved",
    notes: `${DEMO_PREFIX} approved assessment review.`,
  });
  if (assessment.status !== "approved") {
    assessment = await updateOne(supabase, "impact_assessments", assessment.id, {
      status: "approved",
      score: 100,
      risk_level: "strong",
      conducted_by_user_id: actorId,
      conducted_at: now,
      completed_at: now,
      submitted_at: now,
      submitted_by_user_id: actorId,
      reviewed_by_user_id: actorId,
      reviewed_at: now,
    });
  }
  return { assessment, scoreRun };
}

async function ensureVisit(actorId, programme, cohort, member, msme, intervention, assessment) {
  step("6/12 Creating or reusing reviewed monitoring visit");
  let visit = (await ensureByDemoKey(supabase, "impact_field_visits", DEMO_KEYS.visit, {
    programme_id: programme.id,
    cohort_id: cohort.id,
    cohort_member_id: member.id,
    intervention_id: intervention.id,
    assessment_id: assessment.id,
    msme_id: msme.id,
    title: `${DEMO_PREFIX} Monitoring Visit`,
    visit_date: today,
    scheduled_at: now,
    location_text: "Ikeja, Lagos",
    status: "completed",
    findings: "Demo beneficiary maintains production records and has deployed intervention support.",
    recommendations: "Continue monthly production and employment tracking.",
    priority: "normal",
    completed_by_user_id: actorId,
    completed_at: now,
    created_by_user_id: actorId,
  })).row;
  await ensureByDemoKey(supabase, "impact_monitoring_notes", DEMO_KEYS.visitNote, {
    field_visit_id: visit.id,
    programme_id: programme.id,
    intervention_id: intervention.id,
    assessment_id: assessment.id,
    msme_id: msme.id,
    note_type: "review",
    title: `${DEMO_PREFIX} Visit Review`,
    note: "Demo monitoring visit reviewed and accepted for UAT reporting.",
    created_by_user_id: actorId,
  });
  if (visit.status !== "reviewed") {
    visit = await updateOne(supabase, "impact_field_visits", visit.id, {
      status: "reviewed",
      reviewed_by_user_id: actorId,
      reviewed_at: now,
    });
  }
  return visit;
}

async function ensureEvidence(actorId, programme, cohort, member, msme, intervention, assessment, visit) {
  step("7/12 Uploading or reusing verified private evidence");
  const evidenceBytes = createTinyPdf([
    DEMO_PREFIX,
    "Verified monitoring evidence for UAT only.",
    `Programme: ${programme.name}`,
    `Beneficiary: ${msme.business_name}`,
    `Visit date: ${visit.visit_date}`,
  ]);
  await ensureStorageObject(
    supabase,
    EVIDENCE_BUCKET,
    evidencePath,
    evidenceBytes,
    "application/pdf",
  );
  let evidence = await findByDemoKey(supabase, "impact_evidence_files", DEMO_KEYS.evidence);
  if (!evidence) {
    evidence = await insertOne(supabase, "impact_evidence_files", {
      programme_id: programme.id,
      cohort_id: cohort.id,
      cohort_member_id: member.id,
      intervention_id: intervention.id,
      assessment_id: assessment.id,
      field_visit_id: visit.id,
      msme_id: msme.id,
      file_name: "verified-monitoring-evidence.pdf",
      file_type: "application/pdf",
      evidence_type: "pdf",
      evidence_category: "beneficiary_document",
      description: `${DEMO_PREFIX} verified monitoring evidence.`,
      status: "draft",
      verification_status: "pending",
      metadata: demoMetadata(DEMO_KEYS.evidence, { legacy_placeholder: false }),
    });
  }
  assert(!["rejected", "archived"].includes(evidence.status), `Demo evidence is ${evidence.status} and cannot be safely reused.`);
  if (evidence.status === "draft") {
    evidence = await updateOne(supabase, "impact_evidence_files", evidence.id, {
      original_filename: "verified-monitoring-evidence.pdf",
      stored_filename: "verified-monitoring-evidence.pdf",
      storage_bucket: EVIDENCE_BUCKET,
      storage_path: evidencePath,
      mime_type: "application/pdf",
      file_size_bytes: evidenceBytes.length,
      checksum_sha256: sha256(evidenceBytes),
      sha256_hash: sha256(evidenceBytes),
      uploaded_at: now,
      uploaded_by_user_id: actorId,
      captured_at: now,
      metadata: demoMetadata(DEMO_KEYS.evidence, { legacy_placeholder: false }),
    });
    evidence = await updateOne(supabase, "impact_evidence_files", evidence.id, {
      status: "uploaded",
    });
  }
  if (evidence.status === "uploaded" || evidence.status === "returned") {
    evidence = await updateOne(supabase, "impact_evidence_files", evidence.id, {
      status: "submitted",
      submitted_at: now,
      verification_status: "pending",
    });
  }
  if (evidence.status === "submitted") {
    evidence = await updateOne(supabase, "impact_evidence_files", evidence.id, {
      status: "under_review",
    });
  }
  if (evidence.status === "under_review") {
    evidence = await updateOne(supabase, "impact_evidence_files", evidence.id, {
      status: "verified",
      verification_status: "verified",
      verified_by_user_id: actorId,
      verified_at: now,
      reviewed_by_user_id: actorId,
      reviewed_at: now,
      review_decision: "verified",
      review_note: `${DEMO_PREFIX} evidence verified for UAT.`,
    });
  }
  assert(evidence.status === "verified", "Demo evidence did not reach verified status.");
  return evidence;
}

async function ensureIndicator(actorId, programme, cohort, member, msme, intervention, assessment, scoreRun, visit, evidence) {
  step("8/12 Creating or reusing verified indicator measurement");
  const indicator = (await ensureByDemoKey(supabase, "impact_indicator_definitions", DEMO_KEYS.indicator, {
    programme_id: programme.id,
    cohort_id: cohort.id,
    intervention_id: intervention.id,
    name: `${DEMO_PREFIX} Monthly Production Output`,
    description: "Demo monthly production output after intervention support.",
    unit_of_measure: "units/month",
    indicator_type: "outcome",
    direction_of_improvement: "increase",
    calculation_method: "field_observation",
    measurement_frequency: "monthly",
    baseline_required: true,
    target_required: true,
    owner_user_id: actorId,
    status: "active",
    created_by_user_id: actorId,
  })).row;
  let measurement = (await ensureByDemoKey(supabase, "impact_indicator_measurements", DEMO_KEYS.measurement, {
    indicator_definition_id: indicator.id,
    programme_id: programme.id,
    cohort_id: cohort.id,
    cohort_member_id: member.id,
    msme_id: msme.id,
    intervention_id: intervention.id,
    assessment_id: assessment.id,
    assessment_score_run_id: scoreRun.id,
    field_visit_id: visit.id,
    evidence_id: evidence.id,
    reporting_period_start: "2026-01-01",
    reporting_period_end: "2026-06-30",
    measurement_date: today,
    baseline_value: 100,
    target_value: 180,
    measured_value: 160,
    progress_percentage: 75,
    outcome_status: "on_track",
    source_type: "field_visit",
    verification_status: "draft",
    created_by_user_id: actorId,
  })).row;
  if (measurement.verification_status === "draft") {
    measurement = await updateOne(supabase, "impact_indicator_measurements", measurement.id, {
      verification_status: "submitted",
      submitted_by_user_id: actorId,
      submitted_at: now,
    });
  }
  if (measurement.verification_status === "submitted") {
    measurement = await updateOne(supabase, "impact_indicator_measurements", measurement.id, {
      verification_status: "verified",
      verified_by_user_id: actorId,
      verified_at: now,
      review_note: `${DEMO_PREFIX} indicator verified for UAT.`,
    });
  }
  assert(measurement.verification_status === "verified", "Demo measurement did not reach verified status.");
  return { indicator, measurement };
}

function buildReportPayload(context) {
  const {
    programme, cohort, member, msme, intervention, assessment, scoreRun,
    visit, evidence, indicator, measurement,
  } = context;
  const scope = {
    programme_id: programme.id,
    programme_name: programme.name,
    programme_code: programme.programme_code,
    cohort_id: cohort.id,
    cohort_name: cohort.name,
    cohort_member_id: member.id,
    member_status: member.member_status,
    msme_id: msme.id,
    msme_name: msme.business_name,
    dbin_msme_id: msme.msme_id,
    intervention_id: intervention.id,
    intervention_title: intervention.title,
  };
  const sourceSummary = {
    approved_assessments: 1,
    review_score_runs: 1,
    reviewed_field_visits: 1,
    completed_unreviewed_field_visits_excluded: 0,
    verified_evidence: 1,
    verified_indicator_measurements: 1,
    official_impact_claims: 1,
  };
  const evidenceReference = {
    evidence_id: evidence.id,
    original_filename: evidence.original_filename,
    verification_status: evidence.verification_status,
    checksum_sha256: evidence.checksum_sha256,
    mime_type: evidence.mime_type,
    file_size_bytes: Number(evidence.file_size_bytes),
    intervention_id: intervention.id,
    assessment_id: assessment.id,
    field_visit_id: visit.id,
  };
  const indicatorReference = {
    indicator_definition_id: indicator.id,
    indicator_measurement_id: measurement.id,
    indicator_name: indicator.name,
    unit_of_measure: indicator.unit_of_measure,
    baseline_value: Number(measurement.baseline_value),
    target_value: Number(measurement.target_value),
    measured_value: Number(measurement.measured_value),
    progress_percentage: Number(measurement.progress_percentage),
    outcome_status: measurement.outcome_status,
    measurement_date: measurement.measurement_date,
    verification_status: measurement.verification_status,
  };
  return {
    scope,
    sourceSummary,
    evidenceReference,
    indicatorReference,
    payload: {
      schema_version: "impact_report_phase1a_v1",
      title: `${DEMO_PREFIX} Lifecycle Report`,
      summary: `${DEMO_PREFIX} complete lifecycle report for UAT.`,
      report_type: "impact_intelligence",
      generated_at: now,
      source_cutoff_at: now,
      scope,
      source_summary: sourceSummary,
      completeness_warnings: [],
      assessments: [{
        id: assessment.id,
        title: assessment.title,
        assessment_type: assessment.assessment_type,
        status: assessment.status,
        score: assessment.score,
        risk_level: assessment.risk_level,
        score_run_id: scoreRun.id,
        weighted_score: scoreRun.weighted_score,
        readiness_category: scoreRun.readiness_category,
      }],
      field_visits: [{
        id: visit.id,
        title: visit.title,
        visit_date: visit.visit_date,
        status: visit.status,
        findings: visit.findings,
        recommendations: visit.recommendations,
      }],
      evidence: [evidenceReference],
      indicators: [indicatorReference],
    },
  };
}

async function ensureReport(actorId, context) {
  step("9/12 Creating or reusing immutable report version");
  let report = await findByDemoKey(supabase, "impact_reports", DEMO_KEYS.report);
  if (!report) {
    report = await insertOne(supabase, "impact_reports", {
      programme_id: context.programme.id,
      cohort_id: context.cohort.id,
      cohort_member_id: context.member.id,
      msme_id: context.msme.id,
      intervention_id: context.intervention.id,
      title: `${DEMO_PREFIX} Lifecycle Report`,
      summary: `${DEMO_PREFIX} complete lifecycle report for UAT.`,
      report_type: "impact_intelligence",
      status: "draft",
      generated_by_user_id: actorId,
      metadata: demoMetadata(DEMO_KEYS.report, {
        report_phase: "phase1a",
        legacy_unverified: false,
      }),
    });
  }
  const built = buildReportPayload(context);
  let version = report.latest_version_id
    ? await expectOne(
        supabase.from("impact_report_versions").select("*").eq("id", report.latest_version_id),
        "Could not query demo report version",
      )
    : null;
  if (!version) {
    assert(["draft", "returned"].includes(report.status), "Demo report has no version and is not safely regenerable.");
    const { data: versionId, error } = await supabase.rpc("create_impact_report_version", {
      p_report_id: report.id,
      p_title: report.title,
      p_summary: report.summary,
      p_report_json: built.payload,
      p_report_scope: built.scope,
      p_source_summary: built.sourceSummary,
      p_assessment_ids: [context.assessment.id],
      p_score_run_ids: [context.scoreRun.id],
      p_field_visit_ids: [context.visit.id],
      p_evidence_ids: [context.evidence.id],
      p_indicator_measurement_ids: [context.measurement.id],
      p_completeness_warnings: [],
      p_generated_by_user_id: actorId,
      p_source_cutoff_at: now,
      p_evidence_references: [built.evidenceReference],
      p_indicator_references: [built.indicatorReference],
    });
    if (error) throw new Error(`Could not generate demo report version: ${error.message}`);
    version = await expectOne(
      supabase.from("impact_report_versions").select("*").eq("id", versionId),
      "Could not reload demo report version",
    );
    report = await findByDemoKey(supabase, "impact_reports", DEMO_KEYS.report);
  }
  step("10/12 Submitting and approving the report when required");
  if (report.status === "draft" || report.status === "returned") {
    report = await updateOne(supabase, "impact_reports", report.id, {
      status: "in_review",
      submitted_at: now,
      submitted_by_user_id: actorId,
      return_reason: null,
    });
  }
  if (report.status === "in_review") {
    report = await updateOne(supabase, "impact_reports", report.id, {
      status: "approved",
      reviewed_at: now,
      reviewed_by_user_id: actorId,
      approved_at: now,
      approved_by_user_id: actorId,
      return_reason: null,
    });
  }
  assert(report.status === "approved", "Demo report did not reach approved status.");
  return { report, version };
}

async function ensureExport(actorId, report, version, format) {
  const demoKey = format === "json" ? DEMO_KEYS.jsonExport : DEMO_KEYS.pdfExport;
  const existing = await findByDemoKey(supabase, "impact_report_exports", demoKey);
  if (existing) {
    assert(existing.export_status === "generated", `Existing ${format} demo export is not generated.`);
    return existing;
  }
  const fileName = `impact-intelligence-uat-v${version.version_number}.${format}`;
  const storagePath = `demo/${report.id}/${version.id}/${fileName}`;
  const bytes = format === "json"
    ? Buffer.from(JSON.stringify({
        demo: true,
        prefix: DEMO_PREFIX,
        report: { id: report.id, title: report.title, status: report.status },
        version: version.report_json,
      }, null, 2))
    : createTinyPdf([
        `${DEMO_PREFIX} Lifecycle Report`,
        `Report ID: ${report.id}`,
        `Version: ${version.version_number}`,
        "Approved UAT export with assessment, visit, evidence, and indicator references.",
      ]);
  const mimeType = format === "json" ? "application/json" : "application/pdf";
  await ensureStorageObject(supabase, REPORT_BUCKET, storagePath, bytes, mimeType);
  return insertOne(supabase, "impact_report_exports", {
    report_id: report.id,
    report_version_id: version.id,
    export_format: format,
    export_status: "generated",
    export_url: null,
    storage_bucket: REPORT_BUCKET,
    storage_path: storagePath,
    mime_type: mimeType,
    file_size_bytes: bytes.length,
    checksum_sha256: sha256(bytes),
    requested_by_user_id: actorId,
    requested_at: now,
    completed_at: now,
    generated_at: now,
    generated_by_user_id: actorId,
    metadata: demoMetadata(demoKey, { file_name: fileName, report_phase: "phase1a" }),
  });
}

async function main() {
  step(`Starting idempotent seed: ${DEMO_PREFIX}`);
  const actor = await ensureOperator();
  const { programme, cohort } = await ensureProgramme(actor.id);
  const { msme, member } = await ensureBeneficiary(actor.id, programme, cohort);
  const intervention = await ensureIntervention(actor.id, programme, cohort, member, msme);
  const { assessment, scoreRun } = await ensureAssessment(
    actor.id, programme, cohort, member, msme, intervention,
  );
  const visit = await ensureVisit(
    actor.id, programme, cohort, member, msme, intervention, assessment,
  );
  const evidence = await ensureEvidence(
    actor.id, programme, cohort, member, msme, intervention, assessment, visit,
  );
  const { indicator, measurement } = await ensureIndicator(
    actor.id, programme, cohort, member, msme, intervention, assessment,
    scoreRun, visit, evidence,
  );
  const context = {
    programme, cohort, member, msme, intervention, assessment, scoreRun,
    visit, evidence, indicator, measurement,
  };
  const { report, version } = await ensureReport(actor.id, context);
  step("11/12 Creating or reusing JSON report export");
  const jsonExport = await ensureExport(actor.id, report, version, "json");
  step("12/12 Creating or reusing PDF report export");
  const pdfExport = await ensureExport(actor.id, report, version, "pdf");
  console.log(JSON.stringify({
    ok: true,
    demoPrefix: DEMO_PREFIX,
    ids: {
      programme: programme.id,
      cohort: cohort.id,
      msme: msme.id,
      cohortMember: member.id,
      intervention: intervention.id,
      assessment: assessment.id,
      scoreRun: scoreRun.id,
      monitoringVisit: visit.id,
      evidence: evidence.id,
      indicatorDefinition: indicator.id,
      indicatorMeasurement: measurement.id,
      report: report.id,
      reportVersion: version.id,
      jsonExport: jsonExport.id,
      pdfExport: pdfExport.id,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(`[impact-demo] Seed failed: ${error.message}`);
  process.exitCode = 1;
});
