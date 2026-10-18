# Business enrolment and passport sharing — Sprint 3

## Journeys

1. A bank officer or accredited agent enrols a new business and names an existing, email-verified DBIN business account. One transaction creates the canonical `msmes` identity, an institution-specific engagement, a pending consent record and an event. A matching business name and owner email already in the registry causes a conflict instead of silently creating a duplicate.
2. An existing business account can select one of its own DBIN businesses and request a relationship with a listed financial institution. This uses the same canonical `msmes` row; every institution receives a separate engagement.
3. The business account sees requests addressed to it. It explicitly confirms a grant or withdrawal. The consent update, engagement status and event are written together in one database transaction. The institution can read the passport summary only while both the consent record and engagement say `granted`.
4. The summary contains only the DBIN business ID, business name, state, sector and verification status. It excludes owner contacts, NIN, BVN, finance, documents and the full `msmes` row. An agent additionally needs a current assignment, active membership and BDSP, and an allowed service area.

## Boundaries and limitations

- The request is not consent. `passport_access_status` begins pending; only the verified target business account can act. Revocation stops subsequent API reads immediately. The server uses a verified Supabase access token and a service-role client after authorization; neither new table nor RPC is callable by direct client roles.
- The target account must already exist and have a confirmed Auth email. There is no invitation email or unregistered-owner claim flow yet. The account must decide whether it is authorised to share the named business; an agent-entered contact address alone never grants access.
- An agent-created business remains attributed to the enrolling agent in the existing `msmes.created_by` field. The named business account controls this institution's consent request, but broader canonical profile ownership transfer is a separate identity-verification workflow. Existing self-registered businesses can initiate their own bank relationships.
- The database prevents exact same owner-email/business-name duplicates through an enrolment check, but legacy identities with variant spelling or different contacts still need a later assisted match and claim process.
- Passport access is a minimum business identity summary, not a full finance application or credit file. Diagnostics, document-specific consent, credit decisions and post-finance workflows follow in later sprints.

## Verification

Supabase recorded migration `20261018104705`. A transaction-wrapped fixture created two banks, one existing business and separate engagements. It granted Bank A without changing Bank B, revoked Bank A, rejected an unauthorised owner, enrolled a second business atomically, rejected an exact duplicate, and checked function and table privileges. The fixture rolled back; follow-up checks found no fixture banks or consent records, RLS enabled, and no direct authenticated execution privilege on the consent function. Repository typecheck, lint, CI and build checks are part of the deployment gate.
