#!/usr/bin/env node
import {
  assert,
  createServiceClient,
  DEMO_KEYS,
  DEMO_PREFIX,
  EVIDENCE_BUCKET,
  findByDemoKey,
  REPORT_BUCKET,
  sha256,
  step,
} from "./impact-intelligence-demo-common.mjs";

const supabase = createServiceClient();
const checks = [];

async function check(name, fn) {
  await fn();
  checks.push(name);
  step(`PASS ${name}`);
}

async function requireDemoRow(table, key) {
  const row = await findByDemoKey(supabase, table, key);
  assert(row, `Missing ${table} row for ${key}.`);
  assert(row.metadata?.demo_data === true, `${table} row is not clearly marked as demo data.`);
  assert(row.metadata?.demo_prefix === DEMO_PREFIX, `${table} row has the wrong demo prefix.`);
  return row;
}

async function verifyStorage(bucket, storagePath, checksum) {
  const download = await supabase.storage.from(bucket).download(storagePath);
  if (download.error) throw new Error(`Could not download ${bucket}/${storagePath}: ${download.error.message}`);
  const bytes = Buffer.from(await download.data.arrayBuffer());
  assert(bytes.length > 0, `${bucket}/${storagePath} is empty.`);
  assert(sha256(bytes) === checksum, `${bucket}/${storagePath} checksum does not match metadata.`);
}

async function main() {
  step(`Verifying lifecycle: ${DEMO_PREFIX}`);
  const programme = await requireDemoRow("impact_programmes", DEMO_KEYS.programme);
  const cohort = await requireDemoRow("impact_beneficiary_cohorts", DEMO_KEYS.cohort);
  const member = await requireDemoRow("impact_cohort_members", DEMO_KEYS.member);
  const intervention = await requireDemoRow("impact_interventions", DEMO_KEYS.intervention);
  const assessment = await requireDemoRow("impact_assessments", DEMO_KEYS.assessment);
  const scoreRun = await requireDemoRow("impact_assessment_score_runs", DEMO_KEYS.scoreRun);
  const visit = await requireDemoRow("impact_field_visits", DEMO_KEYS.visit);
  const evidence = await requireDemoRow("impact_evidence_files", DEMO_KEYS.evidence);
  const indicator = await requireDemoRow("impact_indicator_definitions", DEMO_KEYS.indicator);
  const measurement = await requireDemoRow("impact_indicator_measurements", DEMO_KEYS.measurement);
  const report = await requireDemoRow("impact_reports", DEMO_KEYS.report);
  const jsonExport = await requireDemoRow("impact_report_exports", DEMO_KEYS.jsonExport);
  const pdfExport = await requireDemoRow("impact_report_exports", DEMO_KEYS.pdfExport);
  const { data: msme, error: msmeError } = await supabase
    .from("msmes")
    .select("*")
    .eq("msme_id", "DEMO-II-UAT-MSME-001")
    .maybeSingle();
  if (msmeError) throw msmeError;
  assert(msme?.business_name?.startsWith(DEMO_PREFIX), "Demo beneficiary MSME is missing or mislabeled.");

  await check("programme, cohort, beneficiary, member, and intervention links are consistent", async () => {
    assert(cohort.programme_id === programme.id, "Cohort programme mismatch.");
    assert(member.programme_id === programme.id && member.cohort_id === cohort.id, "Member scope mismatch.");
    assert(member.msme_id === msme.id, "Member beneficiary mismatch.");
    assert(intervention.programme_id === programme.id, "Intervention programme mismatch.");
    assert(intervention.cohort_id === cohort.id && intervention.cohort_member_id === member.id, "Intervention member mismatch.");
    assert(intervention.msme_id === msme.id, "Intervention MSME mismatch.");
  });

  await check("assessment is approved and has a review score run", async () => {
    assert(assessment.status === "approved", "Assessment is not approved.");
    assert(assessment.programme_id === programme.id, "Assessment programme mismatch.");
    assert(assessment.cohort_id === cohort.id && assessment.cohort_member_id === member.id, "Assessment member mismatch.");
    assert(assessment.intervention_id === intervention.id && assessment.msme_id === msme.id, "Assessment intervention/MSME mismatch.");
    assert(scoreRun.assessment_id === assessment.id && scoreRun.run_type === "review", "Assessment review score run mismatch.");
    assert(Number(scoreRun.weighted_score) === 100, "Assessment weighted score is unexpected.");
  });

  await check("monitoring visit is reviewed and fully anchored", async () => {
    assert(visit.status === "reviewed", "Monitoring visit is not reviewed.");
    assert(visit.programme_id === programme.id && visit.cohort_id === cohort.id, "Visit programme/cohort mismatch.");
    assert(visit.cohort_member_id === member.id && visit.msme_id === msme.id, "Visit beneficiary mismatch.");
    assert(visit.intervention_id === intervention.id && visit.assessment_id === assessment.id, "Visit source mismatch.");
  });

  await check("verified evidence is real, checksummed private storage and not a placeholder", async () => {
    assert(evidence.status === "verified" && evidence.verification_status === "verified", "Evidence is not verified.");
    assert(evidence.metadata?.legacy_placeholder !== true, "Placeholder evidence is not allowed.");
    assert(evidence.storage_bucket === EVIDENCE_BUCKET && evidence.storage_path, "Evidence storage metadata is invalid.");
    assert(evidence.original_filename && evidence.mime_type === "application/pdf", "Evidence file metadata is incomplete.");
    assert(Number(evidence.file_size_bytes) > 0, "Evidence file size is invalid.");
    assert(/^[a-f0-9]{64}$/.test(evidence.checksum_sha256), "Evidence checksum is invalid.");
    assert(evidence.field_visit_id === visit.id && evidence.assessment_id === assessment.id, "Evidence source links mismatch.");
    await verifyStorage(EVIDENCE_BUCKET, evidence.storage_path, evidence.checksum_sha256);
  });

  await check("indicator includes baseline, target, current value, and verified sources", async () => {
    assert(indicator.status === "active", "Indicator definition is not active.");
    assert(measurement.verification_status === "verified", "Indicator measurement is not verified.");
    assert(Number(measurement.baseline_value) === 100, "Indicator baseline mismatch.");
    assert(Number(measurement.target_value) === 180, "Indicator target mismatch.");
    assert(Number(measurement.measured_value) === 160, "Indicator current value mismatch.");
    assert(measurement.indicator_definition_id === indicator.id, "Indicator definition mismatch.");
    assert(measurement.assessment_id === assessment.id, "Indicator assessment mismatch.");
    assert(measurement.assessment_score_run_id === scoreRun.id, "Indicator score run mismatch.");
    assert(measurement.field_visit_id === visit.id && measurement.evidence_id === evidence.id, "Indicator evidence/visit mismatch.");
  });

  const { data: version, error: versionError } = await supabase
    .from("impact_report_versions")
    .select("*")
    .eq("id", report.latest_version_id)
    .maybeSingle();
  if (versionError) throw versionError;
  assert(version, "Approved report has no generated version.");
  const [{ data: evidenceRefs, error: evidenceRefError }, { data: indicatorRefs, error: indicatorRefError }] = await Promise.all([
    supabase.from("impact_report_version_evidence_references").select("*").eq("report_version_id", version.id),
    supabase.from("impact_report_version_indicator_references").select("*").eq("report_version_id", version.id),
  ]);
  if (evidenceRefError) throw evidenceRefError;
  if (indicatorRefError) throw indicatorRefError;

  await check("approved report version contains every expected source reference", async () => {
    assert(report.status === "approved", "Report is not approved.");
    assert(report.programme_id === programme.id && report.cohort_id === cohort.id, "Report programme/cohort mismatch.");
    assert(report.cohort_member_id === member.id && report.msme_id === msme.id, "Report beneficiary mismatch.");
    assert(report.intervention_id === intervention.id, "Report intervention mismatch.");
    assert(version.assessment_ids.includes(assessment.id), "Report version omits assessment.");
    assert(version.score_run_ids.includes(scoreRun.id), "Report version omits score run.");
    assert(version.field_visit_ids.includes(visit.id), "Report version omits monitoring visit.");
    assert(version.evidence_ids.includes(evidence.id), "Report version omits evidence.");
    assert(version.indicator_measurement_ids.includes(measurement.id), "Report version omits indicator measurement.");
    assert(version.report_json?.assessments?.some((row) => row.id === assessment.id), "Report JSON omits assessment.");
    assert(version.report_json?.field_visits?.some((row) => row.id === visit.id), "Report JSON omits visit.");
    assert(version.report_json?.evidence?.some((row) => row.evidence_id === evidence.id), "Report JSON omits evidence.");
    assert(version.report_json?.indicators?.some((row) => row.indicator_measurement_id === measurement.id), "Report JSON omits indicator.");
    assert(evidenceRefs?.some((row) => row.evidence_id === evidence.id && row.verification_status === "verified"), "Normalized verified evidence reference is missing.");
    assert(indicatorRefs?.some((row) => row.indicator_measurement_id === measurement.id && row.verification_status === "verified"), "Normalized verified indicator reference is missing.");
  });

  await check("JSON and PDF exports exist with verified private files", async () => {
    for (const exportRow of [jsonExport, pdfExport]) {
      assert(exportRow.report_id === report.id && exportRow.report_version_id === version.id, "Export report/version mismatch.");
      assert(exportRow.export_status === "generated", "Report export is not generated.");
      assert(exportRow.storage_bucket === REPORT_BUCKET && exportRow.storage_path, "Export storage metadata is invalid.");
      assert(Number(exportRow.file_size_bytes) > 0, "Export file size is invalid.");
      assert(/^[a-f0-9]{64}$/.test(exportRow.checksum_sha256), "Export checksum is invalid.");
      await verifyStorage(REPORT_BUCKET, exportRow.storage_path, exportRow.checksum_sha256);
    }
    assert(jsonExport.export_format === "json", "JSON export format mismatch.");
    assert(pdfExport.export_format === "pdf", "PDF export format mismatch.");
  });

  console.log(JSON.stringify({
    ok: true,
    demoPrefix: DEMO_PREFIX,
    checksPassed: checks.length,
    reportId: report.id,
    reportVersionId: version.id,
  }, null, 2));
}

main().catch((error) => {
  console.error(`[impact-demo] Verification failed: ${error.message}`);
  process.exitCode = 1;
});

