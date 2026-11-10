# Plan STOP KRWOTOKOM SYSTEM - bez rozbudowy ponad potrzeby

## Etap 1 - prezentacja online
- Publikacja istniejącej strony i demonstracyjnego panelu na GitHub Pages.
- Poprawienie drobnych tekstów i responsywności, bez przebudowy stylistyki.
- Zachowanie nazewnictwa: Kurs STOP KRWOTOKOM SYSTEM, Kurs instruktorski STOP KRWOTOKOM SYSTEM.
- Kafelek „Centra szkoleniowe” otwiera wykaz licencjonowanych ośrodków w nowej karcie.

## Etap 2 - uporządkowanie aplikacji
- Wydzielenie strony publicznej i panelu do oddzielnych tras/widoków, bez duplikowania kodu.
- Uporządkowanie komponentów i usunięcie demonstracyjnych danych przed produkcją.

## Etap 3 - dostęp instruktorów
- Przygotowano Supabase Auth: konta na zaproszenie administratora, potwierdzenie e-maila, własne hasło i odzyskiwanie hasła.
- Bez samodzielnej rejestracji i formularza zgłoszeń. Administrator zaprasza po e-mailu przez Supabase Dashboard i ustawia ważność dostępu.
- Przygotowano własny profil, ID, sprawdzenie dostępu na serwerze i RLS. Do wykonania migracja i konfiguracja według `PODLACZENIE_PORTALU.md`.
- Przygotowano obsługę Turnstile; konieczna konfiguracja w Auth i limity po stronie usługi.
- Role koordynatora i własny panel administratora można dodać po uruchomieniu podstawowego dostępu.
- Jedno konto i stałe ID instruktora; osobno: certyfikacja i autoryzacja.

## Etap 4 - kursy i certyfikaty
- Zapisy kursów i list uczestników.
- Bieżąca ewaluacja wymaganych ćwiczeń kursanta, bez egzaminu końcowego.
- Certyfikaty kursantów z unikalnym tokenem QR; współoznaczenie ośrodka.
- Biblioteka tylko dla autoryzowanych instruktorów, materiały poza publicznym Pages.

## Niezmienne decyzje programowe
- Kurs stacjonarny kontrola krwotoków, także bez apteczki i u dzieci.
- Bez modułu SALT/segregacji wielu poszkodowanych w kursie podstawowym.
- Bez improwizowanych opasek uciskowych.
- Kursanci: ewaluacja bieżąca; instruktorzy: egzamin teoretyczny, praktyczny i dydaktyczny.
- Licencjonowany ośrodek: minimum 2 instruktorów, w tym 1 ratownik medyczny i 1 ratownik KPP; koordynator: ratownik medyczny, autoryzowany instruktor.
