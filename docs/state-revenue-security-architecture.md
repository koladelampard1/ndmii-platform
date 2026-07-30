# State Revenue Workspace Security Architecture

The state revenue workspace framework is designed for multi-state reuse while preventing automatic cross-workspace access.

## Access model

- Platform administrators retain standard platform access.
- State revenue users should use the global `workspace_user` role plus active scoped `role_assignments`.
- EKIRS Sprint 0 uses institution scope:
  - Institution: `ekiti-state-internal-revenue-service`
  - Workspace: `ekirs`
  - Host: `ekirs.dbin.ng`

Supported scoped roles:

- `state_revenue_executive`
- `state_revenue_admin`
- `registration_reviewer`
- `field_supervisor`
- `field_officer`
- `taxpayer_support_officer`
- `data_analyst`
- `auditor`
- `observer`

## Boundary rules

- A scoped EKIRS user must not receive BOI, NRS, LCDBO, Impact Intelligence or admin access through the EKIRS assignment.
- Observer access is read-oriented and should not be used for export or mutation workflows.
- State revenue integrations are represented as a catalogue until live credentials and operating approvals exist.

## Data classification

EKIRS Sprint 0 includes only:

- deterministic synthetic business records;
- configured geography;
- eligibility policy definitions;
- integration readiness metadata;
- pilot readiness metadata.

It excludes:

- live revenue;
- taxpayer liabilities;
- assessments;
- collections;
- payment transactions;
- private owner fields;
- NIN, BVN or private documents.

## Deployment guidance

1. Apply the Sprint 0 migration only to the intended Supabase project.
2. Provision UAT users through authorized administrative tooling; never commit passwords.
3. Keep state-specific configuration inside the reusable state revenue jurisdiction contract.
4. Confirm LCDA data from authoritative Ekiti sources before operational LCDA usage.
