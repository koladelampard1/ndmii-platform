-- History is written only by the protected database triggers.
revoke all on public.institution_support_history from service_role;
grant select on public.institution_support_history to service_role;
