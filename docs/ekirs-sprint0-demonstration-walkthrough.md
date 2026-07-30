# EKIRS Sprint 0 Demonstration Walkthrough

This walkthrough supports the controlled EKIRS architecture and UAT foundation. No live revenue, taxpayer data, assessment records, liabilities, payments or collections are used.

## Public entry

1. Open `https://ekirs.dbin.ng/`.
2. Confirm the page title: “Ekiti Business Formalisation and Revenue Readiness Platform”.
3. Review the public disclosures and confirm the page states that Sprint 0 uses deterministic synthetic records only.
4. Use the Staff sign-in CTA to reach `/login?workspace=ekirs&next=/dashboard/ekirs`.

## Authenticated workspace

1. Sign in with an authorized EKIRS scoped workspace user or platform administrator.
2. Open `/dashboard/ekirs`.
3. Confirm the sidebar shows:
   - Executive Overview
   - Business Registry
   - Onboarding & Verification
   - Formalisation Journey
   - LGA & LCDA Intelligence
   - Integrations
   - Pilot Readiness

## Demonstration path

### Executive narrative

The story to tell is simple:

1. DBIN gives businesses a safer formalisation path before any live revenue operation.
2. Businesses gain a clearer identity record, readiness guidance, digital record-keeping support and a trusted way to present operating information.
3. EKIRS gains a privacy-safe view of formalisation readiness, jurisdiction evidence, support needs and field-enumeration priorities.
4. Ekiti-only eligibility is based on declared jurisdiction, operating LGA, town/address context, consent-backed evidence and reviewer decision.
5. The data is trustworthy for demonstration because it is deterministic, synthetic and reconciled by validation scripts.
6. Verification develops over time from self-declared profile to contact verified, jurisdiction verified, identity linked and field confirmed.
7. `BIN-EK` represents a synthetic Ekiti business-identity prefix for controlled UAT demonstration.
8. `BIN-EK` does not represent a tax assessment, taxpayer liability, payment demand, revenue collection record or official production identifier.
9. Business records, invoices and bookkeeping signals can support voluntary compliance readiness without exposing private transaction surveillance by default.
10. EKIRS can see aggregate readiness, business-profile context, LGA distribution, support needs, evidence states and data-quality exceptions configured for the workspace.
11. EKIRS cannot see private owner identifiers, NIN, BVN, bank accounts, private documents, live invoices, collections, liabilities or internal tax notes by default.
12. Field enumeration will be introduced through assigned officer workflows, operating evidence, consent, review status and audit events.
13. Integrations will be introduced through governed identity, TIN, CAC reference, field verification, notification and future payment-provider controls.
14. Before pilot, EKIRS must confirm users, LCDA reference data, operating procedures, privacy wording and the target Supabase migration.
15. The same state revenue architecture can support another state by changing jurisdiction configuration, institution scope, host metadata, geography, BIN prefix, palette and pilot settings.

1. Open Business Registry and filter by LGA, sector, verification level, TIN-readiness and formality status.
2. Open a business profile and confirm it uses a synthetic `BIN-EK` identifier.
3. Open Onboarding & Verification and explain the eligibility policy: declared jurisdiction, operating address, consent-backed evidence and reviewer decision.
4. Open Formalisation Journey and explain the five verification levels.
5. Open LGA & LCDA Intelligence and explain that the 16 constitutional LGAs are configured while LCDA records remain pending authoritative confirmation.
6. Open Integrations and explain the foundation catalogue. Emphasize that payment-provider integration is future-only.
7. Open Pilot Readiness and review the required gates before live UAT.

## Presenter language

- Use “formalisation readiness”, “jurisdiction eligibility”, “operating intelligence” and “integration readiness”.
- Do not describe the dataset as live revenue, assessment, liability, collection, taxpayer debt or payment data.
- Do not imply that EKIRS has approved live production operations until formal confirmation is received.

## Production gates

- Apply `20260730120000_state_revenue_ekirs_sprint0.sql` to the target Supabase environment.
- Provision scoped UAT users only through the authorized administrative process.
- Confirm authoritative LCDA records before enabling LCDA-specific operations.
- Obtain EKIRS approval for live operating procedures, privacy notices and integration credentials.
