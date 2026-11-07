# STOP KRWOTOKOM SYSTEM

Istniejąca strona publiczna i portal instruktora na GitHub Pages. Właściciel: H-CORE EDU. Interfejs po polsku.

## Konta i centralny rejestr

Implementacja Supabase Auth (potwierdzanie e-mail, logowanie hasłem, reset i odtwarzanie sesji), zatwierdzania kont, administracji oraz trzyletnich autoryzacji.
Role superadministratora są niezależne od autoryzacji instruktorskiej. Numery SK-I-ROK-NNNN nadaje transakcyjnie PostgreSQL, z osobnym licznikiem rocznym i trwałym rejestrem wykorzystanych numerów.
RLS izoluje dane, sprawdzające uprawnienia funkcje SQL zapisują decyzje i audyt, a kolejka e-mail rejestruje próby i ponawia błędy.

**Kod wymaga konfiguracji Supabase i poczty przed uruchomieniem.** Puste wartości konfiguracji blokują formularze; nie ma zastępczego logowania demo.

- [Instrukcja uruchomienia, konto właściciela i pierwszy numer](docs/URUCHOMIENIE_SUPABASE.md)
- [Zakres i wyniki testów](docs/TESTY.md)
- [Plan rozwoju](docs/PLAN_MVP.md)

## Struktura

- index.html, assets/css/style.css, assets/css/public.css — dotychczasowy wygląd i strona publiczna.
- assets/js/app.js — dotychczasowe elementy nawigacji i strony publicznej.
- assets/js/portal.js, admin.js — konta, własny profil, administracja.
- assets/js/config.js — wyłącznie publiczny adres Supabase, klucz publishable/anon i adres polityki prywatności.
- assets/js/vendor/supabase.js — lokalna, przypięta wersja oficjalnego SDK 2.119.0, bez zależności od CDN.
- assets/css/account.css — dodatki dotyczące formularzy i tabel administracyjnych.
- supabase/migrations/ — pełna migracja SQL i polityki dostępu.
- supabase/functions/dispatch-notifications/ — serwerowa wysyłka przez Resend.
- tests/ — testy PostgreSQL WASM, interfejsu i osobnych połączeń PostgreSQL.

## Sprawdzenie lokalne

Node.js 24 i pnpm 11.25.0: pnpm install --frozen-lockfile --ignore-scripts, następnie pnpm test.
Test osobnych połączeń: pnpm test:concurrency, wyłącznie z TEST_DATABASE_URL wskazującym nową jednorazową bazę testową.
Podgląd statyczny: python -m http.server 8765, otwórz http://localhost:8765/.

## Zakres MVP

Konta i autoryzacje są przygotowane do podłączenia usług. Moduły szkoleń, uczestników, certyfikatów, biblioteki i publicznej weryfikacji rejestru nie są uruchomione. Nie prezentują fikcyjnych danych jako prawdziwych.
Brak płatności, opłat za odnowienie, generatora PDF lub QR. Nie zmieniaj DNS stopkrwotokom.org.
Pliki Pages są publiczne: dane osobowe, prywatne materiały i sekrety muszą pozostawać w zabezpieczonym zapleczu.

Zmiany wdrażaj przez osobną gałąź i PR; produkcyjnej main nie zastępuj bez sprawdzenia konfiguracji i pełnej ścieżki e-mail.
