-- Reusable operating structure for finance institutions and the first
-- evidence-led configuration for Amaanah Finance Company.

alter table public.institution_agent_profiles
  add column delivery_type text;

update public.institution_agent_profiles
set delivery_type = case
  when bdsp_organisation_id is null then 'internal_officer'
  else 'external_agent'
end
where delivery_type is null;

alter table public.institution_agent_profiles
  alter column delivery_type set not null,
  alter column delivery_type set default 'external_agent',
  add constraint institution_agent_profiles_delivery_type_check
    check (delivery_type in ('internal_officer','external_agent'));

create index institution_agent_profiles_delivery_idx
  on public.institution_agent_profiles(institution_id, delivery_type);

create table public.institution_implementation_owners (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  owner_key text not null check (owner_key ~ '^[a-z0-9_]{3,60}$'),
  owner_label text not null check (length(btrim(owner_label)) between 3 and 120),
  organisation_name text not null check (length(btrim(organisation_name)) between 2 and 160),
  named_owner text,
  owner_email text,
  status text not null default 'pending_nomination'
    check (status in ('pending_nomination','nominated','confirmed')),
  decision_rights text not null check (length(btrim(decision_rights)) between 10 and 1000),
  updated_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, owner_key),
  check ((status = 'pending_nomination' and named_owner is null and owner_email is null)
    or (status in ('nominated','confirmed') and named_owner is not null)),
  check (owner_email is null or owner_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

create index institution_implementation_owners_scope_idx
  on public.institution_implementation_owners(institution_id, status, owner_key);

alter table public.institution_implementation_owners enable row level security;
revoke all on public.institution_implementation_owners from public, anon, authenticated;
grant select, insert, update, delete on public.institution_implementation_owners to service_role;

alter table public.institution_onboarding_projects
  add column expected_internal_officers integer not null default 0
    check (expected_internal_officers between 0 and 100000),
  add column expected_external_agents integer not null default 0
    check (expected_external_agents between 0 and 100000),
  add column volume_basis text not null default 'pending_confirmation'
    check (volume_basis in ('pending_confirmation','planning_assumption','institution_confirmed'));

alter table public.institution_finance_templates
  add column product_code text,
  add column product_category text,
  add column finance_structures text[] not null default '{}'::text[],
  add column source_url text,
  add column configuration_status text not null default 'institution_confirmed'
    check (configuration_status in ('dbin_draft','institution_confirmed','retired')),
  add constraint institution_finance_templates_product_code_check
    check (product_code is null or product_code ~ '^[a-z0-9_]{2,60}$'),
  add constraint institution_finance_templates_product_category_check
    check (product_category is null or product_category in ('working_capital','project_finance','asset_finance','other')),
  add constraint institution_finance_templates_source_url_check
    check (source_url is null or source_url ~ '^https://');

create index institution_finance_templates_product_idx
  on public.institution_finance_templates(institution_id, product_code, active, version desc)
  where product_code is not null;

create trigger set_institution_implementation_owners_updated_at
before update on public.institution_implementation_owners
for each row execute function public.set_platform_foundation_updated_at();

with amaanah as (
  select id from public.institutions where slug = 'amaanah-finance'
)
update public.institution_operating_profiles p
set logo_url = '/brands/amaanah-finance-logo.svg',
    primary_color = '#006B3F',
    accent_color = '#D6A62E',
    agent_label_singular = 'Business Support Officer',
    agent_label_plural = 'Business Support Officers',
    business_label_singular = 'MSME',
    business_label_plural = 'MSMEs',
    diagnostic_label = 'Enterprise and Shariah assessment',
    finance_label = 'Ethical financing readiness',
    support_label = 'Enterprise partnership support',
    updated_at = now()
from amaanah a
where p.institution_id = a.id;

with amaanah as (
  select id from public.institutions where slug = 'amaanah-finance'
)
update public.institution_onboarding_projects p
set programme_owner = 'Amaanah Center for Entrepreneurship Opportunities (functional owner; named lead pending)',
    technical_owner = 'DBIN Platform Operations (named lead pending)',
    expected_agents = 0,
    expected_internal_officers = 0,
    expected_external_agents = 0,
    expected_businesses = 0,
    volume_basis = 'pending_confirmation',
    updated_at = now()
from amaanah a
where p.institution_id = a.id;

insert into public.institution_implementation_owners (
  institution_id, owner_key, owner_label, organisation_name, status, decision_rights
)
select a.id, v.owner_key, v.owner_label, v.organisation_name, 'pending_nomination', v.decision_rights
from (select id from public.institutions where slug = 'amaanah-finance') a
cross join (values
  ('executive_sponsor','Executive sponsor','Amaanah Finance Company','Authorises the implementation mandate, resolves executive escalations and approves production activation.'),
  ('programme_owner','Enterprise programme owner','Amaanah Center for Entrepreneurship Opportunities','Owns MSME mobilisation, enterprise-development delivery, partner performance and programme outcomes.'),
  ('financing_operations','Financing operations owner','Amaanah Finance Company','Owns product eligibility, case review, financing decisions, handover and portfolio follow-through.'),
  ('shariah_compliance','Shariah and compliance approver','Amaanah Finance Company','Approves Shariah screening rules, product structures, exceptions and compliance evidence.'),
  ('external_partner_manager','External partner manager','Amaanah Center for Entrepreneurship Opportunities','Approves external partners, assigns agent capacity and monitors service quality.'),
  ('technical_owner','Platform technical owner','DBIN Platform Operations','Owns tenant configuration, security, releases, service continuity and technical support.')
) as v(owner_key, owner_label, organisation_name, decision_rights)
on conflict (institution_id, owner_key) do update
set owner_label = excluded.owner_label,
    organisation_name = excluded.organisation_name,
    decision_rights = excluded.decision_rights,
    updated_at = now();

insert into public.institution_finance_templates (
  institution_id, name, version, requirements, active,
  product_code, product_category, finance_structures, source_url, configuration_status
)
select a.id, v.name, 1, v.requirements, true,
  v.product_code, v.product_category, v.finance_structures, v.source_url, 'dbin_draft'
from (select id from public.institutions where slug = 'amaanah-finance') a
cross join (values
  (
    'Amaanah Midi-Boost — MSME working-capital readiness',
    'amaanah_midi_boost',
    'working_capital',
    array['Murabaha','Wakalah','Mudarabah']::text[],
    'https://amaanahfinance.com/msme-financing/',
    '[
      {"key":"business_identity","label":"Business identity and ownership","description":"DBIN business profile, registration evidence where applicable, authorised representatives and beneficial ownership details.","required":true},
      {"key":"identity_checks","label":"Promoter identity checks","description":"BVN and NIN evidence for the authorised business representative, subject to Amaanah verification procedures.","required":true},
      {"key":"operating_history","label":"Proven operating history","description":"Evidence that the enterprise is established and operating, consistent with Amaanah Midi-Boost public eligibility.","required":true},
      {"key":"working_capital_plan","label":"Working-capital use plan","description":"Itemised need for inventory, payroll, marketing or other operating expenditure and the expected business effect.","required":true},
      {"key":"cash_flow_evidence","label":"Cash-flow and transaction evidence","description":"Bank statements, sales records or management accounts sufficient for Amaanah to assess financing capacity; the period remains subject to institution confirmation.","required":true},
      {"key":"supplier_evidence","label":"Supplier quotations or purchase schedule","description":"Evidence supporting inventory or operating inputs where the selected financing structure requires an identifiable transaction.","required":true},
      {"key":"shariah_screen","label":"Shariah eligibility declaration","description":"Business activity and proposed use of funds screened against Amaanah''s approved Shariah criteria.","required":true},
      {"key":"repayment_capacity","label":"Repayment or profit-sharing capacity","description":"Forecast showing the enterprise can meet the agreed payment or profit-sharing obligation under the selected structure.","required":true},
      {"key":"group_evidence","label":"Union or cooperative authority","description":"Constitution, registration, resolution and member schedule when an organised union or cooperative applies.","required":false},
      {"key":"data_consent","label":"Verification and data-processing consent","description":"Recorded consent for identity, business and financial verification through the DBIN journey.","required":true}
    ]'::jsonb
  ),
  (
    'Amaanah ProBiz — project and early-business readiness',
    'amaanah_probiz',
    'project_finance',
    array['Mudarabah']::text[],
    'https://amaanahfinance.com/project-financing/',
    '[
      {"key":"promoter_identity","label":"Promoter identity and ownership","description":"DBIN profile, BVN/NIN evidence, ownership details and registration evidence where applicable.","required":true},
      {"key":"business_plan","label":"Viable business or project plan","description":"Clear proposition, customers, operating model, route to market and execution plan for the proposed venture or expansion.","required":true},
      {"key":"project_cost","label":"Detailed project cost schedule","description":"Itemised cost, supplier basis and amount required, consistent with Amaanah''s project-specific funding approach.","required":true},
      {"key":"milestones","label":"Execution milestones","description":"Dated delivery milestones, responsibilities and evidence points from financing through revenue generation.","required":true},
      {"key":"commercial_model","label":"Revenue and profit model","description":"Assumptions, projected revenue, costs, cash flow and proposed basis for profit sharing.","required":true},
      {"key":"promoter_capability","label":"Promoter capability","description":"Relevant experience, team capacity and delivery evidence for the proposed project.","required":true},
      {"key":"shariah_screen","label":"Shariah-compliant project screen","description":"Evidence that the project, sector, contracts and intended use are within Amaanah''s approved Shariah criteria.","required":true},
      {"key":"risk_plan","label":"Project risk and mitigation plan","description":"Principal execution, market, supplier and operational risks with named mitigations.","required":true},
      {"key":"data_consent","label":"Verification and data-processing consent","description":"Recorded consent for identity, business and financial verification through the DBIN journey.","required":true}
    ]'::jsonb
  ),
  (
    'Amaanah Business Asset Finance — acquisition readiness',
    'amaanah_business_asset_finance',
    'asset_finance',
    array['Murabaha']::text[],
    'https://amaanahfinance.com/faqs/',
    '[
      {"key":"business_identity","label":"Business and promoter identity","description":"DBIN business profile, registration evidence where applicable, BVN/NIN and authorised representative details.","required":true},
      {"key":"asset_specification","label":"Asset specification and business need","description":"The asset, intended use, operational benefit and link to the enterprise''s revenue-generating activity.","required":true},
      {"key":"supplier_quote","label":"Supplier quotation or pro-forma invoice","description":"Current supplier evidence identifying the asset and transaction value for Amaanah''s assessment.","required":true},
      {"key":"repayment_evidence","label":"Evidence of repayment capability","description":"Steady income, cash-flow records or other evidence consistent with Amaanah''s published asset-finance eligibility.","required":true},
      {"key":"transaction_structure","label":"Proposed transaction structure","description":"Cost, disclosed profit basis, payment plan and any customer contribution; final terms remain an Amaanah decision.","required":true},
      {"key":"asset_controls","label":"Asset control requirements","description":"Insurance, inspection, ownership and perfection requirements to be confirmed by Amaanah for the specific asset.","required":true},
      {"key":"shariah_screen","label":"Shariah eligibility declaration","description":"Asset, supplier and intended use screened against Amaanah''s approved Shariah criteria.","required":true},
      {"key":"data_consent","label":"Verification and data-processing consent","description":"Recorded consent for identity, business and financial verification through the DBIN journey.","required":true}
    ]'::jsonb
  )
) as v(name, product_code, product_category, finance_structures, source_url, requirements)
on conflict (institution_id, name, version) do update
set requirements = excluded.requirements,
    active = excluded.active,
    product_code = excluded.product_code,
    product_category = excluded.product_category,
    finance_structures = excluded.finance_structures,
    source_url = excluded.source_url,
    configuration_status = excluded.configuration_status;

insert into public.institution_onboarding_checks (institution_id, check_key, category, label, required)
select a.id, v.check_key, v.category, v.label, true
from (select id from public.institutions where slug = 'amaanah-finance') a
cross join (values
  ('internal_external_roles_approved','people','Internal officer and external-agent boundaries approved'),
  ('product_requirements_approved','configuration','Product requirement packs approved by Financing Operations and Shariah Compliance'),
  ('implementation_owners_confirmed','governance','All implementation owners named and confirmed'),
  ('initial_volume_confirmed','operations','Initial MSME volume and internal/external staffing capacity confirmed')
) as v(check_key, category, label)
on conflict (institution_id, check_key) do update
set label = excluded.label, required = true, updated_at = now();
