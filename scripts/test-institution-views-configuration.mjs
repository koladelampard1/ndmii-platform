import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { OPERATING_PRESETS,csvCell,defaultProfile,rowsToCsv,validInstitutionProfile,validSupportTemplate } from "../src/lib/institutional/institution-insights-policy.ts";
const migration=readFileSync("supabase/migrations/20261018140023_institution_views_configuration_exports.sql","utf8");
const dashboard=readFileSync("src/app/api/institutions/[institutionId]/dashboard/route.ts","utf8");
const configuration=readFileSync("src/app/api/institutions/[institutionId]/configuration/route.ts","utf8");
const exportsRoute=readFileSync("src/app/api/institutions/[institutionId]/exports/route.ts","utf8");
const financeCompanyMigration=readFileSync("supabase/migrations/20261018154500_add_finance_company_operating_model.sql","utf8");

test("four operating models vary rules and terminology without workflow forks",()=>{
 const boi=OPERATING_PRESETS.development_finance;const relationship=OPERATING_PRESETS.relationship_mfb;const network=OPERATING_PRESETS.agent_network_mfb;const ethical=OPERATING_PRESETS.non_interest_finance;
 assert.equal(boi.agentLabelSingular,"BDSP");assert.equal(relationship.agentLabelSingular,"Relationship Officer");assert.equal(network.agentLabelSingular,"Field Agent");
 assert.equal(ethical.financeLabel,"Ethical financing readiness");assert.equal(ethical.businessLabelSingular,"MSME");
 assert.notEqual(relationship.postFinanceDays,network.postFinanceDays);assert.notEqual(relationship.primaryColor,network.primaryColor);
 for(const value of Object.values(OPERATING_PRESETS))assert.equal(validInstitutionProfile(value),true);
});
test("unconfigured institutions receive a safe type-aware profile",()=>{
 assert.equal(defaultProfile("development_finance_institution","National Development Bank").operatingModel,"development_finance");
 assert.equal(defaultProfile("microfinance_bank","Community MFB").operatingModel,"relationship_mfb");
 assert.equal(defaultProfile("finance_company","Amaanah Finance Company").operatingModel,"non_interest_finance");
});
test("profile and support-template validation reject unsafe configuration",()=>{
 assert.equal(validInstitutionProfile({...OPERATING_PRESETS.relationship_mfb,primaryColor:"red"}),false);
 assert.equal(validInstitutionProfile({...OPERATING_PRESETS.relationship_mfb,exportFormats:[]}),false);
 assert.equal(validSupportTemplate({pathway:"post_finance",name:"Support",objective:"Grow the business",targetDays:60,followUpDays:7}),true);
 assert.equal(validSupportTemplate({pathway:"closed",name:"Closed journey",objective:"Retain the record",targetDays:0,followUpDays:null}),true);
 assert.equal(validSupportTemplate({pathway:"closed",name:"Closed journey",objective:"Retain the record",targetDays:30,followUpDays:null}),false);
});
test("CSV serialization preserves columns and neutralizes delimiters",()=>{
 assert.equal(csvCell('Buyer, supplier'),`"Buyer, supplier"`);assert.equal(csvCell('A "quoted" value'),`"A ""quoted"" value"`);
  assert.equal(csvCell("=HYPERLINK(\"https://example.invalid\")"),`"'=HYPERLINK(""https://example.invalid"")"`);
 assert.equal(rowsToCsv([{business:"Alpha",note:"a,b"}]),'business,note\r\nAlpha,"a,b"');
});
test("schema provides scoped profiles, reconciled snapshots, and immutable export audit",()=>{
 for(const table of ["institution_operating_profiles","institution_support_templates","institution_report_exports"]){assert.match(migration,new RegExp(`create table public\\.${table}`));assert.match(migration,new RegExp(`alter table public\\.${table} enable row level security`));}
 assert.match(migration,/revoke all on public\.institution_report_exports from service_role/);assert.match(migration,/grant select,insert on public\.institution_report_exports to service_role/);
 assert.match(migration,/institution_dashboard_snapshot\(p_institution_id uuid\)/);assert.match(migration,/where institution_id=p_institution_id/);
 assert.match(migration,/institution_export_dataset\(p_institution_id uuid,p_dataset text\)/);assert.match(migration,/where e\.institution_id=p_institution_id/);
 assert.match(migration,/from public\.institutions where slug='boi'/);
});
test("finance companies use a dedicated non-interest operating model",()=>{
 assert.match(financeCompanyMigration,/'finance_company'/);
 assert.match(financeCompanyMigration,/'non_interest_finance'/);
 assert.match(financeCompanyMigration,/security invoker/);
 assert.match(financeCompanyMigration,/revoke all on function public\.institution_initialize_onboarding/);
});
test("routes revalidate institution access before dashboards, configuration, or exports",()=>{
 assert.match(dashboard,/requireInstitutionActor/);assert.match(dashboard,/requireInsightsViewer/);assert.match(dashboard,/institution_dashboard_snapshot/);
 assert.match(configuration,/requireManager/);assert.match(configuration,/validInstitutionProfile/);assert.match(configuration,/validSupportTemplate/);
 assert.match(exportsRoute,/requireInstitutionActor/);assert.match(exportsRoute,/requireInsightsViewer/);assert.match(exportsRoute,/institution_export_dataset/);assert.match(exportsRoute,/institution_report_exports/);
});
