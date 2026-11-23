-- STOP KRWOTOKOM SYSTEM: read-only master view for the central administrator.
-- Run once after 001 and 002. This does NOT grant admin rights to any user.
-- Grant the sole administrator separately in Supabase SQL Editor (not in a public repository).
begin;

create table if not exists public.portal_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.portal_admins enable row level security;

-- No browser may read or edit the administrator allowlist.
revoke all on table public.portal_admins from anon, authenticated;

create or replace function public.portal_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.portal_admins as a
    where a.user_id = (select auth.uid())
  );
$$;
revoke all on function public.portal_is_admin() from public, anon, authenticated;
grant execute on function public.portal_is_admin() to authenticated;

-- Secure central register: personal details returned ONLY to verified administrators.
-- Non-administrators do not get a partial list; they receive an access denied error.
create or replace function public.portal_admin_list_instructors()
returns table (
  instructor_id text,
  display_name text,
  email text,
  enabled boolean,
  valid_until date,
  created_at timestamptz,
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.portal_is_admin() then
    raise exception 'Dostep tylko dla administratora Centrali SKS'
      using errcode = '42501';
  end if;

  return query
    select
      i.instructor_id,
      i.display_name,
      u.email::text,
      i.enabled,
      i.valid_until,
      i.created_at,
      (case
        when not i.enabled then 'inactive'
        when i.valid_until is null then 'pending'
        when i.valid_until < (now() at time zone 'Europe/Warsaw')::date then 'expired'
        else 'active'
      end)::text
    from public.instructor_access as i
    join auth.users as u on u.id = i.user_id
    order by i.created_at desc;
end;
$$;
revoke all on function public.portal_admin_list_instructors() from public, anon, authenticated;
grant execute on function public.portal_admin_list_instructors() to authenticated;

commit;
