# DBIN Smoke Checklist

Run the local source-level smoke checks:

```bash
npm run smoke:dbin
```

These checks verify that the critical DBIN route contracts are still present without requiring a seeded Supabase project.

## Manual Supabase Smoke

Use a Supabase-backed dev or staging environment for these checks because they depend on real Auth, Storage, RLS/service-role behavior, and database rows.

1. Public verification by MSME ID
   - Open `/verify/NDMII-LAG-0001` or another seeded `msmes.msme_id`.
   - Confirm the verification page resolves the MSME record.

2. Public verification by digital ID
   - Find a seeded `digital_ids.ndmii_id`.
   - Open `/verify/<ndmii_id>`.
   - Confirm the same linked MSME resolves and the route ID uses the NDMII ID.

3. Public complaints related reference
   - Submit a public complaint from a provider page with a value in the related reference field.
   - Confirm `complaints.related_reference` stores that exact value.

4. Finance readiness access control
   - Call `POST /api/msme/finance-readiness/assessments` while signed out and confirm `401`.
   - Sign in as an association officer, reviewer, FCCPC officer, FIRS/NRS officer, or admin and confirm `403`.
   - Sign in as an MSME and confirm a valid assessment returns `201`.

5. Provider logo persistence
   - Sign in as an MSME with a provider profile.
   - Upload a provider logo from `/dashboard/msme/settings`.
   - Confirm `provider_profiles.logo_url` changes.
   - Confirm `msmes.passport_photo_url` is unchanged.

6. Auth session helper metadata
   - Sign in through the UI.
   - Confirm `/api/auth/session` returns role/app user metadata derived from the Supabase token and `users` row.
   - Confirm changing client-supplied role metadata does not affect the role cookie or returned role.
