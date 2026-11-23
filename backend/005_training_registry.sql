-- STOP KRWOTOKOM SYSTEM — SKS: minimalny rejestr szkoleń.
-- Jednorazowo wykonaj w Supabase SQL Editor PO 003_centrala_sks.sql.
-- Bez danych osobowych uczestników: tylko data, miejsce, liczba i uwagi.
-- Dostęp do zapisu: wyłącznie aktywny instruktor, do własnego konta.
-- Centrala SKS widzi wszystkie szkolenia i nazwiska instruktorów.
begin;

create table if not exists public.sk_courses (
  id uuid primary key default gen_random_uuid(),
  instructor_user_id uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  training_date date not null,
  location_name text not null
    constraint sk_courses_location check (char_length(btrim(location_name)) between 2 and 140),
  participant_count integer not null
    constraint sk_courses_participants check (participant_count between 1 and 1000),
  notes text not null default ''
    constraint sk_courses_notes_length check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists sk_courses_owner_date_idx
  on public.sk_courses (instructor_user_id, training_date desc, created_at desc);
create index if not exists sk_courses_date_idx
  on public.sk_courses (training_date desc, created_at desc);

alter table public.sk_courses enable row level security;

revoke all on public.sk_courses from public, anon, authenticated;
grant select, insert on public.sk_courses to authenticated;

drop policy if exists sk_courses_select_own_or_admin on public.sk_courses;
create policy sk_courses_select_own_or_admin
  on public.sk_courses for select to authenticated
  using (
    instructor_user_id = (select auth.uid())
    or (select public.portal_is_admin())
  );

drop policy if exists sk_courses_insert_own_active on public.sk_courses;
create policy sk_courses_insert_own_active
  on public.sk_courses for insert to authenticated
  with check (
    instructor_user_id = (select auth.uid())
    and (select public.portal_has_access())
  );

-- Brak polityk UPDATE/DELETE; instruktor nie moze sam zmieniac historii.
-- Dane wszystkich instruktorow dla Centrali udostepnia tylko kontrolowana funkcja.
create or replace function public.portal_admin_list_courses()
returns table (
  id uuid,
  instructor_id text,
  display_name text,
  training_date date,
  location_name text,
  participant_count integer,
  notes text,
  created_at timestamptz
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
    select c.id, i.instructor_id, i.display_name, c.training_date,
      c.location_name, c.participant_count, c.notes, c.created_at
    from public.sk_courses as c
    join public.instructor_access as i on i.user_id = c.instructor_user_id
    order by c.training_date desc, c.created_at desc;
end;
$$;
revoke all on function public.portal_admin_list_courses() from public, anon, authenticated;
grant execute on function public.portal_admin_list_courses() to authenticated;

commit;
