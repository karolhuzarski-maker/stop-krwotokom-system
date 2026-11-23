# Materiały instruktorskie SKS — pierwsze wydanie 0.9

## Zakres
Biblioteka w zakładce **Materiały** portalu SKS jest oparta na prywatnym bucketcie Supabase Storage `instructor-materials`. PDF-y **nie są** publikowane w publicznym repozytorium GitHub Pages. Użytkownik widzi pliki tylko po uwierzytelnieniu i spełnieniu warunków RLS.

Pierwsze trzy pliki (dostępne w rozmowie z 23.11.2026, nie w repozytorium publicznym):
- `SK-01_Preambula_SKS_0.9.pdf` — Preambuła;
- `SK-02_Karta_programu_SKS_0.9.pdf` — Karta programu;
- `SK-03_Standard_szkoleniowy_SKS_0.9.pdf` — Standard szkoleniowy.

**Uwaga:** 0.9 oznacza redakcyjną wersję roboczą, a 1.0 w podtytule oznacza wersję programu. Zawartość **nie została jeszcze poddana pełnemu audytowi klinicznemu i prawnemu**.

## Jednorazowa aktywacja bezpiecznego uploadu
1. Jako właściciel projektu Supabase otwórz **SQL Editor → New query**.
2. Skopiuj i wykonaj `backend/004_private_materials_admin.sql` (w repozytorium).
3. Załóż, że `backend/001_invite_only_access.sql` i `backend/003_centrala_sks.sql` są już wykonane.

Ta migracja pozostawia bucket prywatnym, dopuszcza odczyt dla aktywnych instruktorów i administratora oraz dopuszcza przesyłanie plików PDF tylko dla jedynego administratora Centrali SKS.

## Publikacja PDF-ów w portalu
1. Pobierz trzy PDF-y z rozmowy i zapisz je lokalnie. Jeżeli pobierasz ZIP, najpierw wypakuj go.
2. Zaloguj się jako administrator i otwórz: `https://stopkrwotokom-system.pl/#panel/materials`.
3. W dolnej części sekcji **Publikacja dokumentów — Centrala SKS** wybierz trzy pliki PDF jednocześnie.
4. Kliknij **Opublikuj pliki PDF**.
5. Po ponownym załadowaniu biblioteki wszystkie trzy karty pokażą **Dostępny PDF**. Prawa dostępu są egzekwowane w Supabase przez RLS.

**Nie** przesyłaj ZIP-a, źródłowych plików Markdown ani PDF-ów do publicznego folderu `assets/`, bo obejdzie to kontrolę dostępu. Nazwy plików i rozszerzenie `.pdf` muszą pozostać niezmienione przy tym pierwszym wdrożeniu.

## Aktualizacje
Dokumenty można zastępować, wysyłając plik o tej samej nazwie. W kolejnych wersjach preferowane jest nadawanie odrębnego numeru dokumentu/wydania i archiwizowanie poprzedniej wersji przed zmianą.
