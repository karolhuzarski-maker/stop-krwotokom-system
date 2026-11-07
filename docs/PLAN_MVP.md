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
- Supabase Auth: potwierdzenie adresu, logowanie hasłem i bezpieczny reset.
- MVP: status konta, niezależna rola superadmin i niezależna autoryzacja instruktora; role ośrodków w przyszłości.
- Zatwierdzanie autoryzacji przez administratora; bezpieczna autoryzacja na serwerze i polityki RLS.
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

## Implementacja kont i autoryzacji (listopad 2026)
Kod etapu 3 przygotowany na osobnej gałęzi. Uruchomienie wymaga Supabase, SMTP, Resend, konfiguracji kolejki i prób odbiorczych opisanych w URUCHOMIENIE_SUPABASE.md. Moduły etapu 4 pozostają wyłączone.
