# Wyniki weryfikacji — 7 listopada 2026

## Wykonano lokalnie

- Migracja SQL wykonana na PostgreSQL WASM (PGlite), z syntetycznym schematem Supabase Auth.
- Profil, pojedynczy wniosek i zdarzenie po potwierdzeniu adresu; brak profilu przed potwierdzeniem.
- Niedopuszczenie roli i statusu z edytowalnych metadanych rejestracji.
- Bootstrap administratora, ochrona przed powtórzeniem i procedura pierwszego numeru właściciela.
- Oddzielenie akceptacji konta od autoryzacji; brak numeru po samej akceptacji.
- Nadanie numeru z rokiem bieżącym, trzy lata, 29 lutego, idempotentne ponowienie identycznego nadania.
- Numer pozostaje po odnowieniu, zawieszeniu i wygaśnięciu. Termin jest sprawdzany bez zadania cyklicznego.
- RLS: użytkownik widzi tylko własny profil i autoryzację; nie czyta audytu innych osób.
- Brak uprawnień anon, brak bezpośredniego UPDATE statusu/numeru i brak dostępu do procedur operatora lub wysyłki.
- Korekta z audytem i trwała rezerwacja starego numeru; odrzucenie ponownego użycia.
- Kolejka: brak podwójnego pobrania, leasing, błąd, ponowienie, sukces i odrzucenie starego leasingu; stare niejednoznaczne wysyłki kierowane do sprawdzenia.
- Edycja własnych danych nie nadaje roli, statusu ani numeru.
- Testy DOM: formularze, routing, własny profil, brak obejścia loginDemo, brak danych demonstracyjnych, bezpieczne wyświetlenie tekstu HTML, odczyt sesji z makiety klienta.
- Chrome: publiczna strona, formularze logowania i rejestracji, ponowne załadowanie trasy rejestracji. Brak błędów konsoli w sprawdzonych widokach.
- Chrome: formularz rejestracji przy szerokości 390 px, bez poziomego przepełnienia. Zachowano dotychczasowy układ mobilny portalu.
- Dotychczasowe pliki style.css, public.css, obrazy i logo nie są zmieniane.

## Weryfikacja równoległości

Test tests/concurrency.integration.mjs uruchamia dwa niezależne połączenia PostgreSQL, wymusza oczekiwanie drugiej transakcji na licznik i sprawdza różne numery, ponowne nadanie tej samej osobie oraz rollback numeru przy nieudanym zapisie autoryzacji.
Lokalnie nie było serwera PostgreSQL: ten test został jawnie pominięty. Następnie został rzeczywiście wykonany na PostgreSQL 16 w GitHub Actions i zakończył się powodzeniem, podobnie jak wszystkie 16 testów lokalnych. Zweryfikowano osobne połączenia, oczekiwanie na blokadę licznika, różne numery, ponowienie dla tej samej osoby i atomowy rollback. Wynik: https://github.com/karolhuzarski-maker/stop-krwotokom-system/actions/runs/42416178833 (success). Testy PGlite nie są traktowane jako zastępstwo testu dwóch połączeń.

## Wymaga konfiguracji i prób odbiorczych

Nie wykonano rejestracji na żywym Supabase, rzeczywistego potwierdzenia e-mail, dostarczenia wiadomości administratorowi/instruktorowi, resetu z prawdziwego linku, zmiany adresu z potwierdzeniem ani odtworzenia produkcyjnej sesji po odświeżeniu.
Nie uruchomiono migracji w produkcji, funkcji Edge ani harmonogramu. Nie zmieniono main i nie opublikowano zmian na produkcyjnym Pages.
Przed scaleniem należy wykonać pełny proces odbiorczy z URUCHOMIENIE_SUPABASE.md. Obecne testy nie są deklaracją zaliczenia wszystkich 20 scenariuszy na produkcyjnym środowisku.
