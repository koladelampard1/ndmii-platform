# Institution platform — Sprint 6 continuing support and market links

Sprint 6 converts every recorded finance outcome into an accountable next-step journey. It preserves the finance decision as immutable history and adds the operational work required after that decision.

## Delivered journey

1. A recorded finance outcome automatically creates an institution-scoped support plan.
2. Approved facilities enter post-finance support for responsible use, repayment and sustainable growth.
3. Deferred or declined businesses return to a development pathway without losing diagnostic, preparation, application or decision history.
4. Additional-information outcomes enter a time-bound continuing-support pathway; withdrawn applications are retained as closed journeys.
5. The assigned agent or an authorised institution supervisor maintains milestones, field visits, mentoring, training, issues and follow-up dates.
6. Buyer and supplier referrals are tracked from proposal through introduction, engagement and conversion or closure.
7. Overdue milestones, visits and referrals, plus unresolved critical issues, are prioritised in agent and supervisor queues.
8. The business owner sees the institution's outcome and the support journey shared with the business, but not internal contact details or audit metadata.

## Control boundary

- Every support record carries institution and plan scope with composite foreign keys.
- Browser database roles have no direct table grants; server routes revalidate the authenticated actor, active institution relationship, consent, assignment and service area.
- Institution officers can supervise the institution portfolio. Agents can access only businesses currently assigned to them.
- Assignment changes synchronise open support plans while preserving their full event history.
- Status changes append history records. History is not updateable or deleteable through the application service role grant.
- Finance outcomes are not overwritten by subsequent support activity.
