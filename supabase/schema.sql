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
  created_by text not null,
  claimed_by text,              -- stays empty until someone successfully claims it
  created_at timestamptz not null default now()
);

create index if not exists members_fest_idx on members (fest_code);
create index if not exists requests_fest_dept_idx on requests (fest_code, department, created_at desc);

-- Lock both tables to the public key. Our server uses the secret service key, which bypasses this.
alter table members enable row level security;
alter table requests enable row level security;
