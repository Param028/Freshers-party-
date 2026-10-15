create table if not exists public.event_settings (
  setting_key text primary key check (setting_key = 'global'),
  venue text not null default 'TO BE ANNOUNCED'
    check (char_length(trim(venue)) between 1 and 120),
  updated_at timestamptz not null default now()
);

alter table public.event_settings enable row level security;
revoke all on table public.event_settings from anon, authenticated;
grant select, insert, update on table public.event_settings to service_role;

drop trigger if exists event_settings_updated_at on public.event_settings;
create trigger event_settings_updated_at
  before update on public.event_settings
  for each row execute function public.set_updated_at();

insert into public.event_settings (setting_key, venue)
values ('global', 'TO BE ANNOUNCED')
on conflict (setting_key) do nothing;
