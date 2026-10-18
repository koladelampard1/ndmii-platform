# Institution engagement foundation — Sprint 1

## Data boundaries

- `msmes` remains DBIN's canonical business identity.
- `institution_engagements` records a private relationship between one institution and one business. Two banks can reference the same MSME without sharing an engagement.
- The engagement starts with passport access `pending`; no institution can infer consent from an engagement's existence. Sharing and revocation operations belong in Sprint 3.
- No existing `impact_*` record is reinterpreted as a bank application. The BOI workspace currently uses cohorts and interventions as pipeline proxies; the future finance workflow will introduce distinct application records.
- `institution_engagement_events` has a composite foreign key so an event cannot claim a different institution from its engagement.

## Access contract

- The new API verifies the Supabase session itself and resolves the application user by `auth_user_id`. It does not use fallback identity cookies or a global role to grant institution access.
- An active institution and an active, unexpired membership with an allowed institution role are required. A DBIN admin or BOI executive receives no implicit access to another institution.
- Queries include the institution ID from the verified access context. Responses contain engagement metadata only; passport data is not exposed.
- The new tables have RLS enabled and no `anon` or `authenticated` grants or policies. Server access uses the service role after the access checks. This is deliberately fail-closed until agent assignment and business consent policies are implemented.
- The existing impact and BOI workspace functions have broader legacy access patterns. Do not reuse them for bank engagements or expose them through the new workspace. Their own institution scoping needs a separate compatibility review before bank users receive those routes.

## Repository-to-live verification

The DBIN Supabase connection reaches project `tjowaqgyuehmkovfyvqx`. On 18 October 2026, the pre-deployment audit confirmed that the new engagement tables were absent, the existing `institutions_type_check` had exactly the expected ten types, and the referenced identity, institution and member columns had compatible types. At that time the database held seven institutions, 265 MSMEs and no institution members.

Supabase rejected creation of a development branch because this project does not have branching on its current plan. The additive migration was applied to the live DBIN project while the code route was still undeployed. Supabase recorded it as version `20261018093800`, so the repository file bears that version. The bank A/bank B fixture ran in a single transaction ending with `ROLLBACK`: separate engagements were allowed, a falsely scoped event was rejected, direct client table privileges were denied, and follow-up counts confirmed that no test banks, users or engagements remained. Both new tables have RLS enabled, no client grants, and service-role access. The linter's `rls_enabled_no_policy` notices for these two tables are expected because they deliberately have no direct client policies.

The audit also revealed an existing security issue outside this migration: `public.users` has RLS disabled and client SELECT grants. Several legacy client flows query it directly. Treat remediation as a separate compatibility migration with its own regression tests; changing it blindly during this engagement rollout would disrupt sign-in and dashboards.

## Acceptance matrix

| Attempt | Expected result |
| --- | --- |
| Bank A officer requests Bank A engagements | Allowed |
| Bank A officer changes URL to Bank B | Denied unless separately an active Bank B member |
| Agent, invited, revoked, suspended or expired member | Denied |
| Global BOI executive or DBIN administrator without Bank A membership | Denied |
| Anonymous or authenticated direct Data API read/write | Denied by grants and RLS |
| One business has engagements at Bank A and Bank B | Same `msme_id`, separate institution records |
| Engagement event claims wrong institution | Rejected by composite foreign key |

## Scope remaining after Sprint 1

Institution and agent administration, creation of engagement records, Passport sharing, diagnostics and application workflows belong to later sprints. The Sprint 1 API provides a secure read foundation only.
