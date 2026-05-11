# DBIN MASTER ARCHITECTURE CONTEXT
## Development Business Intelligence Network (DBIN)
### Development Impact Intelligence Infrastructure for MSME Interventions

---

# 1. PURPOSE OF THIS DOCUMENT

This document defines the master architectural context, operational philosophy, governance rules, identity rules, and implementation boundaries for DBIN.

It exists to ensure that all future engineering, architecture, migrations, APIs, dashboards, workflows, analytics, AI functionality, and integrations remain consistent with the long-term vision of the platform.

This document is the primary architectural reference for all future implementation work.

All contributors, engineers, AI coding agents, and implementation teams must follow the principles and constraints defined here.

# IMPORTANT IMPLEMENTATION CONSTRAINTS

This document defines architectural direction, invariants, and long-term system principles.

It is NOT an instruction to rewrite, replace, or refactor the existing DBIN platform indiscriminately.

All implementation work must:

- preserve existing working functionality,
- prioritize backward compatibility,
- avoid destructive schema changes,
- avoid unnecessary refactors,
- prefer additive architecture,
- prefer launch-safe implementation,
- preserve existing auth/session behavior unless explicitly instructed,
- preserve existing MSME workflows unless explicitly instructed,
- preserve existing public verification flows unless explicitly instructed.

Any major refactor, schema rewrite, identity migration, or architectural replacement must be explicitly requested and approved before implementation.

When uncertain, prefer:
- compatibility,
- graceful fallback behavior,
- adapter layers,
- incremental evolution,
- and additive implementation.

Do not assume the live database perfectly matches local migrations.

Always inspect live schema behavior before introducing strict assumptions.
---

# 2. WHAT DBIN IS

DBIN is not just an MSME portal.

DBIN is a Development Impact Intelligence Infrastructure designed to support:

- MSME intelligence management
- intervention governance
- assessment operations
- field monitoring
- evidence-backed reporting
- impact analytics
- programme intelligence
- development finance visibility
- institutional decision support

The platform is intended to support organizations such as:

- Bank of Industry (BOI)
- development finance institutions
- intervention programmes
- government agencies
- donor-funded programmes
- MSME support ecosystems
- monitoring & evaluation operations
- impact assessment teams

DBIN functions both as:
1. an operational intervention platform
2. a long-term intelligence infrastructure

---

# 3. STRATEGIC OBJECTIVES

The platform is intended to help institutions:

- centrally profile MSMEs
- reduce fragmented beneficiary records
- track interventions end-to-end
- conduct assessments at scale
- monitor intervention outcomes
- validate field activities
- collect evidence
- generate reliable impact reports
- improve programme visibility
- support data-driven decision making
- strengthen auditability and governance

---

# 4. CORE ARCHITECTURAL PHILOSOPHY

The architecture of DBIN follows these principles:

## 4.1 MSME-Centric Intelligence

The MSME is the central intelligence entity.

All operational and analytical workflows ultimately connect back to the MSME.

This includes:
- interventions
- assessments
- field monitoring
- evidence
- reports
- impact indicators
- complaints
- business plans
- dashboards

---

## 4.2 Internal UUIDs Are Canonical

Internal UUIDs are the authoritative database references.

Public-facing IDs must never be treated as primary database relationships.

---

## 4.3 Public IDs Are Display Identities

Public business identifiers exist for:
- display
- verification
- external communication
- printable IDs
- QR workflows

Public IDs must not replace internal UUID relationships.

---

## 4.4 Evidence-Driven Reporting

Reports must be traceable to:
- assessments
- field monitoring
- uploaded evidence
- intervention records
- approved indicators

Impact reporting must never rely on untraceable narrative-only workflows.

---

## 4.5 Assessments Drive Intelligence

Assessments are foundational to:
- intervention eligibility
- impact measurement
- monitoring prioritization
- readiness scoring
- recommendation systems
- intelligence generation

---

## 4.6 Dashboards Derive From Operational Data

Dashboards must be generated from actual structured operational data.

Dashboard metrics should not exist independently from:
- assessments
- interventions
- monitoring records
- evidence
- impact indicators

---

## 4.7 Role-Based Access Control Is Mandatory

All access must be role-scoped.

No sensitive operational data should be accessible without authorization.

---

## 4.8 Auditability Is Mandatory

Sensitive platform actions must generate audit logs.

The platform should always support:
- accountability
- oversight
- traceability
- compliance review

---

## 4.9 AI Is Assistive, Not Authoritative

AI may support:
- summaries
- recommendations
- anomaly detection
- report drafting
- insight generation

AI must not autonomously:
- approve interventions
- finalize reports
- alter assessments
- override governance controls

Human review remains mandatory.

---

# 5. CURRENT TECHNOLOGY FOUNDATION

Current stack includes:

- Next.js
- TypeScript
- Supabase
- PostgreSQL
- Vercel
- RBAC-based auth/session architecture
- API route architecture
- server-side workspace context resolution

The platform already contains:
- MSME dashboard
- provider workspace architecture
- digital identity workflows
- verification routes
- complaint workflows
- business plan builder
- public verification logic
- admin dashboards

Future implementation must preserve compatibility with existing architecture where possible.

---

# 6. CANONICAL IDENTITY RULES

These rules are mandatory and must not be violated.

| Entity | Meaning |
|---|---|
| msmes.id | Internal UUID only |
| msmes.msme_id | Stable public MSME/business ID |
| digital_ids.ndmii_id | Public digital credential ID |
| digital_ids.msme_id | FK to msmes.id |
| provider_profiles.msme_id | FK to msmes.id only |
| complaints.msme_id | FK to msmes.id only |
| interventions.msme_id | FK to msmes.id only |
| assessments.msme_id | FK to msmes.id only |

---

# 7. IDENTITY GOVERNANCE RULES

## 7.1 Public IDs Must Never Replace UUIDs

Public MSME IDs must never become the canonical FK relationship.

---

## 7.2 Credential IDs Must Remain Separate

digital_ids.ndmii_id is not the same as msmes.msme_id.

These identities must remain logically distinct.

---

## 7.3 QR Verification

QR verification should prefer:

```text
/verify/{digital_ids.ndmii_id}

Fallbacks may exist for backward compatibility only.

7.4 Provider Profiles

provider_profiles.msme_id must always reference:

msmes.id

Never public MSME IDs.

8. CORE SYSTEM MODULES

The platform consists of the following major modules:

MSME Registry
Intervention Management
Assessment Engine
Monitoring & Field Verification
Evidence Management
Reporting Engine
Dashboard & Analytics
Business Plan Builder
Credit Readiness
Complaint & Escalation
Impact Intelligence
User & Access Management
Audit & Governance
Notification Services
AI Intelligence Layer
9. MSME REGISTRY PRINCIPLES

The MSME registry acts as:

the system of record
beneficiary intelligence repository
intervention anchor
reporting anchor

The registry must support:

longitudinal tracking
intervention history
assessment history
evidence linkage
programme participation
10. INTERVENTION GOVERNANCE PRINCIPLES

Interventions must support:

lifecycle tracking
milestone tracking
assessment linkage
field verification linkage
outcome tracking
reporting linkage

Intervention stages should remain auditable and historically traceable.

11. ASSESSMENT ENGINE PRINCIPLES

Assessments must support:

configurable templates
scoring
weighted indicators
reviewer workflows
evidence attachment
structured outputs
future AI-assisted interpretation

Assessments are foundational intelligence objects.

12. EVIDENCE MANAGEMENT PRINCIPLES

Evidence must support:

file traceability
role restrictions
audit logging
secure storage
field verification
assessment linkage
intervention linkage

Evidence should never become detached from operational records.

13. IMPACT INTELLIGENCE PRINCIPLES

Impact intelligence should support:

baseline vs follow-up comparison
longitudinal analysis
programme intelligence
sector intelligence
state/regional intelligence
trend analysis
risk identification
portfolio visibility
14. DASHBOARD PRINCIPLES

Dashboards must be:

role-specific
operationally grounded
real-time where possible
filterable
exportable
analytics-driven

Dashboard metrics must derive from structured operational data.

15. REPORTING PRINCIPLES

Reports must:

be evidence-backed
support export
support approval workflows
support versioning
remain reproducible
remain traceable to source data
16. SECURITY PRINCIPLES

The platform must support:

RBAC
secure authentication
secure API access
audit logging
environment separation
encrypted communication
upload validation
data access restrictions
17. GOVERNANCE PRINCIPLES

The platform should support:

operational oversight
auditability
compliance review
approval workflows
change tracking
accountability
18. MIGRATION & DATABASE RULES
18.1 Migrations Must Be Idempotent

Prefer:

add column if not exists

Avoid destructive migrations.

18.2 Backward Compatibility First

Launch-safe behavior is preferred over breaking schema assumptions.

18.3 Never Assume Live DB Equality

Live Supabase schema may drift from local migrations.

All migrations should safely handle:

partial deployments
legacy tables
missing columns
stale environments
18.4 Avoid Hard Failures

Prefer:

graceful fallback behavior
compatibility recovery
soft provisioning

Avoid unnecessary hard redirects.

19. IMPLEMENTATION PRINCIPLES

All future implementation should prioritize:

production readiness
launch safety
graceful fallback behavior
maintainability
observability
auditability
modular architecture
compatibility
operational resilience
20. UI/UX PRINCIPLES

The UI should reflect:

enterprise-grade professionalism
BOI/government readiness
operational simplicity
executive clarity
field usability
MSME accessibility

Interfaces should prioritize:

readability
structured workflows
dashboard-first visibility
minimal operational friction
21. FIELD OPERATIONS PRINCIPLES

Field workflows should support:

offline-capable future architecture
GPS/location capture
evidence uploads
verification checklists
supervision workflows
quality control
assignment management
22. AI IMPLEMENTATION RULES

AI functionality should:

assist users
improve efficiency
summarize intelligence
detect anomalies
draft reports

AI must not:

autonomously approve interventions
alter assessments without review
bypass governance
replace human oversight
23. FUTURE PLATFORM DIRECTION

Future expansion areas may include:

GIS intelligence
predictive analytics
repayment intelligence
portfolio risk scoring
data warehouse integration
Power BI/Tableau integration
API ecosystem
donor reporting portals
advanced monitoring intelligence
national MSME intelligence infrastructure
24. NON-NEGOTIABLE PLATFORM RULES

The following rules are considered architectural invariants:

Internal UUIDs remain canonical.
Public IDs are never primary FKs.
Assessments are intelligence assets.
Evidence remains traceable.
Reports remain evidence-backed.
Audit logging remains enabled.
RBAC remains enforced.
Dashboards derive from operational data.
AI remains assistive.
Backward compatibility is prioritized.
25. FINAL ARCHITECTURAL SUMMARY

DBIN is designed as:

A centralized Development Impact Intelligence Infrastructure
for intervention governance, MSME intelligence,
assessment operations, evidence management,
impact reporting, and institutional decision support.

The platform is intended to operate as:

an operational system,
a monitoring infrastructure,
a governance framework,
and a long-term institutional intelligence asset.