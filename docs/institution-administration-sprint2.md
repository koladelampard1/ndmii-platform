# Institution and agent administration — Sprint 2

## Operator workflow

The DBIN platform administrator registers an institution, then invites an existing, email-verified DBIN account as its administrator. The institution administrator invites officers and reviewers, registers its BDSP organisations, and invites individual agents, whether independent or affiliated with a BDSP. The invitee accepts in the institution workspace. A person can accept memberships at more than one bank and switch context in the workspace. Each bank manages its own roster, service areas and assignments.

The assignment queue accepts an existing institution engagement. A manager can assign, reassign or revoke an agent; an agent can list only their own active assignments under the selected institution. The queue carries engagement identifiers, not business passport contents. Business enrolment and consent-gated passport sharing are Sprint 3 work.

## Access and data rules

- All routes verify the Supabase access token and resolve the application user from `auth_user_id`. Only platform `admin`/`super_admin` can register institutions or operate across institutions. Other actors require active, unexpired membership for the requested institution. Institution administrators manage their bank; officers and reviewers cannot manage rosters.
- Invitations target an existing DBIN account whose Auth email is confirmed. Invitees accept their own invitations. Revoked or suspended membership immediately fails subsequent server authorization; an agent's assignments remain recorded for audit but cease to appear in their queue.
- The three new tables use composite foreign keys to stop a BDSP, member or engagement being attached to another institution. They have RLS enabled and no direct `anon`/`authenticated` table privileges or policies. Service-role queries run only after route authorization and filter by institution ID.
- Assignment checks the agent's active membership, profile, BDSP status, and agent/BDSP service area against the business state. Changing a BDSP's status blocks its agents' queue access. Institution administrators cannot create other institution administrators; platform administrators can. Managers cannot revoke their own membership.
- Rosters and settings use the institution ID in every lookup and mutation. Responses have no-store cache headers. Operational changes write a platform audit event; assignment changes also write an engagement event. These events are best effort, so event delivery should become transactional before a regulated production rollout.

## Verification on 18 October 2026

Supabase recorded the additive migration as `20261018100651`. The development branch capability is unavailable on the project's current plan, so the migration was applied to the connected DBIN database before the application release. A transaction-wrapped fixture created two banks, one shared canonical business, two memberships for the same agent and one assignment per bank. It verified separate queues, rejected cross-bank BDSP and engagement references, checked direct client privileges, and revoked one bank membership without affecting the other. The fixture rolled back. Follow-up counts found zero fixture banks, BDSPs, profiles or assignments, and all three new tables have RLS enabled.

The automated policy tests cover administrator/agent permissions, immediate revocation, expiry, institution context and service area parsing. The repository CI runs these with typecheck, lint, routing, authentication stability and a production build. The operator screen is responsive and exposes the bank switcher, invitations, BDSP and agent rosters, assignment queue, and support contact setting.

## Current operational limits

- Agent invitations require an existing verified DBIN account; self-registration and invitation email delivery are separate work.
- New business engagement creation, passport consent, diagnostics and finance workflows are not exposed in this sprint. An existing engagement must be present to assign it.
- The existing `public.users` client grants described in the Sprint 1 note remain a separate legacy remediation. Institution APIs do not grant users table access to client roles.
- The DBIN project has no Supabase development branch on its current plan. Use transaction-rollback database fixtures and staged additive migrations until a dedicated staging database is available.
