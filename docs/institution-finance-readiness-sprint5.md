# Institution platform — Sprint 5 finance readiness and handover

Sprint 5 turns an approved diagnostic into an institution-specific finance preparation file. It does not make a credit decision.

## Delivered journey

1. An institution administrator versions its own document and readiness checklist.
2. The assigned agent starts finance preparation only after the diagnostic is approved.
3. The agent records gaps and sends requirement-specific document requests.
4. The business owner uploads PDF or image evidence into private storage.
5. The assigned agent verifies evidence or returns an item with a correction reason.
6. A complete preparation file can be handed over. An incomplete file requires an institution officer override and reason.
7. The institution officer accepts the handover into its workflow or returns it with a reason and next action.
8. The institution records its actual bank outcome separately. A facility approval requires an amount and ISO currency.

## Control boundary

- Every template, case, requirement, document, application and outcome carries the institution scope.
- Composite foreign keys reject cross-institution relationships.
- Browser database roles have no table grants. Server routes revalidate the authenticated actor, active institution relationship, consent, assignment and service area.
- The evidence bucket is private and downloads are streamed only after fresh authorization.
- Readiness, handover and application acceptance are explicitly labelled as preparation workflow states. Only `institution_finance_outcomes` records a bank decision.
- The generated PDF pack carries the same disclaimer.
