# STOP KRWOTOKOM SYSTEM

Strona publiczna i rozwijany portal instruktora H-CORE EDU.

- Strona: https://karolhuzarski-maker.github.io/stop-krwotokom-system/
- Kod: https://github.com/karolhuzarski-maker/stop-krwotokom-system
- Hosting: GitHub Pages, gałąź `main`, katalog główny. Repozytorium i publikacja już istnieją.

## Obecny stan

Strona publiczna działa. Kursy, uczestnicy, dokumenty i publiczna weryfikacja certyfikatów pozostają DEMO z fikcyjnymi danymi, które znikają po odświeżeniu.

Przygotowano integrację kont na zaproszenie z Supabase Auth: logowanie, ustawienie i odzyskanie hasła, własny profil, ID i serwerowe sprawdzenie ważności uprawnień. Integracja jest **wyłączona do podłączenia projektu Supabase**. Pusta konfiguracja nie uruchamia formularza haseł ani zewnętrznego SDK. Nie ma publicznej rejestracji.

Administrator zaprasza instruktorów i ustawia uprawnienia w panelu Supabase. Nie edytuje kodu dla każdego użytkownika. Po podłączeniu kont operacje DEMO nie udają funkcji prawdziwego konta.

## Mapa kodu

| Plik | Zawartość |
|---|---|
| `index.html` | Strona publiczna, tematy i pytania, SEO, szkielet panelu |
| `konto.html` | Logowanie i ustawienie hasła z zaproszenia |
| `assets/js/app.js` | Nawigacja, interakcje DEMO, widok podłączonego profilu |
| `assets/js/portal-config.js` | Publiczny URL projektu, publishable key, sitekey Turnstile |
| `assets/js/portal-auth.js` | Adapter Auth, własny profil, sprawdzenie uprawnień |
| `assets/js/account.js` | Formularze konta |
| `backend/001_invite_only_access.sql` | Profile, RLS i prywatny magazyn; do wykonania w nowym projekcie |
| `assets/css/public.css` | Aktualne style strony publicznej i dodatki panelu |
| `assets/css/style.css` | Bazowe style portalu i pierwotnej makiety |
| `assets/css/account.css` | Strona konta |
| `assets/images/`, `assets/icons/`, `favicon.ico` | Grafiki i favicon |
| `robots.txt`, `sitemap.xml` | Indeksowanie publicznej strony |

## Podłączenie i dalsze prace

- [Instrukcja podłączenia i zapraszania instruktorów](docs/PODLACZENIE_PORTALU.md)
- [Mini audyt z 10.11.2026](docs/MINI_AUDYT_2026-11-10.md)
- [Plan kolejnych etapów](docs/PLAN_MVP.md)

Nie zmieniaj DNS istniejącej domeny przed przygotowaniem docelowej publikacji. Canonical i mapa strony wskazują aktualny adres GitHub Pages.

## Kontrole lokalne

Wystarczy Node.js z obsługą `node:test`; nie ma zależności npm ani etapu budowania.

```sh
npm test
npm run check
git diff --check
```

Testy imitują odpowiedzi Auth. Nie zastępują testu rzeczywistego projektu Supabase, SQL/RLS, wysyłki zaproszeń ani Turnstile.

## Dane i materiały

Repozytorium i GitHub Pages są publiczne. Dane uczestników i materiały tylko dla instruktorów muszą pozostać w bazie/prywatnym magazynie. Na stronie umieszczamy wyłącznie klucz **publishable**; klucze secret/service_role i hasło SMTP zostają w usługach serwerowych.
