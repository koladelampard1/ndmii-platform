/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { transform } = require("sucrase");

function loadTypeScriptModule(path, moduleRequire = require) {
  const source = readFileSync(path, "utf8");
  const compiled = transform(source, { transforms: ["typescript", "imports"] }).code;
  const loadedModule = { exports: {} };
  vm.runInNewContext(`(function (require, module, exports) { ${compiled} })(moduleRequire, loadedModule, loadedModule.exports);`, {
    console,
    loadedModule,
    moduleRequire,
  });
  return loadedModule.exports;
}

const modulePath = resolve(process.cwd(), "src/lib/data/admin-association-members.ts");
const emailValidationModule = loadTypeScriptModule(resolve(process.cwd(), "src/lib/auth/email-validation.ts"));
const source = readFileSync(modulePath, "utf8");
const compiled = transform(source, { transforms: ["typescript", "imports"] }).code;
const parserModule = { exports: {} };

function parserRequire(request) {
  if (request === "@/lib/supabase/server") {
    return {
      createServiceRoleSupabaseClient() {
        throw new Error("Supabase is not used by the parser fixture.");
      },
    };
  }
  if (request === "@/lib/auth/email-validation") {
    return emailValidationModule;
  }
  return require(request);
}

vm.runInNewContext(`(function (require, module, exports) { ${compiled} })(parserRequire, parserModule, parserModule.exports);`, {
  console,
  parserModule,
  parserRequire,
});

const {
  detectCsvDelimiter,
  parseAssociationMemberUploadRows,
  parseCsvRows,
  validateAssociationMemberUploadRow,
} = parserModule.exports;

const csvPath = resolve(process.cwd(), "public/templates/association-members-upload.csv");
const commaCsv = readFileSync(csvPath, "utf8");
const parsedSample = parseCsvRows(commaCsv);
const reportedEmails = ["adewale@example.com", "chinedu@example.com", "sani@example.com", "ibrahim@example.com", "kehinde@example.com"];
const reportedCsv = [
  "full_name,phone_number,business_name,trade_type,lga,email",
  ...reportedEmails.map((email, index) => `Member ${index + 1},0803000111${index},Business ${index + 1},Trade ${index + 1},LGA ${index + 1},${email}`),
].join("\n");
const fixtures = [
  ["comma", commaCsv],
  ["tab", parsedSample.map((row) => row.join("\t")).join("\n")],
  ["semicolon", parsedSample.map((row) => row.join(";")).join("\n")],
  ["reported-emails", reportedCsv],
  ["invisible-format-character", reportedCsv.replace("adewale@example.com", "adewale@example.com\u200B")],
];

for (const [format, csv] of fixtures) {
  const rows = parseAssociationMemberUploadRows(csv);
  const validated = rows.map((row) => validateAssociationMemberUploadRow(row.rowNumber, row.raw));
  const failed = validated.filter((row) => row.errors.length > 0);

  console.log(`${format}: delimiter=${JSON.stringify(detectCsvDelimiter(csv))} rows=${rows.length} valid=${validated.length - failed.length} failed=${failed.length}`);
  if (format === "comma") {
    assert.equal(rows.length, 5, "The production CSV sample must contain 5 rows.");
    assert.equal(validated.length - failed.length, 5, "The production CSV sample must contain 5 valid rows.");
    assert.equal(failed.length, 0, "The production CSV sample must not contain failed rows.");
  }
  if (format === "reported-emails") {
    for (const row of validated) {
      console.log(`  row=${row.rowNumber} normalized_email_length=${row.normalized.email?.length ?? 0} contains_at=${row.normalized.email?.includes("@") ?? false} errors=${JSON.stringify(row.errors)}`);
    }
    console.log(`  operational_records_eligible=${validated.length - failed.length}`);
  }
  if (failed.length > 0) {
    console.error(failed.map((row) => ({ rowNumber: row.rowNumber, errors: row.errors })));
    process.exitCode = 1;
  }
}
