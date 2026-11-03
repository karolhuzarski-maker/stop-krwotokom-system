# STOP KRWOTOKOM SYSTEM - nowa strona i demonstracyjny portal instruktora

Wersja startowa (MVP) przygotowana z zatwierdzonej makiety HTML. Nie jest to wdrożony system kont i certyfikacji.

## Co działa
- Strona publiczna z hasłem „Polski standard kontroli krwotoków”, opisem kursu, instruktora, ośrodków i terminów.
- Demonstracyjny panel gościa i instruktora; menu: Pulpit dostępny przez logo, Moje szkolenia, Dodaj szkolenie, Materiały, Mój profil i ID.
- Demonstracyjne formularze i wykaz licencjonowanych ośrodków w nowej karcie.
- Wszystkie zdjęcia i logo wewnątrz projektu, bez odsyłania do plików lokalnych.

## Czego jeszcze NIE ma
- Serwerowego logowania, rzeczywistych uprawnień ani bazy danych.
- Trwałego zapisywania kursów i uczestników, prawdziwego generatora certyfikatów i QR.
- Produkcyjnej weryfikacji autoryzacji. Wszystkie przykłady są wyłącznie demonstracyjne.

## GitHub Pages - start
1. Utwórz nowe repozytorium `stop-krwotokom-system` na https://github.com/new (właściciel: karolhuzarski-maker, Public).
2. Rozpakuj ZIP i wyślij **zawartość folderu** `STOP_KRWOTOKOM_GITHUB_START` do katalogu głównego repozytorium (Add file -> Upload files -> Commit changes). Ważne: `index.html` musi leżeć w katalogu głównym.
3. Repozytorium -> Settings -> Pages -> Source: Deploy from a branch -> Branch: main -> Folder: /(root) -> Save.
4. Odwiedź adres `https://karolhuzarski-maker.github.io/stop-krwotokom-system/` po opublikowaniu. Ten adres zacznie działać dopiero po utworzeniu repozytorium i włączeniu Pages.

## Organizacja plików
- `index.html` - widoki strony i portalu w obecnej wersji demonstracyjnej.
- `assets/css/style.css` - wszystkie style, zachowana kolejność reguł z pierwotnej makiety.
- `assets/js/app.js` - przełączanie widoków, przyciski i interakcje DEMO.
- `assets/images/` - logo, zdjęcia z zajęć, grafiki.
- `docs/PLAN_MVP.md` - plan rozbudowy w etapach.

## Domena
Na razie testuj na domenie `github.io`; nie zmieniaj DNS istniejącej strony `stopkrwotokom.org`.
Docelowy `panel.stopkrwotokom.org` będzie wymagał osobnej konfiguracji domeny i prawdziwych usług uwierzytelniania.

## Ważne
GitHub Pages jest hostingiem statycznym. Wszystko, co udostępnisz na opublikowanej stronie (także pliki JS i PDF), będzie publicznie dostępne. Materiały tylko dla instruktorów i dane kursantów NIE mogą trafić do publicznego katalogu Pages.
