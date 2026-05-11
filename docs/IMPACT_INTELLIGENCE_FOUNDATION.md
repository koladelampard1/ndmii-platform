# BOI Impact Intelligence Foundation

This change adds the first additive foundation for BOI Impact Intelligence inside DBIN. It introduces guarded internal dashboard routes, role navigation, a simple read data layer, and foundational Supabase tables for programme monitoring and evidence-backed impact reporting.

## Routes Added

- `/dashboard/impact-intelligence`
- `/dashboard/impact-intelligence/programmes`
- `/dashboard/impact-intelligence/assessments`
- `/dashboard/impact-intelligence/field-visits`
- `/dashboard/impact-intelligence/evidence`
- `/dashboard/impact-intelligence/reports`

These routes are placeholders with professional operational UI. They are protected for:

- `admin`
- `reviewer`
- `fccpc_officer`
- `nrs_officer`
- `firs_officer`
- `association_officer`

MSME users are intentionally excluded until a future MSME-facing impact experience is explicitly defined.

## Tables Added

Migration: `20260511120000_impact_intelligence_foundation.sql`

- `impact_programmes`
- `impact_interventions`
- `impact_assessments`
- `impact_assessment_questions`
- `impact_assessment_responses`
- `impact_field_visits`
- `impact_evidence_files`
- `impact_indicators`
- `impact_reports`

All MSME relationships use internal `msme_id uuid` references to `public.msmes(id)`. User relationships reference `public.users(id)` where operational ownership, assignment, upload, generation, review, or completion context is relevant.

## Data Layer

Added `src/lib/data/impact-intelligence.ts` with typed helpers for:

- listing programmes
- listing assessments
- listing field visits
- listing reports

The helpers are intentionally simple and return empty arrays when no rows are available.

## Future Work

- Add create/edit workflows for programmes and interventions.
- Add assessment form builder and response capture.
- Add field visit scheduling and evidence upload flows.
- Add indicator tracking and impact scoring.
- Add report generation and export packages.
- Add audit logging for sensitive impact operations.
- Add role-specific record scoping once BOI programme ownership rules are finalized.
