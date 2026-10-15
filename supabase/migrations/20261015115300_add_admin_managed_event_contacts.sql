create table if not exists public.event_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 60),
  role text not null check (char_length(trim(role)) between 2 and 60),
  phone text not null check (phone ~ '^[+][1-9][0-9]{7,14}$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint event_contacts_contact_unique unique (name, role, phone)
);

alter table public.event_contacts enable row level security;
revoke all on table public.event_contacts from anon, authenticated;
grant select, insert, update, delete on table public.event_contacts to service_role;

insert into public.event_contacts (name, role, phone, sort_order)
values
  ('Aarav Mehta', 'EVENT LEAD', '+919876543210', 10),
  ('Sana Kapoor', 'STAGE & VIBES', '+919123456789', 20)
on conflict (name, role, phone) do nothing;
