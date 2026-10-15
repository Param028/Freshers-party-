alter table public.event_contacts
  drop constraint if exists event_contacts_phone_e164_check;

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
