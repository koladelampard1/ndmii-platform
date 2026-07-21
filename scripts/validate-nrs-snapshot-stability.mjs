import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "src/lib/data/nrs-formalisation.ts");
const source = fs.readFileSync(sourcePath, "utf8");

const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
});

function createModule({ liveMode = "throw" } = {}) {
  const compiledModule = { exports: {} };
  const customRequire = (specifier) => {
    if (specifier === "@/lib/nrs/access") {
      return {
        canAccessNrsWorkspace: (ctx) => ["nrs_officer", "firs_officer", "admin", "super_admin"].includes(ctx.role),
      };
    }
    if (specifier === "@/lib/supabase/server") {
      return {
        createServerSupabaseClient: async () => {
          if (liveMode === "throw") throw new TypeError("simulated transient Supabase failure");
          return {
            from: () => ({
              select() {
                return this;
              },
              order() {
                return this;
              },
              limit: async () => ({ data: liveMode === "null" ? null : [], error: null }),
            }),
          };
        },
      };
    }
    throw new Error(`Unexpected import in NRS snapshot stability test: ${specifier}`);
  };

  const execute = new Function("require", "module", "exports", "process", "console", compiled.outputText);
  execute(customRequire, compiledModule, compiledModule.exports, process, console);
  return compiledModule.exports;
}

const authorizedContext = {
  authUserId: "auth-nrs",
  appUserId: "user-nrs",
  role: "nrs_officer",
  email: "officer@nrs.test",
  fullName: "NRS Officer",
  linkedMsmeId: null,
  linkedProviderId: null,
  linkedAssociationId: null,
};

const unauthorizedContext = {
  ...authorizedContext,
  role: "public",
  authUserId: null,
  appUserId: null,
};

function parseKpi(workspace, label) {
  const value = workspace.kpis.find((item) => item.label === label)?.value ?? "0";
  return Number(value.replace(/[^\d]/g, ""));
}

async function main() {
  const throwingModule = createModule({ liveMode: "throw" });
  assert.equal(throwingModule.NATIONAL_BUSINESS_TARGET, 24_835, "National target must stay fixed for Sprint 3.5.");

  const first = await throwingModule.getNrsFormalisationWorkspace(authorizedContext);
  const second = await throwingModule.getNrsFormalisationWorkspace(authorizedContext);
  assert.equal(first.snapshot.status, "ready", "Transient live-source errors must resolve to a ready deterministic snapshot.");
  assert.equal(first.snapshot.source, "deterministic", "Query exceptions must fall back to deterministic data.");
  assert.equal(first.businesses.length, 24_835, "Deterministic snapshot must contain exactly 24,835 records.");
  assert.equal(second.businesses.length, 24_835, "Repeated calls must preserve deterministic record count.");
  assert.equal(parseKpi(first, "Businesses Registered"), 24_835, "Executive KPI must derive from the same canonical records.");
  assert.equal(parseKpi(first, "Businesses Registered"), parseKpi(second, "Businesses Registered"), "Repeated KPI totals must be identical.");

  const filtered = await throwingModule.getNrsFormalisationWorkspace(authorizedContext, { state: "Lagos" });
  const afterFilter = await throwingModule.getNrsFormalisationWorkspace(authorizedContext);
  assert.ok(filtered.filteredBusinesses.length > 0, "State filters should return scoped deterministic records.");
  assert.ok(filtered.filteredBusinesses.length < filtered.businesses.length, "Filtering must derive a subset, not replace the source.");
  assert.equal(afterFilter.businesses.length, 24_835, "Filtering must not mutate the canonical dataset.");
  assert.equal(parseKpi(afterFilter, "Businesses Registered"), 24_835, "KPI totals must remain stable after filtered calls.");

  const nullLiveModule = createModule({ liveMode: "null" });
  const nullLive = await nullLiveModule.getNrsFormalisationWorkspace(authorizedContext);
  assert.equal(nullLive.businesses.length, 24_835, "Null live responses must fall back to deterministic records.");

  const emptyLiveModule = createModule({ liveMode: "empty" });
  const emptyLive = await emptyLiveModule.getNrsFormalisationWorkspace(authorizedContext);
  assert.equal(emptyLive.businesses.length, 24_835, "Empty live responses must fall back to deterministic records.");

  const unauthorized = await throwingModule.getNrsFormalisationWorkspace(unauthorizedContext);
  assert.equal(unauthorized.snapshot.status, "unauthorized", "Unauthorized contexts must be explicit.");
  assert.equal(unauthorized.kpis.length, 0, "Unauthorized contexts must not produce fake zero KPI dashboards.");

  assert.ok(!/from\("invoices"\)|from\("payments"\)|vat_amount|outstanding_amount|estimated_monthly_obligation/i.test(source), "NRS data layer must not query private transaction or liability data.");
  console.log("ok - NRS deterministic snapshot remains stable across errors, filters and repeated calls");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
