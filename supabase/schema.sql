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

create index if not exists members_fest_idx on members (fest_code);
create index if not exists requests_fest_dept_idx on requests (fest_code, department, created_at desc);

-- Lock both tables to the public key. Our server uses the secret service key, which bypasses this.
alter table members enable row level security;
alter table requests enable row level security;
alter table fests enable row level security;
alter table task_status enable row level security;
