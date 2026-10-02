-- =====================================================================
-- Surplus Funds Recovery OS — Supabase schema (Postgres DDL)
--
-- HOW TO APPLY: paste this file into the Supabase SQL editor and run it.
-- It is idempotent for the storage bucket (ON CONFLICT DO NOTHING); for
-- tables it assumes a fresh project (run once).
--
-- SECURITY POSTURE:
--   * Row Level Security is ENABLED on all six tables with NO permissive
--     policies. That is deny-by-default: anon and authenticated keys can
--     read/write NOTHING. No `FOR ALL ... USING (true)` policies exist by
--     design.
--   * All access goes through Next.js API routes using the service_role key,
--     which bypasses RLS.
--   * The service_role key is SERVER-SIDE ONLY. Never expose it to the
--     browser, never ship it in client JS, never commit it to the repo.
--   * The case-documents storage bucket is private, and explicit deny-public
--     policies (USING (false)) on storage.objects keep anon/authenticated
--     roles out of every storage operation on that bucket.
-- =====================================================================

-- -----------------------------
-- Cases
-- -----------------------------
create table cases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'new',
  county text,
  state text,
  surplus_amount numeric,
  notes text,
  source text,               -- NOTE: addition beyond base spec; records the
                             -- lead-digest source for provenance tracking
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------
-- Claimants
-- -----------------------------
create table claimants (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  full_name text not null,
  contact_info text,
  id_expiry_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- -----------------------------
-- Properties
-- -----------------------------
create table properties (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  parcel_id text,
  address text,
  county text,
  state text,
  tax_sale_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- -----------------------------
-- Tasks
-- -----------------------------
create table tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  notes text,                -- NOTE: addition beyond base spec; holds outreach
                             -- draft bodies and other task detail text
  created_at timestamptz not null default now()
);

-- -----------------------------
-- Documents
-- -----------------------------
create table documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  expiry_date date,
  uploaded_at timestamptz not null default now()
);

-- -----------------------------
-- Audit log (append-only from the app)
-- -----------------------------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text,
  detail text,
  created_at timestamptz not null default now()
);

-- -----------------------------
-- Row Level Security: deny-by-default on all six tables.
-- Enabled with NO permissive policies; API routes use service_role.
-- -----------------------------
alter table cases     enable row level security;
alter table claimants enable row level security;
alter table properties enable row level security;
alter table tasks      enable row level security;
alter table documents enable row level security;
alter table audit_log enable row level security;

-- -----------------------------
-- updated_at trigger on cases
-- -----------------------------
create or replace function set_cases_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_cases_updated_at on cases;
create trigger trg_cases_updated_at
  before update on cases
  for each row
  execute function set_cases_updated_at();

-- -----------------------------
-- Private storage bucket for case documents
-- -----------------------------
insert into storage.buckets (id, name, public)
values ('case-documents', 'case-documents', false)
on conflict (id) do nothing;

-- Explicit deny-public policies on storage.objects for the private bucket.
-- USING (false) means anon and authenticated roles can do nothing here;
-- service_role bypasses RLS and is the only key the app uses.
create policy case_documents_deny_select_anon
  on storage.objects for select to anon
  using (bucket_id = 'case-documents' and false);

create policy case_documents_deny_select_auth
  on storage.objects for select to authenticated
  using (bucket_id = 'case-documents' and false);

create policy case_documents_deny_insert_anon
  on storage.objects for insert to anon
  with check (bucket_id = 'case-documents' and false);

create policy case_documents_deny_insert_auth
  on storage.objects for insert to authenticated
  with check (bucket_id = 'case-documents' and false);

create policy case_documents_deny_update_anon
  on storage.objects for update to anon
  using (bucket_id = 'case-documents' and false)
  with check (bucket_id = 'case-documents' and false);

create policy case_documents_deny_update_auth
  on storage.objects for update to authenticated
  using (bucket_id = 'case-documents' and false)
  with check (bucket_id = 'case-documents' and false);

create policy case_documents_deny_delete_anon
  on storage.objects for delete to anon
  using (bucket_id = 'case-documents' and false);

create policy case_documents_deny_delete_auth
  on storage.objects for delete to authenticated
  using (bucket_id = 'case-documents' and false);

-- -----------------------------
-- Indexes
-- -----------------------------
create index if not exists idx_cases_status on cases(status);
create index if not exists idx_tasks_case_done_due on tasks(case_id, done, due_date);
create index if not exists idx_documents_case_expiry on documents(case_id, expiry_date);
create index if not exists idx_claimants_case on claimants(case_id);
create index if not exists idx_properties_case_parcel on properties(case_id, parcel_id);
create index if not exists idx_audit_log_created on audit_log(created_at);
