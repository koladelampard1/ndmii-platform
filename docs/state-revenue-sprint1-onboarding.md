# State Revenue Service Workspace Sprint 1

Sprint 1 adds a reusable onboarding and verification foundation for state revenue service workspaces, with EKIRS as the first configured jurisdiction.

## Scope

- Business onboarding applications for new and existing DBIN businesses.
- Authenticated save-and-resume for applicant-actionable draft, evidence-required and additional-information applications.
- Eligibility checks based on configured jurisdiction/LGA, operating presence, consent and accepted uploaded evidence.
- Duplicate screening against canonical `msmes` identity records.
- Reviewer, additional-information request and field-verification workflow.
- Canonical identity preservation: existing businesses remain linked; new identities are created only after approval.
- Private evidence uploads, metadata, short-lived signed download redirects and a private Supabase Storage bucket foundation.
- Status history, notification outbox records and trusted `platform_events` audit logging.
- Public application status lookup by application reference and submitted contact email.

## Deliberate non-scope

- No live tax assessment, liability, collection or payment claims.
- No fake OTP or SMS delivery.
- No public evidence/document URLs.
- No unauthenticated draft editing/resume workflow.
- No live Supabase Auth provisioning.
- No migration application by this code change.
- No production approval transaction/RPC, public lookup rate limiting or malware scanning claims.

## Deployment notes

Apply `supabase/migrations/20260731120000_state_revenue_business_onboarding_sprint1.sql` after Sprint 0 has been deployed. The migration is additive and creates new state-revenue application workflow tables, additional-information fields, private evidence storage policy, RLS helpers and scoped policies.

After deployment, configure UAT staff through scoped `role_assignments` for the EKIRS institution. Do not grant broad global roles where an institution-scoped role is sufficient.

Evidence uploads are handled by trusted server actions and stored in the private `state-revenue-evidence` bucket. Applicants and authorized reviewers receive short-lived signed redirects through `/api/ekirs/evidence/[evidenceId]`; object paths and signed URLs should not be logged or exposed in public DTOs.

## Applicant editability

Applicant mutations are intentionally limited to states where the applicant has been asked to act:

- `draft`: application fields and evidence may be saved before first submission.
- `evidence_required`: application fields and evidence may be updated because EKIRS has requested evidence.
- `additional_information_required`: permitted fields, applicant response and requested evidence may be updated.
- `resubmitted`: read-only for the applicant while EKIRS review is pending. Fields and evidence remain locked until an explicit reviewer transition returns the application to `evidence_required` or `additional_information_required`.

The `evidence_required` state is part of the formal Sprint 1 state machine. It is entered when the initial submission is incomplete or when a reviewer requests evidence, and it may move to `resubmitted`, `rejected` or `withdrawn`.

Evidence replacement is available only when a reviewer marks the existing evidence as `replacement_requested`.

## Controlled UAT versus production gates

Controlled UAT may proceed before the following production controls only when access is restricted to named UAT participants, test evidence contains no sensitive personal information, public promotion has not started, and the pilot is explicitly classified as controlled UAT rather than production.

Production gates before unrestricted launch:

- Transactional/RPC-based approval to prevent partial identity, jurisdiction-relationship or credential creation.
- Rate limiting for the public application-status lookup.
- Malware scanning or equivalent document-security control for unrestricted evidence upload.
- Live Supabase RLS and Storage policy verification after migration deployment.
- Authenticated browser QA and role-based UAT using provisioned EKIRS accounts.

## Validation

Run:

```bash
npm run validate:state-revenue-sprint1
```

This checks the migration, public routes, workspace routes, shared service neutrality, host routing and audit/event foundations.
