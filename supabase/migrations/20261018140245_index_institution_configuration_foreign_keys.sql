create index institution_operating_profiles_updater_idx
  on public.institution_operating_profiles(updated_by_user_id) where updated_by_user_id is not null;
create index institution_support_templates_updater_idx
  on public.institution_support_templates(updated_by_user_id) where updated_by_user_id is not null;
create index institution_report_exports_requester_idx
  on public.institution_report_exports(requested_by_user_id) where requested_by_user_id is not null;
