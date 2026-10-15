alter table public.event_contacts
  drop constraint if exists event_contacts_phone_check;

alter table public.event_contacts
  drop constraint if exists event_contacts_phone_e164_check;

create or replace function public.normalize_event_contact_phone(input_phone text)
returns text
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  formatted text;
  compact text;
begin
  if input_phone is null or char_length(input_phone) > 25 then
    return null;
  end if;

  formatted := btrim(input_phone);
  if formatted = '' or not (
    formatted ~ '^[+]?[0-9]+$'
    or formatted ~ '^[+]?[0-9]+( [0-9]+)+$'
    or formatted ~ '^[+]?[0-9]+(-[0-9]+)+$'
    or formatted ~ '^[+]?[0-9]+([.][0-9]+)+$'
    or formatted ~ '^[+]?[0-9]+ ?[(][0-9]{1,6}[)]( [0-9]+)+$'
    or formatted ~ '^[+]?[0-9]+ ?[(][0-9]{1,6}[)](-[0-9]+)+$'
    or formatted ~ '^[+]?[0-9]+ ?[(][0-9]{1,6}[)]([.][0-9]+)+$'
  ) then
    return null;
  end if;

  compact := regexp_replace(formatted, '[ .()-]', '', 'g');
  if compact ~ '^[+][1-9][0-9]{7,14}$' then
    return compact;
  elsif compact ~ '^00[1-9][0-9]{7,14}$' then
    return '+' || substring(compact from 3);
  elsif compact ~ '^[6-9][0-9]{9}$' then
    return '+91' || compact;
  elsif compact ~ '^91[6-9][0-9]{9}$' then
    return '+' || compact;
  end if;

  return null;
end;
$$;

revoke all on function public.normalize_event_contact_phone(text) from public, anon, authenticated;
grant execute on function public.normalize_event_contact_phone(text) to service_role;

with normalized as (
  select id, public.normalize_event_contact_phone(phone) as phone_e164
  from public.event_contacts
)
update public.event_contacts as contacts
set phone = normalized.phone_e164
from normalized
where contacts.id = normalized.id
  and normalized.phone_e164 is not null
  and contacts.phone !~ '^[+][1-9][0-9]{7,14}$';

do $$
begin
  if exists (
    select 1
    from public.event_contacts
    where phone !~ '^[+][1-9][0-9]{7,14}$'
  ) then
    raise exception 'Some crew phone numbers need organizer review before E.164 validation can be enabled.';
  end if;
end
$$;

alter table public.event_contacts
  add constraint event_contacts_phone_e164_check
  check (phone ~ '^[+][1-9][0-9]{7,14}$');
