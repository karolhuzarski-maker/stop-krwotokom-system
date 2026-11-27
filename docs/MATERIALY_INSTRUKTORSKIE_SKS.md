# Materiały instruktorskie SKS — pierwsze wydanie 0.9

## Zakres
Biblioteka w zakładce **Materiały** portalu SKS jest oparta na prywatnym bucketcie Supabase Storage `instructor-materials`. Standard szkoleniowy SK-03 jest dostępny tylko po uwierzytelnieniu i spełnieniu warunków RLS.

Na stronie publicznej, przy opisie systemu, dostępne są:
- `assets/docs/SK-01_Preambula_SKS_0.9.pdf` — Preambuła;
- `assets/docs/SK-02_Karta_programu_SKS_0.9.pdf` — Karta programu.

W prywatnej bibliotece instruktora pozostaje `SK-03_Standard_szkoleniowy_SKS_0.9.pdf` — Standard szkoleniowy.

**Uwaga:** 0.9 oznacza redakcyjną wersję roboczą, a 1.0 w podtytule oznacza wersję programu. Zawartość **nie została jeszcze poddana pełnemu audytowi klinicznemu i prawnemu**.

## Jednorazowa aktywacja bezpiecznego uploadu
1. Jako właściciel projektu Supabase otwórz **SQL Editor → New query**.
2. Skopiuj i wykonaj `backend/004_private_materials_admin.sql` (w repozytorium).
3. Załóż, że `backend/001_invite_only_access.sql` i `backend/003_centrala_sks.sql` są już wykonane.

Ta migracja pozostawia bucket prywatnym, dopuszcza odczyt dla aktywnych instruktorów i administratora oraz dopuszcza przesyłanie pliku PDF tylko dla jedynego administratora Centrali SKS.

## Publikacja PDF-ów w portalu
1. Pobierz `SK-03_Standard_szkoleniowy_SKS_0.9.pdf` i zapisz go lokalnie.
2. Zaloguj się jako administrator i otwórz: `https://stopkrwotokom-system.pl/#panel/materials`.
3. W dolnej części sekcji **Publikacja dokumentów — Centrala SKS** wybierz plik SK-03.
4. Kliknij **Opublikuj pliki PDF**.
5. Po ponownym załadowaniu biblioteki karta Standardu szkoleniowego pokaże **Dostępny PDF**. Prawa dostępu są egzekwowane w Supabase przez RLS.

**Nie** przesyłaj SK-03, ZIP-a ani źródłowych plików Markdown do publicznego folderu `assets/`, bo obejdzie to kontrolę dostępu. Nazwa pliku i rozszerzenie `.pdf` muszą pozostać niezmienione przy tym pierwszym wdrożeniu.

## Aktualizacje
Prywatny standard SK-03 można zastąpić, wysyłając plik o tej samej nazwie. Publiczne dokumenty SK-01 i SK-02 aktualizuje się osobno wraz ze stroną. W kolejnych wersjach preferowane jest nadawanie odrębnego numeru dokumentu/wydania i archiwizowanie poprzedniej wersji przed zmianą.
