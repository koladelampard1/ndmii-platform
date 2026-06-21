# LCDBO Sprint B demonstration data

The Sprint B dataset is synthetic and opt-in. It is intended for a dedicated demonstration or staging Supabase project and is never executed by migrations, builds, deploys, or application startup.

## Generate the dataset

Configure the target Supabase project in `.env.local`, then run:

```bash
ALLOW_LCDBO_DEMO_SEED=true \
LCDBO_DEMO_CONFIRM=lcdbo-national-demo-v1 \
npm run seed:lcdbo-demo
```

Production execution remains blocked when `NODE_ENV=production` unless `ALLOW_PRODUCTION_DEMO_SEED=true` is also explicitly supplied.

## Dataset composition

- 150 synthetic MSMEs across ten sectors and ten states/FCT
- 24 synthetic industrial clusters
- 15 synthetic programme, field, and assessment officers
- programme enrolments and cluster participation states
- readiness assessments spanning all five LCDBO readiness levels
- document requests, submissions, approvals, and rejections
- sample platform activity events

Every generated operational row carries `demo_data: true`, `demo_dataset: lcdbo-national-demo-v1`, and `safe_to_remove: true` metadata. MSME names and IDs use visible `DEMO` prefixes. The generator removes and recreates only rows carrying the same dataset marker, making repeated demonstration runs deterministic without touching non-demo records.

## Programme estimates

Sprint B dashboards label derived values as **Programme Estimate**:

- jobs supported: sum of recorded synthetic employee estimates;
- MSMEs enabled: current LCDBO enrolment count;
- cluster capacity: sum of configured cluster MSME targets;
- export readiness: latest assessments classified `ready_for_export`;
- investment pipeline: sum of configured cluster investment requirements.

These figures are presentation estimates, not official government statistics.
