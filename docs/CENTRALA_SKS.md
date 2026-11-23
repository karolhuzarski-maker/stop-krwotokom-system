# Centrala SKS — jedyny administrator master view

## Zakres tego wdrożenia
- Istniejący portal instruktora pozostaje pod tym samym adresem i wykorzystuje to samo logowanie Supabase.
- Wyłącznie konto z wpisem w `public.portal_admins` zobaczy zakładkę **Centrala SKS**.
- Tabela `public.portal_admins` dopuszcza **tylko jednego** administratora (ograniczenie `master_slot = 1`, `unique`).
- Centrala pokazuje **rzeczywiste** konta instruktorów: ID, nazwę, e-mail, status i datę ważności. Pokazuje liczbę wszystkich, aktywnych, wymagających uwagi i wygasłych.
- Uprawnienie jest sprawdzane w Supabase za pomocą `portal_is_admin()`. Dostęp do pełnego rejestru gwarantuje dodatkowo funkcja `portal_admin_list_instructors()`, która odrzuca użytkowników bez uprawnień.
- Funkcje szkoleń, ośrodków i certyfikatów są zaplanowane, ale nie są jeszcze podłączone. Nie pokazujemy fikcyjnych statystyk.
- Zarządzanie licencjami pozostaje obecnie w panelu administracyjnym Supabase.

## Uruchomienie w istniejącym projekcie Supabase (raz)
1. W **SQL Editor → New query** uruchom całą migrację `backend/003_centrala_sks.sql`.
2. Nadaj rolę administratora **wyłącznie jednemu wskazanemu kontu**. W prywatnym SQL Editor, nigdy w publicznym repozytorium, uruchom:

```sql
insert into public.portal_admins (user_id)
select id from auth.users
where lower(email) = lower('TUTAJ_EMAIL_WLASCICIELA')
on conflict (user_id) do nothing;
```

3. Zweryfikuj wynik:

```sql
select u.email, a.created_at
from public.portal_admins a
join auth.users u on u.id = a.user_id;
```

4. Odśwież `https://stopkrwotokom-system.pl/#panel/central` (Ctrl+F5), będąc zalogowanym na konto wybranego administratora.

**Nie** włączaj publicznego zapisu do `portal_admins`, nie udostępniaj `service_role` ani sekretów w GitHub Pages. Sama zmiana e-maila w przeglądarce nie nadaje roli.

## Odwołanie uprawnienia
Z konta zarządzającego Supabase:

```sql
delete from public.portal_admins where user_id = 'UUID_KONTA_DO_POZBAWIENIA_ROLI'::uuid;
```

Wyczyszczenie wpisu blokuje odczyt rejestru po stronie serwera. Uprawnienia do zarządzania systemem nie są uzależnione od daty ważności osobistej licencji instruktorskiej.
