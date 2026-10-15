create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.contestant_registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 2 and 60),
  roll_number text not null check (char_length(trim(roll_number)) between 1 and 40),
  category text not null check (category in ('Mr Freshers', 'Miss Freshers')),
  year text not null check (year = '2nd year'),
  phone text not null check (char_length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10),
  consent boolean not null default false check (consent = true),
  status text not null default 'new' check (status in ('new', 'shortlisted', 'confirmed', 'rejected')),
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.performance_registrations (
  id uuid primary key default gen_random_uuid(),
  performance_name text not null check (char_length(trim(performance_name)) between 2 and 60),
  lead_name text not null check (char_length(trim(lead_name)) between 2 and 60),
  phone text not null check (char_length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10),
  member_count integer not null check (member_count between 1 and 15),
  member_names text not null default '',
  performance_type text not null,
  duration integer not null check (duration between 1 and 5),
  description text not null default '' check (char_length(description) <= 200),
  needs text not null default '',
  lead_branch_year text not null,
  consent boolean not null default false check (consent = true),
  status text not null default 'new' check (status in ('new', 'shortlisted', 'confirmed', 'rejected')),
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contestant_registrations_created_at_idx on public.contestant_registrations (created_at desc);
create index if not exists contestant_registrations_status_idx on public.contestant_registrations (status);
create index if not exists performance_registrations_created_at_idx on public.performance_registrations (created_at desc);
create index if not exists performance_registrations_status_idx on public.performance_registrations (status);

drop trigger if exists contestant_registrations_updated_at on public.contestant_registrations;
create trigger contestant_registrations_updated_at before update on public.contestant_registrations for each row execute function public.set_updated_at();
drop trigger if exists performance_registrations_updated_at on public.performance_registrations;
create trigger performance_registrations_updated_at before update on public.performance_registrations for each row execute function public.set_updated_at();

alter table public.contestant_registrations enable row level security;
alter table public.performance_registrations enable row level security;
