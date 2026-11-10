# Konta na zaproszenie — instrukcja podłączenia

Stan: 10.11.2026. Kod przygotowany; Supabase, poczta i CAPTCHA jeszcze niepodłączone. Strona obecnie nie przyjmuje haseł. Nie wysłano zaproszeń.

## Jak to będzie działać

Instruktor podaje organizatorowi e-mail. Organizator zaprasza go w Supabase Dashboard, uzupełnia nazwę i ważność uprawnień. Instruktor otwiera otrzymany link i ustawia własne hasło. Nie ma publicznej rejestracji ani formularza wniosków. Panel Supabase służy na początek jako panel administratora; nie edytujesz kodu dla każdego konta.

## 1. Projekt i baza

1. Utwórz nowy, dedykowany projekt Supabase w odpowiednim regionie UE.
2. Przed zapraszaniem użytkowników wykonaj w SQL Editor plik `backend/001_invite_only_access.sql`. To transakcyjna migracja do jednorazowego wykonania w nowym projekcie. Najpierw sprawdź ją w projekcie testowym.
3. Powstają: tabela `instructor_access`, generator stałego ID, RLS, funkcja `portal_has_access` i prywatny bucket `instructor-materials`.

Nowy użytkownik ma `enabled = false`; brak daty ważności także blokuje dostęp. Instruktor może odczytać tylko własny profil. Nie może zmieniać ID, daty ani flagi aktywacji. Pełnych materiałów PDF i danych uczestników nie umieszczaj w publicznym repozytorium.

## 2. Auth i poczta

W ustawieniach Auth projektu:

1. Wyłącz **Allow new users to sign up**. Nie włączaj kont anonimowych. Używamy zaproszenia administratora, e-maila i hasła.
2. Site URL ustaw na `https://karolhuzarski-maker.github.io/stop-krwotokom-system/konto.html`. Zaproszenia z Dashboard wrócą na stronę ustawienia hasła.
3. Ten sam dokładny adres dodaj do dozwolonych przekierowań Auth. Nie dodawaj szerokich wzorców `*` w produkcji.
4. Ustaw minimum 12 znaków hasła również w Auth. Ustaw serwerowe limity prób logowania i wysyłania wiadomości.
5. Podłącz własnego nadawcę SMTP. Dane SMTP wpisujesz w Supabase, nigdy w repozytorium. SPF/DKIM i ewentualny DMARC ustaw według instrukcji dostawcy poczty.
6. Przetestuj polskie wiadomości zaproszenia i resetu. Szablony muszą zachować poprawny link `ConfirmationURL`, a powrót prowadzić do `konto.html`.

Przy zaproszeniu przez API można podać `redirectTo` w `inviteUserByEmail`, ale takie wywołanie wymaga zaufanego serwera. Obecna wersja używa Dashboard, bez klucza administratora w przeglądarce.

## 3. Publiczna konfiguracja strony

W `assets/js/portal-config.js` uzupełnij:

```js
window.SK_PORTAL_CONFIG = Object.freeze({
  supabaseUrl: 'https://IDENTYFIKATOR-PROJEKTU.supabase.co',
  publishableKey: 'sb_publishable_TUTAJ_PUBLICZNY_KLUCZ',
  turnstileSiteKey: ''
});
```

Użyj aktualnego klucza **publishable**. Kod odrzuca klucze secret/service_role i stare JWT anon. URL projektu i publishable key są publiczne; dostęp chroni RLS i funkcja serwerowa, nie ukrycie klucza lub przycisku.

Po publikacji konfiguracji pojawi się prawdziwe logowanie i własny profil z ID oraz ważnością. Operacje na kursach i certyfikatach nadal wymagają osobnego zaplecza.

## 4. Ochrona „jestem człowiekiem”

Przygotowano Cloudflare Turnstile zgodnie z integracją CAPTCHA w Supabase Auth.

1. Utwórz widget dla hosta `karolhuzarski-maker.github.io`. Ścieżka repozytorium nie jest częścią hosta.
2. Włącz CAPTCHA w Supabase Auth, wybierz Turnstile i tam zapisz **sekretny** klucz Turnstile.
3. Do `turnstileSiteKey` wpisz wyłącznie **publiczny sitekey**.
4. Uruchom obie strony integracji razem. Sprawdź logowanie i reset hasła bez tokenu, z poprawnym i z wygasłym tokenem.

Turnstile dobiera sposób potwierdzenia; nie zawsze pokazuje checkbox. Token formularza weryfikuje usługa Auth. Przyszły formularz zapisów wymaga własnej weryfikacji serwerowej i limitów.

## 5. Dodawanie i odbieranie dostępu

1. Dashboard → Authentication → Users → Add user → Invite user. Podaj e-mail. Instruktor sam ustawi hasło po otrzymaniu linku.
2. W Table Editor → `instructor_access` znajdź wiersz z UUID zaproszonego użytkownika. E-mail jest widoczny w Authentication → Users.
3. Uzupełnij `display_name`, ustaw `enabled = true` i `valid_until` zgodnie z zatwierdzoną umową/regulaminem. ID jest generowane automatycznie i pozostaje stałe przy odnowieniu.
4. Dostęp odbierasz przez `enabled = false`; odnawiasz przez datę `valid_until`. Wskazany dzień jest ważny do końca dnia w Warszawie.

Materiały są autoryzowane przy żądaniu do prywatnego magazynu. Jeśli później użyjemy podpisanych linków, ich ważność musi być krótka: wydany link działa do wygaśnięcia, pobranego pliku nie można zdalnie odebrać.

## 6. Próba przed udostępnieniem

- Dwa zaproszone konta widzą wyłącznie własne profile; nieznany adres nie może się sam zarejestrować.
- Brak sesji nie daje odczytu profili ani prywatnych plików. Próby zmiany `enabled`, ID i daty przez API użytkownika są odrzucane.
- Konto wyłączone lub z wczorajszą datą nie pobiera materiału; konto z dzisiejszą datą działa do końca dnia w Warszawie.
- Cofnięcie uprawnień jest skuteczne także w już otwartej sesji przy nowym żądaniu do bazy/magazynu.
- Zaproszenie, wygasły link, ustawienie hasła, wylogowanie, reset i Turnstile działają na komputerze i telefonie.
- Poczta rzeczywiście dociera z własnego nadawcy. Przed zbieraniem danych opublikuj właściwą informację o prywatności i ustal zasady obsługi danych.

Nie wykonano tych testów integracyjnych bez projektu Supabase i poczty. Testy repozytorium imitują odpowiedzi Auth; SQL/RLS wymaga sprawdzenia w rzeczywistej bazie.

## Kolejny etap

Przygotowane są **konta, własny profil i ważność uprawnień**. Do pełnego portalu potrzebne są tabele kursów/uczestników z RLS, zapis ćwiczeń, serwerowe certyfikaty i QR, rejestr weryfikacji oraz ślad zmian. Biblioteka ma przygotowany prywatny magazyn; interfejs pobierania plików pozostaje do podłączenia. Zapisy i płatności nie działają.

Przy własnej domenie zaktualizuj razem: publikację/DNS, Site URL i redirect Auth, host Turnstile, canonical/OG oraz sitemap. Obecna zmiana nie zmienia DNS.

## Dokumentacja

- Supabase: [konfiguracja Auth](https://supabase.com/docs/guides/auth/general-configuration), [zaproszenia](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- Cloudflare: [Turnstile](https://developers.cloudflare.com/turnstile/).
