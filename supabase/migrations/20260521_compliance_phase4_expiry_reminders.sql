-- Compliance Phase 4: expiry automation, reminder scheduling, notification
-- queueing, and reusable compliance profile recalculation.

create extension if not exists "pgcrypto";

alter type public.compliance_event_type add value if not exists 'reminder_scheduled';
alter type public.compliance_event_type add value if not exists 'reminder_sent';
alter type public.compliance_event_type add value if not exists 'reminder_failed';
alter type public.compliance_event_type add value if not exists 'notification_queued';
alter type public.compliance_event_type add value if not exists 'notification_failed';
alter type public.compliance_event_type add value if not exists 'profile_recalculated';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_reminder_type') then
    create type public.compliance_reminder_type as enum (
      'expiry_90',
      'expiry_60',
      'expiry_30',
      'expiry_7',
      'expiry_today',
      'overdue_7',
      'overdue_30'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_reminder_status') then
    create type public.compliance_reminder_status as enum (
      'pending',
      'sent',
      'failed',
      'cancelled'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_notification_channel') then
    create type public.compliance_notification_channel as enum (
      'in_app',
      'email'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_notification_status') then
    create type public.compliance_notification_status as enum (
      'queued',
      'sent',
      'failed',
      'read'
    );
  end if;
end $$;

create table if not exists public.compliance_reminders (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references public.msmes(id) on delete cascade,
  compliance_item_id uuid not null references public.msme_compliance_items(id) on delete cascade,
  requirement_id uuid not null references public.compliance_requirement_definitions(id) on delete restrict,
  reminder_type public.compliance_reminder_type not null,
  scheduled_for date not null,
  status public.compliance_reminder_status not null default 'pending',
  sent_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_reminders_unique_item_type unique (compliance_item_id, reminder_type)
);

create table if not exists public.compliance_notifications (
  id uuid primary key default gen_random_uuid(),
  msme_id uuid not null references public.msmes(id) on delete cascade,
  recipient_user_id uuid references public.users(id) on delete set null,
  compliance_item_id uuid references public.msme_compliance_items(id) on delete cascade,
  channel public.compliance_notification_channel not null default 'in_app',
  template_key text not null,
  subject text,
  body text,
  status public.compliance_notification_status not null default 'queued',
  sent_at timestamptz,
  read_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists compliance_reminders_due_idx
  on public.compliance_reminders(status, scheduled_for);
create index if not exists compliance_reminders_msme_idx
  on public.compliance_reminders(msme_id, scheduled_for desc);
create index if not exists compliance_reminders_item_idx
  on public.compliance_reminders(compliance_item_id);
create index if not exists compliance_notifications_msme_idx
  on public.compliance_notifications(msme_id, created_at desc);
create index if not exists compliance_notifications_recipient_idx
  on public.compliance_notifications(recipient_user_id, status, created_at desc);
create index if not exists compliance_notifications_item_idx
  on public.compliance_notifications(compliance_item_id);

create or replace function public.set_compliance_reminder_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_compliance_reminders_updated_at on public.compliance_reminders;
create trigger trg_compliance_reminders_updated_at
before update on public.compliance_reminders
for each row
execute function public.set_compliance_reminder_updated_at();

create or replace function public.set_compliance_notification_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_compliance_notifications_updated_at on public.compliance_notifications;
create trigger trg_compliance_notifications_updated_at
before update on public.compliance_notifications
for each row
execute function public.set_compliance_notification_updated_at();

create or replace function public.compliance_transition_allowed(from_status text, to_status text)
returns boolean
language sql
immutable
as $$
  select (from_status, to_status) in (
    ('not_started', 'submitted'),
    ('draft', 'submitted'),
    ('submitted', 'under_review'),
    ('resubmitted', 'under_review'),
    ('under_review', 'approved'),
    ('under_review', 'rejected'),
    ('under_review', 'changes_requested'),
    ('changes_requested', 'resubmitted'),
    ('rejected', 'resubmitted'),
    ('approved', 'under_review'),
    ('rejected', 'under_review'),
    ('changes_requested', 'under_review'),
    ('approved', 'expiring_soon'),
    ('approved', 'expired'),
    ('expiring_soon', 'expired'),
    ('expiring_soon', 'under_review'),
    ('expired', 'under_review')
  );
$$;

create or replace function public.compliance_lagos_current_date()
returns date
language sql
stable
as $$
  select (now() at time zone 'Africa/Lagos')::date;
$$;

create or replace function public.recalculate_msme_compliance_profile(target_msme_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  metrics record;
  computed_score integer;
  computed_status public.compliance_item_status;
  computed_risk text;
begin
  select
    count(*) filter (where item.is_required)::integer as total_required,
    count(*) filter (where item.is_required and item.status in ('approved', 'expiring_soon'))::integer as approved_required,
    count(*) filter (where item.status in ('submitted', 'resubmitted'))::integer as submitted_count,
    count(*) filter (where item.status = 'under_review')::integer as under_review_count,
    count(*) filter (where item.status = 'changes_requested')::integer as changes_requested_count,
    count(*) filter (where item.status = 'rejected')::integer as rejected_count,
    count(*) filter (where item.status = 'expired')::integer as expired_count,
    count(*) filter (where item.status = 'expiring_soon')::integer as expiring_soon_count,
    count(*) filter (where item.status = 'suspended')::integer as suspended_count,
    count(*) filter (where item.status = 'revoked')::integer as revoked_count,
    max(item.submitted_at) as last_submitted_at,
    max(coalesce(item.approved_at, item.rejected_at, item.suspended_at, item.revoked_at, item.updated_at)) as last_reviewed_at,
    min(item.expires_at) filter (
      where item.status in ('approved', 'expiring_soon', 'expired')
        and item.expires_at is not null
    )::timestamptz as next_deadline
  into metrics
  from public.msme_compliance_items item
  where item.msme_id = target_msme_id;

  computed_score := case
    when coalesce(metrics.total_required, 0) = 0 then 0
    else greatest(
      0,
      least(
        100,
        round((coalesce(metrics.approved_required, 0)::numeric / nullif(metrics.total_required, 0)::numeric) * 100)::integer
        - (coalesce(metrics.expired_count, 0) * 20)
        - (coalesce(metrics.rejected_count, 0) * 10)
        - ((coalesce(metrics.suspended_count, 0) + coalesce(metrics.revoked_count, 0)) * 25)
      )
    )
  end;

  computed_status := case
    when coalesce(metrics.revoked_count, 0) > 0 then 'revoked'::public.compliance_item_status
    when coalesce(metrics.suspended_count, 0) > 0 then 'suspended'::public.compliance_item_status
    when coalesce(metrics.expired_count, 0) > 0 then 'expired'::public.compliance_item_status
    when coalesce(metrics.rejected_count, 0) > 0 then 'rejected'::public.compliance_item_status
    when coalesce(metrics.changes_requested_count, 0) > 0 then 'changes_requested'::public.compliance_item_status
    when coalesce(metrics.under_review_count, 0) > 0 or coalesce(metrics.submitted_count, 0) > 0 then 'under_review'::public.compliance_item_status
    when coalesce(metrics.expiring_soon_count, 0) > 0 then 'expiring_soon'::public.compliance_item_status
    when coalesce(metrics.total_required, 0) > 0 and coalesce(metrics.approved_required, 0) = coalesce(metrics.total_required, 0) then 'approved'::public.compliance_item_status
    else 'not_started'::public.compliance_item_status
  end;

  computed_risk := case
    when coalesce(metrics.revoked_count, 0) > 0
      or coalesce(metrics.suspended_count, 0) > 0
      or coalesce(metrics.expired_count, 0) > 0 then 'critical'
    when coalesce(metrics.rejected_count, 0) > 0
      or coalesce(metrics.changes_requested_count, 0) > 0 then 'high'
    when computed_score < 70
      or coalesce(metrics.expiring_soon_count, 0) > 0
      or coalesce(metrics.under_review_count, 0) > 0
      or coalesce(metrics.submitted_count, 0) > 0 then 'medium'
    else 'low'
  end;

  insert into public.msme_compliance_profiles (
    msme_id,
    overall_status,
    compliance_score,
    risk_level,
    total_required_count,
    approved_count,
    pending_count,
    under_review_count,
    changes_requested_count,
    rejected_count,
    expired_count,
    expiring_soon_count,
    suspended_count,
    revoked_count,
    last_submitted_at,
    last_reviewed_at,
    next_deadline_at,
    last_recalculated_at,
    metadata,
    created_at,
    updated_at
  )
  values (
    target_msme_id,
    computed_status,
    computed_score,
    computed_risk,
    coalesce(metrics.total_required, 0),
    coalesce(metrics.approved_required, 0),
    coalesce(metrics.submitted_count, 0),
    coalesce(metrics.under_review_count, 0),
    coalesce(metrics.changes_requested_count, 0),
    coalesce(metrics.rejected_count, 0),
    coalesce(metrics.expired_count, 0),
    coalesce(metrics.expiring_soon_count, 0),
    coalesce(metrics.suspended_count, 0),
    coalesce(metrics.revoked_count, 0),
    metrics.last_submitted_at,
    metrics.last_reviewed_at,
    metrics.next_deadline,
    now(),
    jsonb_build_object(
      'phase', 'phase4',
      'source', 'recalculate_msme_compliance_profile',
      'total_required', coalesce(metrics.total_required, 0),
      'approved_required', coalesce(metrics.approved_required, 0),
      'submitted_count', coalesce(metrics.submitted_count, 0),
      'under_review_count', coalesce(metrics.under_review_count, 0),
      'changes_requested_count', coalesce(metrics.changes_requested_count, 0),
      'rejected_count', coalesce(metrics.rejected_count, 0),
      'expired_count', coalesce(metrics.expired_count, 0),
      'expiring_soon_count', coalesce(metrics.expiring_soon_count, 0),
      'suspended_count', coalesce(metrics.suspended_count, 0),
      'revoked_count', coalesce(metrics.revoked_count, 0),
      'next_deadline', metrics.next_deadline
    ),
    now(),
    now()
  )
  on conflict (msme_id) do update
  set overall_status = excluded.overall_status,
      compliance_score = excluded.compliance_score,
      risk_level = excluded.risk_level,
      total_required_count = excluded.total_required_count,
      approved_count = excluded.approved_count,
      pending_count = excluded.pending_count,
      under_review_count = excluded.under_review_count,
      changes_requested_count = excluded.changes_requested_count,
      rejected_count = excluded.rejected_count,
      expired_count = excluded.expired_count,
      expiring_soon_count = excluded.expiring_soon_count,
      suspended_count = excluded.suspended_count,
      revoked_count = excluded.revoked_count,
      last_submitted_at = excluded.last_submitted_at,
      last_reviewed_at = excluded.last_reviewed_at,
      next_deadline_at = excluded.next_deadline_at,
      last_recalculated_at = excluded.last_recalculated_at,
      metadata = coalesce(public.msme_compliance_profiles.metadata, '{}'::jsonb) || excluded.metadata,
      updated_at = now();

  insert into public.compliance_events (
    msme_id,
    event_type,
    actor_type,
    actor_role,
    to_status,
    summary,
    metadata
  )
  values (
    target_msme_id,
    'profile_recalculated',
    'system',
    'expiry_reminder_engine',
    computed_status::text,
    'Compliance profile recalculated.',
    jsonb_build_object('phase', 'phase4', 'compliance_score', computed_score, 'risk_level', computed_risk)
  );
end;
$$;

create or replace function public.schedule_compliance_reminders(item_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  scheduled_count integer := 0;
  schedule_row record;
begin
  select
    i.id,
    i.msme_id,
    i.requirement_id,
    i.regulator_id,
    i.status,
    i.expires_at,
    req.renewal_window_days
  into item
  from public.msme_compliance_items i
  join public.compliance_requirement_definitions req on req.id = i.requirement_id
  where i.id = item_id;

  if item.id is null then
    return 0;
  end if;

  if item.expires_at is null or item.status not in ('approved', 'expiring_soon', 'expired') then
    update public.compliance_reminders
    set status = 'cancelled',
        metadata = metadata || jsonb_build_object('cancelled_reason', 'item_not_active_for_reminders', 'phase', 'phase4')
    where compliance_item_id = item.id
      and status = 'pending';
    return 0;
  end if;

  for schedule_row in
    select *
    from (values
      ('expiry_90'::public.compliance_reminder_type, item.expires_at - 90),
      ('expiry_60'::public.compliance_reminder_type, item.expires_at - 60),
      ('expiry_30'::public.compliance_reminder_type, item.expires_at - 30),
      ('expiry_7'::public.compliance_reminder_type, item.expires_at - 7),
      ('expiry_today'::public.compliance_reminder_type, item.expires_at),
      ('overdue_7'::public.compliance_reminder_type, item.expires_at + 7),
      ('overdue_30'::public.compliance_reminder_type, item.expires_at + 30)
    ) as schedule(reminder_type, scheduled_for)
  loop
    insert into public.compliance_reminders (
      msme_id,
      compliance_item_id,
      requirement_id,
      reminder_type,
      scheduled_for,
      status,
      metadata
    )
    values (
      item.msme_id,
      item.id,
      item.requirement_id,
      schedule_row.reminder_type,
      schedule_row.scheduled_for,
      'pending',
      jsonb_build_object('phase', 'phase4', 'expires_at', item.expires_at)
    )
    on conflict (compliance_item_id, reminder_type) do update
    set scheduled_for = excluded.scheduled_for,
        status = case
          when public.compliance_reminders.status = 'cancelled' then 'pending'::public.compliance_reminder_status
          else public.compliance_reminders.status
        end,
        metadata = public.compliance_reminders.metadata || excluded.metadata,
        updated_at = now()
    where public.compliance_reminders.status in ('pending', 'cancelled');

    scheduled_count := scheduled_count + 1;
  end loop;

  insert into public.compliance_events (
    msme_id,
    compliance_item_id,
    regulator_id,
    event_type,
    actor_type,
    actor_role,
    to_status,
    summary,
    metadata
  )
  values (
    item.msme_id,
    item.id,
    item.regulator_id,
    'reminder_scheduled',
    'system',
    'expiry_reminder_engine',
    item.status::text,
    'Compliance expiry reminders scheduled.',
    jsonb_build_object('phase', 'phase4', 'scheduled_count', scheduled_count, 'expires_at', item.expires_at)
  );

  return scheduled_count;
end;
$$;

create or replace function public.queue_compliance_notification(
  p_msme_id uuid,
  p_recipient_user_id uuid default null,
  p_compliance_item_id uuid default null,
  p_channel public.compliance_notification_channel default 'in_app',
  p_template_key text default 'compliance.reminder',
  p_subject text default null,
  p_body text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_id uuid;
  resolved_recipient uuid;
  item_regulator_id uuid;
begin
  if p_msme_id is null then
    raise exception 'MSME id is required' using errcode = '23502';
  end if;

  select coalesce(p_recipient_user_id, m.created_by)
  into resolved_recipient
  from public.msmes m
  where m.id = p_msme_id;

  if p_compliance_item_id is not null then
    select regulator_id
    into item_regulator_id
    from public.msme_compliance_items
    where id = p_compliance_item_id
      and msme_id = p_msme_id;
  end if;

  insert into public.compliance_notifications (
    msme_id,
    recipient_user_id,
    compliance_item_id,
    channel,
    template_key,
    subject,
    body,
    status,
    metadata
  )
  values (
    p_msme_id,
    resolved_recipient,
    p_compliance_item_id,
    coalesce(p_channel, 'in_app'),
    coalesce(nullif(p_template_key, ''), 'compliance.reminder'),
    p_subject,
    p_body,
    'queued',
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('phase', 'phase4')
  )
  returning id into notification_id;

  insert into public.compliance_events (
    msme_id,
    compliance_item_id,
    regulator_id,
    event_type,
    actor_type,
    actor_role,
    summary,
    metadata
  )
  values (
    p_msme_id,
    p_compliance_item_id,
    item_regulator_id,
    'notification_queued',
    'system',
    'expiry_reminder_engine',
    'Compliance notification queued.',
    jsonb_build_object('phase', 'phase4', 'notification_id', notification_id, 'channel', coalesce(p_channel, 'in_app'), 'template_key', coalesce(nullif(p_template_key, ''), 'compliance.reminder'))
  );

  return notification_id;
exception
  when others then
    insert into public.compliance_events (
      msme_id,
      compliance_item_id,
      event_type,
      actor_type,
      actor_role,
      summary,
      metadata
    )
    values (
      p_msme_id,
      p_compliance_item_id,
      'notification_failed',
      'system',
      'expiry_reminder_engine',
      'Compliance notification queueing failed.',
      jsonb_build_object('phase', 'phase4', 'sqlstate', sqlstate, 'message', sqlerrm)
    );
    raise;
end;
$$;

create or replace function public.run_compliance_expiry_job()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  lagos_today date := public.compliance_lagos_current_date();
  item record;
  next_status public.compliance_item_status;
  processed_count integer := 0;
  affected_msmes uuid[] := '{}';
begin
  for item in
    select
      i.id,
      i.msme_id,
      i.requirement_id,
      i.regulator_id,
      i.status,
      i.expires_at,
      req.renewal_window_days
    from public.msme_compliance_items i
    join public.compliance_requirement_definitions req on req.id = i.requirement_id
    where i.expires_at is not null
      and i.status not in ('revoked', 'suspended', 'waived', 'archived', 'rejected', 'changes_requested')
      and (
        i.status = 'approved'
        or i.status = 'expiring_soon'
        or i.status = 'expired'
      )
  loop
    next_status := case
      when item.expires_at <= lagos_today then 'expired'::public.compliance_item_status
      when item.expires_at <= lagos_today + greatest(coalesce(item.renewal_window_days, 30), 0) then 'expiring_soon'::public.compliance_item_status
      else item.status
    end;

    perform public.schedule_compliance_reminders(item.id);

    if next_status is distinct from item.status then
      update public.msme_compliance_items
      set previous_status = item.status,
          status = next_status,
          updated_at = now()
      where id = item.id;

      insert into public.compliance_events (
        msme_id,
        compliance_item_id,
        regulator_id,
        event_type,
        actor_type,
        actor_role,
        from_status,
        to_status,
        summary,
        metadata
      )
      values (
        item.msme_id,
        item.id,
        item.regulator_id,
        next_status::text::public.compliance_event_type,
        'system',
        'expiry_reminder_engine',
        item.status::text,
        next_status::text,
        case
          when next_status = 'expired' then 'Compliance item expired.'
          else 'Compliance item is expiring soon.'
        end,
        jsonb_build_object('phase', 'phase4', 'expires_at', item.expires_at, 'lagos_current_date', lagos_today)
      );

      processed_count := processed_count + 1;
      affected_msmes := array_append(affected_msmes, item.msme_id);
    end if;
  end loop;

  for item in
    select distinct unnest(affected_msmes) as msme_id
  loop
    perform public.recalculate_msme_compliance_profile(item.msme_id);
  end loop;

  return processed_count;
end;
$$;

create or replace function public.process_due_compliance_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  lagos_today date := public.compliance_lagos_current_date();
  reminder record;
  notification_id uuid;
  processed_count integer := 0;
begin
  for reminder in
    select
      r.id,
      r.msme_id,
      r.compliance_item_id,
      r.requirement_id,
      r.reminder_type,
      r.scheduled_for,
      i.regulator_id,
      i.expires_at,
      i.status as item_status,
      req.title as requirement_title,
      m.created_by as recipient_user_id
    from public.compliance_reminders r
    join public.msme_compliance_items i on i.id = r.compliance_item_id
    join public.compliance_requirement_definitions req on req.id = r.requirement_id
    join public.msmes m on m.id = r.msme_id
    where r.status = 'pending'
      and r.scheduled_for <= lagos_today
    order by r.scheduled_for asc, r.created_at asc
    limit 100
  loop
    begin
      if reminder.item_status not in ('approved', 'expiring_soon', 'expired') then
        update public.compliance_reminders
        set status = 'cancelled',
            metadata = metadata || jsonb_build_object('cancelled_reason', 'item_not_active_for_reminders', 'phase', 'phase4')
        where id = reminder.id;
        continue;
      end if;

      notification_id := public.queue_compliance_notification(
        reminder.msme_id,
        reminder.recipient_user_id,
        reminder.compliance_item_id,
        'in_app',
        'compliance.' || reminder.reminder_type::text,
        case
          when reminder.reminder_type::text like 'overdue_%' then 'Compliance renewal overdue'
          when reminder.reminder_type = 'expiry_today' then 'Compliance item expires today'
          else 'Compliance item renewal reminder'
        end,
        format(
          '%s is due for renewal. Expiry date: %s.',
          coalesce(reminder.requirement_title, 'Compliance item'),
          reminder.expires_at
        ),
        jsonb_build_object(
          'reminder_id', reminder.id,
          'reminder_type', reminder.reminder_type,
          'scheduled_for', reminder.scheduled_for,
          'expires_at', reminder.expires_at
        )
      );

      update public.compliance_reminders
      set status = 'sent',
          sent_at = now(),
          metadata = metadata || jsonb_build_object('notification_id', notification_id, 'phase', 'phase4')
      where id = reminder.id;

      insert into public.compliance_events (
        msme_id,
        compliance_item_id,
        regulator_id,
        event_type,
        actor_type,
        actor_role,
        to_status,
        summary,
        metadata
      )
      values (
        reminder.msme_id,
        reminder.compliance_item_id,
        reminder.regulator_id,
        'reminder_sent',
        'system',
        'expiry_reminder_engine',
        reminder.item_status::text,
        'Compliance reminder processed.',
        jsonb_build_object('phase', 'phase4', 'reminder_id', reminder.id, 'reminder_type', reminder.reminder_type, 'notification_id', notification_id)
      );

      processed_count := processed_count + 1;
    exception
      when others then
        update public.compliance_reminders
        set status = 'failed',
            failed_at = now(),
            failure_reason = sqlerrm,
            metadata = metadata || jsonb_build_object('phase', 'phase4', 'sqlstate', sqlstate)
        where id = reminder.id;

        insert into public.compliance_events (
          msme_id,
          compliance_item_id,
          regulator_id,
          event_type,
          actor_type,
          actor_role,
          to_status,
          summary,
          metadata
        )
        values (
          reminder.msme_id,
          reminder.compliance_item_id,
          reminder.regulator_id,
          'reminder_failed',
          'system',
          'expiry_reminder_engine',
          reminder.item_status::text,
          'Compliance reminder processing failed.',
          jsonb_build_object('phase', 'phase4', 'reminder_id', reminder.id, 'reminder_type', reminder.reminder_type, 'sqlstate', sqlstate, 'message', sqlerrm)
        );
    end;
  end loop;

  return processed_count;
end;
$$;

alter table public.compliance_reminders enable row level security;
alter table public.compliance_notifications enable row level security;

drop policy if exists "Compliance reminders scoped read" on public.compliance_reminders;
create policy "Compliance reminders scoped read"
on public.compliance_reminders
for select
using (
  public.compliance_owns_msme(msme_id)
  or public.compliance_can_read_all()
  or exists (
    select 1
    from public.msme_compliance_items item
    where item.id = compliance_reminders.compliance_item_id
      and public.compliance_can_access_regulator_queue(item.regulator_id)
  )
);

drop policy if exists "Compliance notifications scoped read" on public.compliance_notifications;
create policy "Compliance notifications scoped read"
on public.compliance_notifications
for select
using (
  public.compliance_owns_msme(msme_id)
  or recipient_user_id = public.compliance_current_app_user_id()
  or public.compliance_can_read_all()
  or exists (
    select 1
    from public.msme_compliance_items item
    where item.id = compliance_notifications.compliance_item_id
      and public.compliance_can_access_regulator_queue(item.regulator_id)
  )
);

drop policy if exists "Compliance notifications recipient update read status" on public.compliance_notifications;
create policy "Compliance notifications recipient update read status"
on public.compliance_notifications
for update
using (
  recipient_user_id = public.compliance_current_app_user_id()
  or public.compliance_can_read_all()
)
with check (
  recipient_user_id = public.compliance_current_app_user_id()
  or public.compliance_can_read_all()
);
