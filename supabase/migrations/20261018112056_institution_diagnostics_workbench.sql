-- Institution-owned diagnostic records. No direct browser access to these tables.
create table public.institution_diagnostic_templates (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id),
 name text not null check (length(name) between 3 and 120), version integer not null default 1,
 questions jsonb not null check (jsonb_typeof(questions) = 'array'), active boolean not null default true,
 created_by_user_id uuid references public.users(id), created_at timestamptz not null default now(),
 unique(id,institution_id), unique(institution_id,name,version)
);
create table public.institution_diagnostic_cases (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id),
 engagement_id uuid not null, template_id uuid not null, agent_member_id uuid not null,
 questions jsonb not null, answers jsonb not null default '{}'::jsonb, findings text not null default '',
 actions jsonb not null default '[]'::jsonb,
 status text not null default 'draft' check (status in ('draft','awaiting_agreement','agreed','submitted','returned','approved')),
 owner_agreed_at timestamptz, submitted_at timestamptz, reviewed_at timestamptz,
 review_reason text, next_action text, reviewed_by_user_id uuid references public.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,institution_id), unique(institution_id,engagement_id),
 foreign key (engagement_id,institution_id) references public.institution_engagements(id,institution_id),
 foreign key (template_id,institution_id) references public.institution_diagnostic_templates(id,institution_id),
 foreign key (agent_member_id,institution_id) references public.institution_members(id,institution_id),
 check (jsonb_typeof(questions)='array' and jsonb_typeof(answers)='object' and jsonb_typeof(actions)='array')
);
create index institution_diagnostic_cases_queue_idx on public.institution_diagnostic_cases(institution_id,agent_member_id,status,updated_at desc);
create table public.institution_diagnostic_activities (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null, case_id uuid not null,
 kind text not null check(kind in ('mentorship','training','document_review','market_linkage','other')),
 summary text not null check(length(summary) between 3 and 2000), occurred_at timestamptz not null,
 created_by_user_id uuid references public.users(id), created_at timestamptz not null default now(),
 unique(id,institution_id,case_id),
 foreign key(case_id,institution_id) references public.institution_diagnostic_cases(id,institution_id) on delete cascade
);
create table public.institution_diagnostic_evidence (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null, case_id uuid not null,
 activity_id uuid, storage_path text not null unique, file_name text not null,
 mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg')),
 byte_size integer not null check(byte_size between 1 and 10485760),
 uploaded_by_user_id uuid references public.users(id), created_at timestamptz not null default now(),
 foreign key(case_id,institution_id) references public.institution_diagnostic_cases(id,institution_id) on delete cascade,
 foreign key(activity_id,institution_id,case_id) references public.institution_diagnostic_activities(id,institution_id,case_id)
);
create index institution_diagnostic_activities_case_idx on public.institution_diagnostic_activities(institution_id,case_id,occurred_at desc);
create index institution_diagnostic_evidence_case_idx on public.institution_diagnostic_evidence(institution_id,case_id);
alter table public.institution_diagnostic_templates enable row level security;
alter table public.institution_diagnostic_cases enable row level security;
alter table public.institution_diagnostic_activities enable row level security;
alter table public.institution_diagnostic_evidence enable row level security;
revoke all on public.institution_diagnostic_templates, public.institution_diagnostic_cases, public.institution_diagnostic_activities, public.institution_diagnostic_evidence from public, anon, authenticated;
grant select,insert,update,delete on public.institution_diagnostic_templates, public.institution_diagnostic_cases, public.institution_diagnostic_activities, public.institution_diagnostic_evidence to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('institution-diagnostic-evidence','institution-diagnostic-evidence',false,10485760,array['application/pdf','image/png','image/jpeg'])
 on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
