# Institution platform — Sprint 7 management views and configuration

Sprint 7 turns the institution workflow into a configurable multi-tenant product. BOI and microfinance institutions use the same records, authorization paths and workflow code; branding, terminology, timing rules and support objectives vary by institution configuration.

## Delivered capability

1. A reconciled command centre shows the enterprise pipeline, finance outcomes, support workload, agent delivery, sectors and states.
2. Every metric is aggregated from records carrying the selected institution ID.
3. Institution administrators can configure brand colours, logo URL, operating terminology, escalation thresholds, journey durations and enabled export formats.
4. Development-finance, relationship-led MFB and agent-network MFB presets configure one product without branching its workflow.
5. Support-pathway templates determine the objective, duration and next follow-up applied to future post-decision plans.
6. BOI is configured as a development-finance institution using BDSP and enterprise terminology.
7. Portfolio, agent-delivery and support-activity exports are available in institution-enabled formats.
8. Every generated export is recorded in an immutable institution-scoped audit table.

## Control boundary

- Management views and exports require an active institution administrator, officer or reviewer relationship; agents retain their assignment-scoped operational queues.
- Configuration changes require institution-administrator access.
- Database aggregation and export functions are security-invoker functions executable only by the service role.
- Browser roles have no access to operating profiles, templates or export audit records.
- Export queries scope every source relation to the requested institution and do not include owner email, phone or referral contact channels.
- Configuration affects new support journeys only; it never rewrites historical decisions or support records.

## MFB activation

The product includes two distinct MFB operating profiles for acceptance testing. Actual bank names, approved colours, labels and timing rules can be applied from the configuration screen when commercial onboarding identifies each institution.
