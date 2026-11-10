-- Run once in a NEW, dedicated Supabase project before setting public configuration.
-- Administrator provisions accounts through Supabase Dashboard, not the browser.
begin;

create sequence public.sk_instructor_id_seq;
create table public.instructor_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  instructor_id text not null unique default
    ('SK-I-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.sk_instructor_id_seq')::text, 6, '0')),
  display_name text not null default '',
  enabled boolean not null default false,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint name_length check (char_length(display_name) <= 160)
);
alter table public.instructor_access enable row level security;
revoke all on public.instructor_access from anon, authenticated;
revoke all on sequence public.sk_instructor_id_seq from anon, authenticated;
grant select (user_id, instructor_id, display_name, enabled, valid_until) on public.instructor_access to authenticated;
create policy sk_read_own_access on public.instructor_access
  for select to authenticated using (user_id = (select auth.uid()));
-- No browser INSERT / UPDATE / DELETE policies: instructors cannot grant licences.

create function public.sk_create_invited_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.instructor_access(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.sk_create_invited_profile() from public, anon, authenticated;
create trigger sk_on_auth_user_created after insert on auth.users
  for each row execute function public.sk_create_invited_profile();

create function public.sk_touch_access()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.sk_touch_access() from public, anon, authenticated;
create trigger sk_access_updated before update on public.instructor_access
  for each row execute function public.sk_touch_access();

create function public.portal_has_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.instructor_access
    where user_id = (select auth.uid())
      and enabled = true
      and valid_until >= (now() at time zone 'Europe/Warsaw')::date
  );
$$;
revoke all on function public.portal_has_access() from public, anon;
grant execute on function public.portal_has_access() to authenticated;

-- Only authenticated, licensed instructors may read private materials.
insert into storage.buckets(id, name, public)
values ('instructor-materials', 'instructor-materials', false)
on conflict (id) do update set public = false;
create policy sk_read_private_materials on storage.objects
  for select to authenticated using (
    bucket_id = 'instructor-materials' and (select public.portal_has_access())
  );
-- Uploads and account/permission changes remain administrator-only.
commit;
