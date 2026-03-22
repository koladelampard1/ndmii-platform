insert into tax_profiles (msme_id, tax_category, vat_applicable, estimated_monthly_obligation, outstanding_amount, compliance_status)
select id,
  case when sector in ('Manufacturing','Agro-processing') then 'SME_PRODUCTION' else 'SME_STANDARD' end,
  true,
  85000 + (row_number() over()) * 1500,
  22000 + (row_number() over()) * 500,
  case when verification_status = 'verified' then 'compliant' else 'pending' end
from msmes
on conflict (msme_id) do nothing;

update compliance_profiles cp
set overall_status = case when m.verification_status = 'verified' then 'verified' else 'pending' end,
    nin_status = case when m.verification_status = 'verified' then 'verified' else 'pending' end,
    bvn_status = case when m.verification_status = 'verified' then 'verified' else 'pending' end,
    cac_status = case when m.verification_status = 'verified' then 'verified' else 'pending' end,
    tin_status = case when m.verification_status = 'verified' then 'verified' else 'pending' end
from msmes m
where cp.msme_id = m.id;

update payments
set receipt_reference = 'RCP-SEED-' || lpad(row_number() over(order by created_at)::text, 4, '0')
where receipt_reference is null;

insert into activity_logs (action, entity_type, entity_id, metadata)
select 'workflow_seed', 'tax_profile', tp.id, jsonb_build_object('status', tp.compliance_status)
from tax_profiles tp
limit 10;
