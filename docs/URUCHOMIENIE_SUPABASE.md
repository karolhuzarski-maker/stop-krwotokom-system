# Uruchomienie kont i centralnego rejestru

Kod korzysta z istniejącego GitHub Pages. Nie wymaga VPS ani zmiany domeny.
Najpierw uruchom i sprawdź projekt testowy Supabase. Po próbach zastosuj tę samą migrację w projekcie produkcyjnym.
Nie podawaj haseł ani tajnych kluczy w rozmowie, publicznych plikach lub opisach PR.

## 1. Supabase i migracja

1. Utwórz projekt Supabase w wybranym regionie UE. Zachowaj dane dostępowe wyłącznie w bezpiecznym miejscu.
2. Otwórz SQL Editor jako właściciel projektu i wykonaj cały plik `supabase/migrations/202611070001_registry.sql`.
   Alternatywnie użyj Supabase CLI: `supabase link --project-ref TWOJ_PROJECT_REF`, następnie `supabase db push`.
   Migracja jest przeznaczona dla nowego rejestru; nie wykonuj jej drugi raz ręcznie.
3. W Auth → Providers → Email włącz logowanie hasłem, rejestrację i **Confirm email**.
4. Włącz **Secure email change** (potwierdzenie na dotychczasowym i nowym adresie). Ustaw minimalną długość hasła na 12.
5. W Auth → URL Configuration ustaw Site URL i dozwolony Redirect URL dokładnie na:
   `https://karolhuzarski-maker.github.io/stop-krwotokom-system/`
   Nie dodawaj szerokich wildcardów ani obcych domen. Dla lokalnych testów możesz dodać dokładny adres localhost; usuń go z produkcji po testach.
6. W Auth skonfiguruj własny SMTP i zweryfikowaną domenę nadawcy. Wiadomości potwierdzania i resetu wysyła Auth, niezależnie od kolejki powiadomień administracyjnych.
   Zachowaj standardowe linki `ConfirmationURL` w szablonach; teksty szablonów ustaw po polsku.
7. Ustaw limity rejestracji/logowania i wysyłki w Auth, a po ocenie ruchu włącz ochronę CAPTCHA (wymaga osobnego podłączenia tokenu w formularzach).

## 2. Publiczna konfiguracja strony

W `assets/js/config.js` wpisz wyłącznie:

```js
window.SK_CONFIG = Object.freeze({
  supabaseUrl: 'https://TWOJ_PROJECT_REF.supabase.co',
  supabasePublishableKey: 'PUBLICZNY_KLUCZ_PUBLISHABLE_LUB_ANON',
  privacyUrl: 'https://TWOJ_ADRES_Z_OPUBLIKOWANA_POLITYKA_PRYWATNOSCI'
});
```

Publiczny klucz publishable/anon jest przeznaczony dla przeglądarki. RLS i funkcje SQL ograniczają jego uprawnienia.
**Nigdy** nie wpisuj tu `service_role`, secret key, hasła bazy, klucza Resend ani sekretu wysyłki.
Rejestracja pozostaje wyłączona do podłączenia polityki prywatności. Jej treść i właściwe informacje o przetwarzaniu danych przygotowuje właściciel H-CORE EDU.
Wersja potwierdzonej polityki to `1`; przy zmianie dokumentu zmień wartość wysyłaną przez formularz i zachowaj poprzednią treść dokumentu.

## 3. Pierwszy superadministrator

1. Na skonfigurowanej stronie zarejestruj własne konto, potwierdź e-mail i odczytaj jego UUID w Supabase → Auth → Users.
2. Sprawdź, że UUID i e-mail wskazują Twoje konto. W SQL Editor wykonaj:

```sql
select private.bootstrap_owner('UUID_TWOJEGO_POTWIERDZONEGO_KONTA'::uuid, false);
```

3. Wyloguj się i zaloguj ponownie. W menu pojawi się **Administracja**.
   Uprawnienia są odczytywane z bazy; zmiana danych użytkownika lub przeglądarki nie przyzna tej roli.
4. Procedura działa tylko raz. Nie ma publicznego przycisku ani endpointu nadania administratora.
   Kolejnych administratorów można konfigurować wyłącznie jako operator Supabase, po sprawdzeniu tożsamości i zapisaniu decyzji w audycie; interfejs MVP nie udostępnia delegowania tej roli.
5. Administrator ma własne konto i niezależną autoryzację. Może odszukać siebie w Administracji i nadać sobie uprawnienia po weryfikacji warunków.
   Imię, nazwisko, e-mail i reset hasła są dostępne w profilu. Panel celowo nie pozwala zawiesić konta superadministratora; chroni to przed utratą dostępu.

### Własny numer SK-I-2027-0001

Numer wynika z **rzeczywistego roku pierwszego nadania w Europe/Warsaw**. Ustawienie daty początku na rok 2027 w roku 2026 nie tworzy numeru z 2027.

Jeżeli administrator został już utworzony bez numeru, **w 2027 roku, przed nadaniem numeru innym instruktorom**, wykonaj jako operator:

```sql
select private.assign_owner_first('UUID_TWOJEGO_KONTA'::uuid, 2027, '2027-01-01'::date);
```

Ustaw faktyczny uzgodniony początek autoryzacji. Procedura wymaga zatwierdzonego superadministratora bez wcześniejszego numeru.
Jeżeli licznik roku lub numer jest już użyty, cała operacja kończy się konfliktem; niczego nie nadpisuje.
Jeśli instalujesz cały system dopiero w 2027, `bootstrap_owner(UUID, true)` jednocześnie tworzy pierwszego administratora i pierwszy numer bieżącego roku.
Nie testuj tej opcji na produkcyjnym koncie w 2026, jeśli chcesz zachować możliwość pierwszego ID z 2027 — nadany numer pozostaje stały.

## 4. Powiadomienia (Resend)

1. Utwórz konto w Resend i zweryfikuj domenę nadawcy (SPF/DKIM). Skonfiguruj nadawcę i adres powiadomień administratora.
2. W Supabase → Edge Functions → Secrets ustaw:
   - `RESEND_API_KEY` — tajny klucz API Resend;
   - `MAIL_FROM` — zweryfikowany nadawca;
   - `ADMIN_NOTIFICATION_EMAIL` — odbiorca wniosków;
   - `PORTAL_URL` — `https://karolhuzarski-maker.github.io/stop-krwotokom-system/`;
   - `DISPATCH_SECRET` — nowy losowy sekret o co najmniej 32 bajtach.
   `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` są dostarczane funkcjom przez środowisko Supabase.
3. Wdróż funkcję z repozytorium: `supabase functions deploy dispatch-notifications`.
   `verify_jwt=false` w konfiguracji jest celowe: endpoint obsługuje wyłącznie wywołania serwerowe i sam porównuje sekret `x-dispatch-secret`.
   Nie wywołuj go z przeglądarki i nie udostępniaj sekretu w JavaScript.
4. W Supabase Vault zapisz sekret `sk_dispatch_secret` o tej samej wartości oraz `sk_dispatch_url`:
   `https://TWOJ_PROJECT_REF.supabase.co/functions/v1/dispatch-notifications`.
   Zrób to w panelu Vault; nie zapisuj wartości w plikach repozytorium ani historii poleceń.
5. Włącz rozszerzenia `pg_cron` i `pg_net` w panelu Supabase. W SQL Editor utwórz zadanie:

```sql
select cron.schedule('sk-notifications', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='sk_dispatch_url'),
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-dispatch-secret',(select decrypted_secret from vault.decrypted_secrets where name='sk_dispatch_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
```

Utwórz zadanie tylko raz. Leasing zabezpiecza nakładanie wywołań, także gdy przetwarzanie partii przekroczy czas oczekiwania pg_net.
Kolejka nie zależy od otwartego panelu. Co minutę przetwarza do 20 zdarzeń, ponawia błędy z rosnącym odstępem i zapisuje próby.
Po potwierdzeniu adresu transakcja tworzy jeden wniosek i jedno zdarzenie. Błąd dostawcy nie usuwa wniosku.
Resend otrzymuje niezmienny klucz idempotencji oparty na UUID zdarzenia. Po 12 nieudanych próbach lub 23 godzinach od pierwszej próby zdarzenie trafia do `review`.
Nie następuje automatyczne ponowienie po wygaśnięciu 24-godzinnego okna idempotencji dostawcy.
Przed ręcznym wznowieniem sprawdź w Resend, czy wiadomość została przyjęta; jeśli tak, uzgodnij status w bazie zamiast wysyłać ponownie.
Historię sprawdzaj w `notification_attempts`; stany w `notification_events`. Panel sygnalizuje błędy i przypadki wymagające sprawdzenia.

## 5. Zasady danych i rozszerzania

- Konto `approved` nie jest autoryzacją. `has_active_authorization()` wymaga zatwierdzonego konta, braku zawieszenia oraz bieżącej daty w okresie `[starts_on, ends_on)` w Warszawie.
- Data końcowa jest wyłączna: autoryzacja od 1 stycznia 2027 do 1 stycznia 2030 działa do końca 31 grudnia 2029. Wygaśnięcie nie wymaga zadania cyklicznego.
- Nadanie i odnowienie ustawiają okres na dokładnie trzy lata, z regułą PostgreSQL dla 29 lutego. Przedłużenie nie zmienia ID.
- Licznik roczny aktualizuje się w transakcji pod blokadą wiersza; UNIQUE chroni numer. Blokada profilu serializuje równoległe operacje tej samej osoby. Nie usuwaj liczników, historii numerów ani autoryzacji.
- Wyjątkowa korekta jest dostępna w szczegółach instruktora, wymaga uzasadnienia i zachowania roku pierwszego nadania. Stary numer pozostaje zastrzeżony. To nie jest sposób przeniesienia numeru między osobami.
- Brak uprawnień UPDATE/INSERT/DELETE dla klientów; zmiany realizują sprawdzające rolę funkcje SQL. RLS izoluje odczyty. Uprawnień nie odczytuje się z edytowalnego `user_metadata`.
- Moduły kursów, uczestników, certyfikatów i plików są wyłączone. Przy ich przyszłym podłączaniu polityki RLS i Storage muszą wywoływać `has_active_authorization()` także dla każdej operacji zapisu i pobrania pliku. Sam widok lub ukryty przycisk nie zabezpiecza danych.
- Publiczna weryfikacja rejestru jest wyłączona. Przyszły endpoint może udostępniać tylko istnienie numeru, status i termin po uzgodnieniu zakresu. Nie przyznawaj roli anon SELECT na profiles.
- Przypomnienia 30/7/0 dni można później dodać do tej samej kolejki, z kluczem `reminder:USER:ENDS_ON:DAYS`. Nie uruchomiono ich w MVP. Nie ma płatności ani opłat za odnowienie.
- Ustaw kopie zapasowe i procedurę odzyskiwania adekwatnie do planu Supabase. Fizyczne usuwanie kont z przypisanym ID jest domyślnie blokowane przez klucze obce; sprawy usunięcia lub anonimizacji danych wymagają osobnej procedury właściciela.

## 6. Sprawdzenie przed scaleniem i uruchomieniem

`pnpm install --frozen-lockfile --ignore-scripts`, następnie `pnpm test`.
Testy lokalne korzystają z PostgreSQL WASM (PGlite) i DOM. GitHub Actions dodatkowo uruchamia test rzeczywistych równoległych transakcji na PostgreSQL 16.
Własne wykonanie testu równoległości wymaga **nowej, jednorazowej bazy testowej** i zmiennej `TEST_DATABASE_URL`, następnie `pnpm test:concurrency`.
Nie wskazuj mu produkcyjnego Supabase. Test tworzy schemat auth i konta syntetyczne.

Przed scaleniem wykonaj na testowym Supabase pełną ścieżkę: rejestracja → potwierdzenie → jeden wniosek → e-mail administratora → akceptacja → autoryzacja → e-mail instruktora → profil po odświeżeniu.
Sprawdź reset hasła z rzeczywistej wiadomości (również w nowej karcie), zmianę e-maila, konto odrzucone/zawieszone, wygasłą autoryzację i telefon.
Dokładny zakres faktycznie wykonanych testów jest w `docs/TESTY.md`.
Dopiero po poprawnej konfiguracji i tych próbach scal PR do `main`. GitHub Pages pozostaje publikowane z dotychczasowej gałęzi i katalogu. Ta zmiana sama nie przełącza produkcji.

Źródła konfiguracji: [Supabase Auth](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [reset hasła](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [harmonogram funkcji](https://supabase.com/docs/guides/functions/schedule-functions), [idempotencja Resend](https://resend.com/changelog/idempotency-keys).
