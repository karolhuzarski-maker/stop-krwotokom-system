-- STOP KRWOTOKOM SYSTEM — edycja i usuwanie własnych szkoleń.
-- Wykonaj RAZ po 005_training_registry.sql.
-- Nie usuwa danych i nie zmienia uprawnień Centrali SKS.
begin;

-- UPDATE tylko czterech pól formularza; ID i właściciel wpisu są niezmienne.
revoke update on public.sk_courses from authenticated;
grant update (training_date, location_name, participant_count, notes)
  on public.sk_courses to authenticated;

-- DELETE wymaga jawnego potwierdzenia w portalu, a RLS ogranicza właściciela.
grant delete on public.sk_courses to authenticated;

drop policy if exists sk_courses_update_own_active on public.sk_courses;
create policy sk_courses_update_own_active
  on public.sk_courses for update to authenticated
  using (
    instructor_user_id = (select auth.uid())
    and (select public.portal_has_access())
  )
  with check (
    instructor_user_id = (select auth.uid())
    and (select public.portal_has_access())
  );

drop policy if exists sk_courses_delete_own_active on public.sk_courses;
create policy sk_courses_delete_own_active
  on public.sk_courses for delete to authenticated
  using (
    instructor_user_id = (select auth.uid())
    and (select public.portal_has_access())
  );

commit;
