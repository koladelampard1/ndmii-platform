#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const shell = read("src/components/lcdbo/lcdbo-shell.tsx");
const landing = read("src/components/lcdbo/lcdbo-landing.tsx");
const resources = read("src/app/lcdbo/resources/page.tsx");
const contact = read("src/app/lcdbo/contact/page.tsx");
const governance = read("src/lib/lcdbo/public-governance.ts");
const contentFile = read("src/lib/lcdbo/content.ts");
const programmeModel = read("src/lib/lcdbo/programme-model.ts");
const hosts = read("src/lib/routing/dbin-hosts.ts");
const content = `${shell}\n${landing}\n${resources}\n${contact}\n${governance}\n${contentFile}\n${programmeModel}`;

for (const phrase of [
  "Raw Materials Research and Development Council",
  "Institutional Home and Public-Sector Anchor of LCDBO",
  "An RMRDC-led Programme",
  "Institutional Lead and Public-Sector Anchor",
  "Programme Architecture and Implementation",
  "Roseate Forte Nigeria Limited",
  "Digital Infrastructure",
  "Powered by DBIN",
  "Building Nigeria&apos;s Industrial Future, Beyond Oil.",
  "Anchored by the Raw Materials Research and Development Council",
  "Programme readiness information",
  "Programme resources",
  "Programme figures are presented as source-backed ambitions, projections, targets or reference geography",
  "Enabled by governed digital infrastructure and accountable programme operations",
  "info@lcdbo.com",
]) {
  assert(content.includes(phrase), `Missing required institutional presentation phrase: ${phrase}`);
}

const roleModel = landing.slice(landing.indexOf("const institutionalRoles"));
assert(
  roleModel.indexOf("RMRDC") < roleModel.indexOf("Roseate Forte Nigeria Limited") &&
    roleModel.indexOf("Roseate Forte Nigeria Limited") < roleModel.indexOf("DBIN"),
  "Institutional hierarchy must introduce RMRDC before Roseate Forte and DBIN.",
);

assert(shell.includes("LcdboInstitutionalMasthead") && shell.includes("LcdboInstitutionalFooter"), "LCDBO shell must include institutional masthead and footer.");
assert(shell.includes("lcdboPublicHref") && landing.includes("lcdboPublicHref"), "LCDBO public links must use canonical href helpers.");
assert(!content.includes("/images/rmrdc") && !content.includes("rmrdc-logo"), "Do not reference a fabricated RMRDC logo asset.");
assert(shell.includes("scroll-padding-top") && shell.includes("scroll-margin-top"), "LCDBO shell must define sticky-header scroll offsets.");
assert(shell.includes("Skip to LCDBO content"), "LCDBO shell must include a skip link.");
assert(shell.includes("application/ld+json"), "LCDBO shell must emit structured data.");
assert(landing.includes("safePublicMeasures()"), "LCDBO measures must render from governed public measure config.");
assert(landing.includes("safeProgrammeStatuses()"), "Programme status must render from governed status config.");
assert(landing.includes("safePublicResources()"), "Homepage resources must render from governed resource config.");
assert(resources.includes("safePublicResources()"), "Resource page must render from governed resource config.");
assert(landing.includes("lg:grid-cols-6") && !landing.includes("gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3"), "Stakeholder grid must not use the old nine-cell layout.");
assert(hosts.includes('"lcdbo.com"') && hosts.includes('"www.lcdbo.com"'), "LCDBO commercial hosts must remain recognised.");

for (const classification of [
  "Live operational data",
  "Configured programme target",
  "Long-term ambition",
  "Governed estimate",
  "Reference geography",
  "Publicly verified result",
  "Sample/demo data",
]) {
  assert(governance.includes(classification), `Missing measure classification: ${classification}`);
}

for (const resourceState of ['status: "published"', 'status: "scheduled"', "href: null"]) {
  assert(governance.includes(resourceState), `Missing governed publication handling: ${resourceState}`);
}

for (const requiredMeasure of [
  "36 States + FCT",
  "within national design scope",
  "5,000",
  "$100B",
  "long-term investment mobilisation ambition",
  "Contribution pathway toward Nigeria’s $1T economy ambition",
]) {
  assert(content.includes(requiredMeasure), `Missing governed measure language: ${requiredMeasure}`);
}

for (const unsupportedClaim of [
  "officially approved by the Federal Government",
  "Federal Government programme",
  "statutory national programme",
  "nationwide implementation already active",
  "thousands of businesses supported",
  "revenue generated",
  "States covered",
  "5,000+ MSMEs per LGA",
  "$100B Investment mobilisation",
  "$1T Industrial economy pathway",
  "Provides programme legitimacy",
  "Supported by governed infrastructure, not loose programme administration",
  "Anchored by Nigeria&apos;s Raw Materials Development Institution",
  "Demonstration profile",
  "Future phase",
]) {
  assert(!content.toLowerCase().includes(unsupportedClaim.toLowerCase()), `Unsupported institutional claim found: ${unsupportedClaim}`);
}

console.log(JSON.stringify({
  validation: "lcdbo_institutional_presentation",
  status: "passed",
  hierarchy: ["RMRDC", "Roseate Forte Nigeria Limited", "DBIN"],
}));
