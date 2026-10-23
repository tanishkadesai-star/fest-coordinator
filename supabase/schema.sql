-- Paste this whole file into Supabase > SQL Editor > New query, then click Run. Run it once.

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  fest_code text not null,
  name text not null,
  department text not null,
  is_organiser boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  fest_code text not null,
  department text not null,
  text text not null,
  location text,                -- optional, e.g. "Front row, seat 3"
  created_by text not null,
  claimed_by text,              -- stays empty until someone successfully claims it
  created_at timestamptz not null default now()
);

-- The AI plan the organiser chose to use, so every department head can read their tasks.
create table if not exists fests (
  code text primary key,
  plan jsonb not null,
  plan_input jsonb not null,
  phase int not null default 0,  -- 0 = preparation, 1..days = that day, days + 1 = wrap-up
  report jsonb,                  -- the last AI team report the organiser generated
  created_at timestamptz not null default now()
);

-- Who has taken which plan task, and whether it is done. The primary key means
-- only one person can ever claim a task: a second claim fails.
create table if not exists task_status (
  fest_code text not null,
  task_key text not null,        -- "<department number>-<task number>" in the saved plan
  claimed_by text not null,
  done boolean not null default false,
  claimed_at timestamptz not null default now(),
  done_at timestamptz,
  primary key (fest_code, task_key)
);

-- Everyone gets a private token when they join. It proves who they are for powers that
-- need it: assigning tasks, publishing files, the phase and the team report.
alter table members add column if not exists token text;
alter table members add column if not exists is_head boolean not null default false;

-- Who assigned a task (set when a department head or the organiser gave it to someone).
alter table task_status add column if not exists assigned_by text;

-- Codes the organiser hands out: one for each department head, and one to get back in as organiser.
create table if not exists access_codes (
  code text primary key,
  fest_code text not null,
  role text not null,        -- 'organiser' or 'head'
  department text            -- set for heads
);
create index if not exists access_codes_fest_idx on access_codes (fest_code);

-- Files the organiser and department heads publish (the files themselves live in Storage).
create table if not exists published_files (
  id uuid primary key default gen_random_uuid(),
  fest_code text not null,
  title text not null,
  category text not null,
  audience text not null,     -- 'everyone' or 'department'
  department text,            -- set when audience is 'department'
  uploaded_by text not null,
  uploader_role text not null,
  file_name text not null,
  mime text not null,
  size bigint not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index if not exists published_files_fest_idx on published_files (fest_code, created_at desc);

-- A private Storage bucket for the files (4 MB each, documents and images only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'published', 'published', false, 4194304,
  array[
    'application/pdf','image/png','image/jpeg','image/webp','text/plain','text/csv',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;

create index if not exists members_fest_idx on members (fest_code);
create index if not exists requests_fest_dept_idx on requests (fest_code, department, created_at desc);

-- Lock both tables to the public key. Our server uses the secret service key, which bypasses this.
alter table members enable row level security;
alter table requests enable row level security;
alter table fests enable row level security;
alter table task_status enable row level security;
alter table access_codes enable row level security;
alter table published_files enable row level security;
