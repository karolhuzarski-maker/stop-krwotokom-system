# Mini audyt — 10.11.2026

Repozytorium: `karolhuzarski-maker/stop-krwotokom-system`, `main`. Punkt wyjścia: `88b4a7e58b80c59d2a3ac0556de6d647af87b54e`.

## Ocena

Strona publiczna prezentuje program i może służyć do kontaktu. Portal był makietą: kursy, uczestnicy i certyfikaty istniały wyłącznie w JavaScript. Flaga DEMO nie była logowaniem. GitHub Pages jest hostingiem statycznym; do kont i danych trzeba podłączyć usługi.

## Poprawki

| Obszar | Wprowadzona zmiana |
|---|---|
| Konta | Zaproszenia administratora zamiast samorejestracji; strona logowania, ustawienie i odzyskanie hasła |
| Uprawnienia | Przygotowane profile, stałe ID, RLS i serwerowe sprawdzenie daty; brak edycji uprawnień przez instruktora |
| Konfiguracja | Bez projektu formularz haseł i zewnętrzne SDK pozostają wyłączone; klucze uprzywilejowane są odrzucane |
| Boty | Przygotowane tokeny Turnstile dla logowania/resetu; wymagają konfiguracji Auth i widgetu |
| Materiały | Przygotowany prywatny magazyn z warunkiem aktywnego dostępu |
| DEMO | Oznaczenia fikcyjnych danych pozostają widoczne; po podłączeniu kont funkcje DEMO nie udają prawdziwych operacji |
| Drobne błędy | Escapowanie tytułu modalu i statusu kursu, obsługa uszkodzonego adresu `%`, style wykazu ośrodków w nowej karcie |
| Kontakt | Przycisk zapytania o szkolenie i e-mail organizatora |
| Wyszukiwanie | Widoczne odnośniki tematyczne i pytania, tytuł/opis, canonical, WebSite, Open Graph, robots i sitemap |
| Dokumentacja | Aktualny README, mapa kodu, instrukcja konfiguracji i plan |

Logo, favicon, ilustracje i fotografie pozostawiono bez zmian.

## Frazy

Dodano naturalnie: tamowanie krwotoków, pierwsza pomoc, opaska uciskowa TQ, ucisk bezpośredni, pakowanie ran i kurs instruktorski. Pytania o pierwszą pomoc taktyczną i STOP THE BLEED prowadzą do oferty H-CORE EDU; strona przedstawia STOP KRWOTOKOM SYSTEM jako autorski polski program.

Chmura jest zbiorem widocznych linków do treści. Google nie używa `meta keywords` do rankingu, a sztuczne nagromadzenie fraz może naruszać zasady wyszukiwania. Zmiany nie gwarantują pozycji.

`konto.html` ma `noindex,nofollow` i nie występuje w sitemap. Robots pozwala pobrać stronę, aby robot odczytał `noindex`. Dostęp do danych zapewniają Auth i RLS, nie ustawienia indeksowania.

## Co podłączyć

1. Nowy projekt Supabase, migrację SQL, publiczny URL i klucz publishable.
2. Własną pocztę SMTP, właściwe adresy powrotu oraz wyłączenie samorejestracji w Auth.
3. Turnstile: sitekey na stronie, sekret w Supabase; serwerowe limity logowania i poczty.

Instrukcja: [PODLACZENIE_PORTALU.md](PODLACZENIE_PORTALU.md).

## Co dalej

| Kiedy | Zakres |
|---|---|
| Przed dostępem instruktorów | Test rzeczywistego SQL/RLS, izolacji dwóch kont, odmowy samorejestracji, zmiany/cofnięcia/wygaśnięcia dostępu oraz zaproszeń i SMTP |
| Przed zbieraniem danych | Informacja o prywatności i zasady obsługi danych odpowiadające usługom |
| Następny etap | Trwałe kursy/uczestnicy z RLS, ćwiczenia, serwerowy generator certyfikatów/QR, rejestr weryfikacji i ślad zmian |
| Biblioteka | Pliki w prywatnym magazynie, wersjonowanie i interfejs autoryzowanego pobierania |
| Zasady licencji | Ujednolicenie strony, umów i regulaminu. Kod zawiera projektową zasadę dwóch instruktorów; audyt techniczny nie ustala wymagań programowych |
| Zmiana domeny | Spójna aktualizacja publikacji, Auth, CAPTCHA, canonical/OG i sitemap |

Płatności, zapisy, panel koordynatora i raporty pozostają poza gotowym zakresem. Obecna zmiana przygotowuje konta, profil i ważność; nie kończy silnika kursowego.

## Weryfikacja

- 12 testów adaptera Auth: konfiguracja, sesja, profil, odmowa dostępu, awarie, wylogowanie w trakcie żądania, hasła i CAPTCHA.
- Kontrola składni JavaScript i `git diff --check`.
- Kontrola przeglądarkowa: desktop, układy 320/390 px, pytania i linki, wyłączone formularze bez konfiguracji, dodawanie fikcyjnego kursu w DEMO oraz błędny adres `%`. Układy wąskie sprawdzono w ramkach o zadanej szerokości; nie jest to test na fizycznym telefonie.
- Bez projektu Supabase nie wykonano integracyjnego testu SQL/RLS, wysyłki e-mail ani Turnstile. Testy kodu używają imitacji odpowiedzi Auth.

To mini audyt wdrożeniowy, nie test penetracyjny całego systemu.

## Źródła

- Google: [meta keywords](https://developers.google.com/search/blog/2009/09/google-does-not-use-keywords-meta-tag), [zasady spamu](https://developers.google.com/search/docs/essentials/spam-policies).
- Supabase: [zaproszenia](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [H-CORE EDU — oferta i kontakt](https://h-core.edu.pl/).
