import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const DEMO_PREFIX = "DEMO - Impact Intelligence UAT";
export const DEMO_KEY_PREFIX = "impact-intelligence-uat-v1";
export const EVIDENCE_BUCKET = "impact-evidence";
export const REPORT_BUCKET = "impact-reports";

export const DEMO_KEYS = {
  operator: `${DEMO_KEY_PREFIX}:operator`,
  programme: `${DEMO_KEY_PREFIX}:programme`,
  cohort: `${DEMO_KEY_PREFIX}:cohort`,
  msme: `${DEMO_KEY_PREFIX}:msme`,
  member: `${DEMO_KEY_PREFIX}:member`,
  intervention: `${DEMO_KEY_PREFIX}:intervention`,
  template: `${DEMO_KEY_PREFIX}:assessment-template`,
  section: `${DEMO_KEY_PREFIX}:assessment-section`,
  question: `${DEMO_KEY_PREFIX}:assessment-question`,
  assessment: `${DEMO_KEY_PREFIX}:assessment`,
  response: `${DEMO_KEY_PREFIX}:assessment-response`,
  scoreRun: `${DEMO_KEY_PREFIX}:assessment-score-run`,
  score: `${DEMO_KEY_PREFIX}:assessment-score`,
  assessmentReview: `${DEMO_KEY_PREFIX}:assessment-review`,
  visit: `${DEMO_KEY_PREFIX}:monitoring-visit`,
  visitNote: `${DEMO_KEY_PREFIX}:monitoring-note`,
  evidence: `${DEMO_KEY_PREFIX}:evidence`,
  indicator: `${DEMO_KEY_PREFIX}:indicator`,
  measurement: `${DEMO_KEY_PREFIX}:measurement`,
  report: `${DEMO_KEY_PREFIX}:report`,
  reportVersion: `${DEMO_KEY_PREFIX}:report-version`,
  jsonExport: `${DEMO_KEY_PREFIX}:json-export`,
  pdfExport: `${DEMO_KEY_PREFIX}:pdf-export`,
};

export function loadLocalEnv() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

export function createServiceClient() {
  loadLocalEnv();
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function demoMetadata(demoKey, extra = {}) {
  return {
    demo_key: demoKey,
    demo_prefix: DEMO_PREFIX,
    demo_data: true,
    safe_to_remove: true,
    ...extra,
  };
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function step(message) {
  console.log(`[impact-demo] ${message}`);
}

export async function expectOne(query, label) {
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

export async function findByDemoKey(supabase, table, demoKey, columns = "*") {
  return expectOne(
    supabase
      .from(table)
      .select(columns)
      .eq("metadata->>demo_key", demoKey)
      .limit(1),
    `Could not query ${table}`,
  );
}

export async function insertOne(supabase, table, payload, columns = "*") {
  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select(columns)
    .single();
  if (error) throw new Error(`Could not insert ${table}: ${error.message}`);
  return data;
}

export async function updateOne(supabase, table, id, payload, columns = "*") {
  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq("id", id)
    .select(columns)
    .single();
  if (error) throw new Error(`Could not update ${table}: ${error.message}`);
  return data;
}

export async function ensureByDemoKey(
  supabase,
  table,
  demoKey,
  payload,
  columns = "*",
) {
  const existing = await findByDemoKey(supabase, table, demoKey, columns);
  if (existing) return { row: existing, created: false };
  const row = await insertOne(supabase, table, {
    ...payload,
    metadata: demoMetadata(demoKey, payload.metadata),
  }, columns);
  return { row, created: true };
}

export async function ensureStorageObject(
  supabase,
  bucket,
  storagePath,
  bytes,
  contentType,
) {
  const folder = storagePath.slice(0, storagePath.lastIndexOf("/"));
  const fileName = storagePath.slice(storagePath.lastIndexOf("/") + 1);
  const listed = await supabase.storage.from(bucket).list(folder, {
    search: fileName,
    limit: 10,
  });
  if (listed.error) {
    throw new Error(`Could not inspect ${bucket}/${storagePath}: ${listed.error.message}`);
  }
  if ((listed.data ?? []).some((item) => item.name === fileName)) {
    const downloaded = await supabase.storage.from(bucket).download(storagePath);
    if (downloaded.error) {
      throw new Error(`Could not verify ${bucket}/${storagePath}: ${downloaded.error.message}`);
    }
    const existingBytes = Buffer.from(await downloaded.data.arrayBuffer());
    assert(
      sha256(existingBytes) === sha256(bytes),
      `Refusing to overwrite ${bucket}/${storagePath}; its checksum does not match the demo artifact.`,
    );
    return false;
  }
  const uploaded = await supabase.storage
    .from(bucket)
    .upload(storagePath, bytes, { contentType, upsert: false });
  if (uploaded.error) {
    throw new Error(`Could not upload ${bucket}/${storagePath}: ${uploaded.error.message}`);
  }
  return true;
}

function pdfEscape(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export function createTinyPdf(lines) {
  const stream = [
    "BT",
    "/F1 11 Tf",
    "48 790 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? "" : "0 -18 Td",
      `(${pdfEscape(line)}) Tj`,
    ]).filter(Boolean),
    "ET",
  ].join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

