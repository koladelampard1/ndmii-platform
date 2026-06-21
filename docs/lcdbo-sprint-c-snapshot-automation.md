# LCDBO Sprint C snapshot automation

The existing `GET /api/lcdbo/snapshots` endpoint generates governed KPI and report snapshots without an external reporting service.

## Prerequisites

1. Apply `supabase/migrations/20260621120000_lcdbo_governance_sprint_c.sql`.
2. Set `LCDBO_SNAPSHOT_SECRET` to a cryptographically random value of at least 32 characters.
3. If the deployment platform supplies `CRON_SECRET` automatically, it may be used instead.

## Invocation

Call the endpoint with a bearer token and one supported frequency:

```bash
curl --fail --show-error \
  --header "Authorization: Bearer $LCDBO_SNAPSHOT_SECRET" \
  "https://app.dbin.ng/api/lcdbo/snapshots?frequency=daily"
```

Supported frequencies are `daily`, `weekly`, `monthly`, and `quarterly`.

Each successful invocation creates or refreshes:

- all active KPI snapshots;
- national report snapshot;
- state aggregate snapshot with per-state scopes;
- cluster aggregate snapshot with per-cluster scopes;
- partner aggregate snapshot with per-partner scopes;
- readiness snapshot;
- participation snapshot;
- executive briefing snapshot;
- data-quality snapshot;
- programme-health snapshot;
- a `lcdbo.snapshot.scheduled` platform audit event.

Snapshot writes are idempotent for programme, date, report type, and frequency.

## Recommended schedules

Configure the deployment scheduler to call:

- `?frequency=daily` once daily;
- `?frequency=weekly` once each Monday;
- `?frequency=monthly` on the first day of each month;
- `?frequency=quarterly` on the first day of January, April, July, and October.

For Vercel Cron, set `CRON_SECRET` and configure the four paths above in the deployment project. Vercel sends the bearer header automatically when `CRON_SECRET` is configured. Other schedulers should send the same `Authorization` header shown in the example.

## Operational verification

A successful response includes `kpiCount`, `reportTypes`, `reportCount`, `qualityScore`, and `healthScore`. A `503` response means the secret is not configured; a `500` response after deployment normally indicates that the Sprint C migration has not been applied or snapshot generation encountered a database error.
