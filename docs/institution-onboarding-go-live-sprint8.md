# Institution platform — Sprint 8 onboarding and go-live

Sprint 8 converts institution configuration into a repeatable, evidence-led activation process. It does not create fictitious production banks: real institution names, owners, branding, agent rosters and target dates are entered only during authorized commercial onboarding.

## Delivered capability

1. Platform administrators initialize an institution against the existing development-finance, relationship-led MFB or agent-network MFB operating model.
2. Initialization creates an institution-scoped profile, support templates, onboarding project and ten standard readiness checks without changing the shared workflow code.
3. Institution managers validate and import BDSP organisations or verified DBIN agent accounts in batches of up to 500 rows.
4. Every import records its source, row-level outcome, counts and audit event; invalid rows block activation until reconciled.
5. The go-live centre shows configuration, template, administrator, agent, import and UAT readiness as independently computed controls.
6. Required UAT checks carry status, evidence notes, evidence URLs, reviewer identity and completion time.
7. Only a DBIN platform administrator can initialize or activate an institution. Institution administrators can perform and evidence UAT.
8. Activation requires every mandatory control to pass and records an immutable platform event plus the activation actor, time and sign-off note.

## Import templates

- Agents: `email,bdsp_name,service_states`
- BDSP organisations: `name,registration_number,service_states`
- Multiple service states use `|`, for example `Lagos|Ogun`.
- Agent emails must belong to existing, email-confirmed DBIN accounts. Imported agents enter as invited and must accept before the active-agent control passes.

## Acceptance boundary

- Two differently configured MFB reference tenants must reach readiness on the same schema and application routes.
- An invalid import for one institution must not affect another institution.
- Browser database roles cannot read onboarding, evidence or row-level import data or execute readiness functions.
- No production reference tenant is retained: database acceptance fixtures run inside a rolled-back transaction.
