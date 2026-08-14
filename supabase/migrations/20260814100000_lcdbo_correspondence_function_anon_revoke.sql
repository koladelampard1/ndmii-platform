-- LCDBO Correspondence Management function-execution hardening.
-- Additive patch after live UAT preflight found anonymous RPC execution was
-- still permitted by an explicit anon function grant in the target project.
--
-- This does not change correspondence data, counters, RLS policies or the
-- reference-generation algorithm. It only makes the intended function grants
-- explicit for the correspondence helper functions.

revoke all on function public.lcdbo_correspondence_current_app_user_id() from anon;
revoke all on function public.lcdbo_correspondence_has_role(uuid, text[]) from anon;
revoke all on function public.generate_lcdbo_correspondence_reference(text, text, timestamptz) from anon;
revoke all on function public.lcdbo_correspondence_record_event(uuid, text, text, text, text, jsonb) from anon;

revoke all on function public.lcdbo_correspondence_current_app_user_id() from public;
revoke all on function public.lcdbo_correspondence_has_role(uuid, text[]) from public;
revoke all on function public.generate_lcdbo_correspondence_reference(text, text, timestamptz) from public;
revoke all on function public.lcdbo_correspondence_record_event(uuid, text, text, text, text, jsonb) from public;

grant execute on function public.lcdbo_correspondence_current_app_user_id() to authenticated;
grant execute on function public.lcdbo_correspondence_has_role(uuid, text[]) to authenticated;
grant execute on function public.generate_lcdbo_correspondence_reference(text, text, timestamptz) to authenticated;
grant execute on function public.lcdbo_correspondence_record_event(uuid, text, text, text, text, jsonb) to authenticated;
