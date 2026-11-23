-- Migration after the initial invite-only schema and yearly SKS counter have been installed.
-- Instructor IDs are unique, immutable, and scoped by registration year: SKS-I-YYYY-NNN.
-- Never call sk_next_instructor_id() manually to test it: that would consume a number.
begin;

create or replace function public.sk_next_instructor_id()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_year integer;
  v_number bigint;
begin
  v_year := extract(year from (now() at time zone 'Europe/Warsaw'))::integer;

  insert into public.sk_instructor_year_counter(id_year, last_number)
  values (v_year, 1)
  on conflict (id_year)
  do update set last_number = public.sk_instructor_year_counter.last_number + 1
  returning last_number into v_number;

  if v_number > 999 then
    raise exception 'Limit 999 numerow instruktorow SKS w roku % zostal wyczerpany.', v_year;
  end if;

  return 'SKS-I-' || v_year::text || '-' || lpad(v_number::text, 3, '0');
end;
$$;

revoke all on function public.sk_next_instructor_id() from public, anon, authenticated;

alter table public.instructor_access
  alter column instructor_id
  set default public.sk_next_instructor_id();

commit;
