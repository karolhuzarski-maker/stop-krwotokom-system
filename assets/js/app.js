'use strict';

// Publiczna strona i portal korzystają z rzeczywistej sesji Supabase.
// Moduły szkoleń i certyfikatów są udostępniane dopiero po podłączeniu rejestrów.
const tabs = [
  ['Pulpit', '▦', 'home'],
  ['Moje szkolenia', '▤', 'courses'],
  ['Dodaj szkolenie', '＋', 'addCourse'],
  ['Materiały', '▥', 'materials'],
  ['Mój profil i ID', '♙', 'profile'],
  ['Weryfikacja certyfikatu', '◇', 'verify'],
  ['Centrala SKS', '♜', 'central']
];
const guestCards = [
  {name:'profile', icon:'♙', title:'Mój profil i ID', detail:'Numer instruktora i ważność autoryzacji.'},
  {name:'courses', icon:'▤', title:'Moje szkolenia', detail:'Ewidencja prowadzonych szkoleń.'},
  {name:'addCourse', icon:'＋', title:'Dodaj szkolenie', detail:'Rejestrowanie terminów i uczestników.'},
  {name:'materials', icon:'▥', title:'Materiały', detail:'Dokumenty i zasoby instruktorskie.'},
  {name:'centres', icon:'⌂', title:'Ośrodki szkoleniowe', detail:'Informacje dla ośrodków współpracujących.'}
];
let current = 'home';
const mk = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateFormat = date => new Date(date + 'T12:00:00').toLocaleDateString('pl-PL', {day:'2-digit', month:'2-digit', year:'numeric'});
const getAuthState = () => window.SKAuth ? window.SKAuth.getState() : {mode:'guest', email:'', profile:null};
const isSignedIn = state => state.mode === 'active' || state.mode === 'blocked';
let centralDrawVersion = 0;
let materialsDrawVersion = 0;

function nav() {
  const state = getAuthState();
  document.getElementById('nav').innerHTML = tabs.filter(tab => ['home','courses','addCourse','materials','profile'].includes(tab[2])).map(tab => {
    const locked = !isSignedIn(state);
    return '<button type="button" class="nav-item ' + (current === tab[2] ? 'active ' : '') +
      (locked ? 'nav-guest' : '') + '" onclick="go(\'' + tab[2] + '\')">' +
      '<span class="nav-icon">' + tab[1] + '</span><span class="nav-label">' + tab[0] + '</span>' +
      (locked ? '<span class="nav-lock" aria-label="Wymaga zalogowania">🔒</span>' : '') + '</button>';
  }).join('') +
  (isSignedIn(state) && state.isAdmin === true ?
    '<div class="sk-central-nav-label">ZARZĄDZANIE SYSTEMEM</div>' +
    '<button type="button" class="nav-item sk-central-link ' + (current === 'central' ? 'active' : '') +
    '" onclick="go(\'central\')"><span class="nav-icon">♜</span><span class="nav-label">Centrala SKS</span></button>' : '') +
  '<button type="button" class="nav-verify-link" onclick="go(\'verify\')">◇ Sprawdź certyfikat</button>';
}

function updatePortalChrome() {
  const state = getAuthState();
  const signed = isSignedIn(state);
  const status = document.getElementById('portal-status');
  const controls = document.getElementById('portal-controls');
  status.className = 'pill' + (state.mode === 'active' ? '' : ' visitor');
  status.textContent = signed && state.isAdmin === true ? 'Centrala SKS · administrator' :
    state.mode === 'active' ? 'Instruktor · aktywny' :
    state.mode === 'blocked' ? 'Autoryzacja nieaktywna' : 'Niezalogowany';
  controls.innerHTML = signed ?
    '<button class="ghost-demo" onclick="logoutAccount()">Wyloguj się</button>' :
    '<a class="ghost-demo" href="konto.html">Zaloguj się</a>';
}

function head(title, subtitle, action = '') {
  return '<div class="page-head"><div><div class="eyebrow">STOP KRWOTOKOM SYSTEM</div><h1>' +
    mk(title) + '</h1>' + (subtitle ? '<p>' + mk(subtitle) + '</p>' : '') + '</div>' + action + '</div>';
}

function guestTeaser(item) {
  const action = item.name === 'centres' ? 'openCentresWindow()' : 'go(\'' + item.name + '\')';
  return '<button type="button" class="lock-card" onclick="' + action + '">' +
    '<span class="lock-icon">' + item.icon + '</span><b>' + mk(item.title) + '</b>' +
    '<small>' + mk(item.detail) + '</small></button>';
}

function drawGuest() {
  const v = document.getElementById('view');
  if (current === 'central') {
    v.innerHTML = head('Centrala SKS', 'Panel administratora systemu.') +
      '<section class="card" style="max-width:760px"><h2>Dostęp administratora</h2>' +
      '<p>Ten moduł jest dostępny wyłącznie dla konta z nadanymi uprawnieniami Centrali SKS.</p>' +
      '<p style="margin-top:18px"><a href="konto.html" class="button">Zaloguj się</a></p></section>';
    return;
  }
  if (current === 'verify') {
    v.innerHTML = head('Weryfikacja dokumentów', 'Publiczna weryfikacja będzie dostępna po uruchomieniu rejestru.') +
      '<section class="card"><h2>Weryfikacja certyfikatów</h2><p>Rejestr nie jest jeszcze aktywny. W sprawie potwierdzenia uprawnień skontaktuj się z organizatorem.</p><p style="margin-top:16px"><a class="button secondary" href="mailto:stop@h-core.edu.pl">Kontakt</a></p></section>';
    return;
  }
  if (current === 'home') {
    v.innerHTML = head('Portal instruktora', 'Indywidualne konto, numer SKS-I i status autoryzacji.',
      '<a class="button" href="konto.html">Zaloguj się</a>') +
      '<div class="lock-grid">' + guestCards.map(guestTeaser).join('') + '</div>';
    return;
  }
  const item = guestCards.find(card => card.name === current);
  if (!item) return go('home', false);
  v.innerHTML = head(item.title, item.detail) +
    '<section class="card" style="max-width:750px"><h2>Dostęp dla instruktorów</h2>' +
    '<p>Do korzystania z portalu potrzebne jest konto aktywowane przez organizatora STOP KRWOTOKOM SYSTEM.</p>' +
    '<div class="inline-actions" style="margin-top:20px">' +
    '<a class="button" href="konto.html">Zaloguj się</a>' +
    '<a class="button secondary" href="mailto:stop@h-core.edu.pl">Zapytaj o dostęp</a></div></section>';
}


function centralStateLabel(status) {
  switch (status) {
    case 'active': return '<span class="tag green">Aktywny</span>';
    case 'expired': return '<span class="tag gold">Wygasła</span>';
    case 'pending': return '<span class="tag gold">Brak daty</span>';
    default: return '<span class="tag">Nieaktywny</span>';
  }
}

function centralDate(value) {
  if (!value) return '—';
  try { return new Date(value).toLocaleDateString('pl-PL', {day:'2-digit',month:'2-digit',year:'numeric'}); }
  catch (_) { return '—'; }
}

function filterCentralInstructors(search) {
  const body = document.getElementById('sk-central-list');
  if (!body) return;
  const q = String(search || '').trim().toLocaleLowerCase('pl-PL');
  body.querySelectorAll('tr').forEach(row => {
    row.hidden = q !== '' && !row.textContent.toLocaleLowerCase('pl-PL').includes(q);
  });
}

function renderCentralInstructors(rows) {
  const total = rows.length;
  const active = rows.filter(row => row.status === 'active').length;
  const expired = rows.filter(row => row.status === 'expired').length;
  const other = total - active - expired;
  const stat = (title, count) => '<div class="card sk-master-stat"><p>' + title +
    '</p><strong>' + count + '</strong></div>';
  const stats = '<div class="sk-master-stats">' +
    stat('Wszyscy instruktorzy', total) + stat('Aktywne autoryzacje', active) +
    stat('Wymagają uwagi', other) + stat('Wygasłe', expired) + '</div>';

  const items = rows.map(row =>
    '<tr><td><b>' + mk(row.instructor_id) + '</b></td>' +
    '<td>' + mk(row.display_name || 'Nieuzupełnione') + '</td>' +
    '<td>' + mk(row.email || '—') + '</td>' +
    '<td>' + centralStateLabel(row.status) + '</td>' +
    '<td>' + (row.valid_until ? mk(dateFormat(row.valid_until)) : '—') + '</td>' +
    '<td>' + centralDate(row.created_at) + '</td></tr>'
  ).join('');

  return stats +
    '<section class="card sk-central-register">' +
    '<div class="sk-central-heading"><div><h2>Rejestr instruktorów</h2>' +
    '<p>Aktualne dane z Supabase. Tylko administracja SKS ma dostęp do pełnej listy.</p></div>' +
    '<a class="button secondary" href="https://supabase.com/dashboard/project/ovujnymvsjptpexnwyao/editor" target="_blank" rel="noopener noreferrer">Zarządzaj w Supabase ↗</a></div>' +
    (total ?
      '<div class="sk-central-search"><label for="sk-central-search">Wyszukaj instruktora</label>' +
      '<input type="search" id="sk-central-search" placeholder="Numer, nazwisko lub e-mail" oninput="filterCentralInstructors(this.value)"></div>' +
      '<div class="sk-table-scroll"><table class="table"><thead><tr>' +
      '<th>Numer SKS-I</th><th>Imię i nazwisko</th><th>E-mail</th><th>Status</th><th>Ważna do</th><th>Rejestracja</th>' +
      '</tr></thead><tbody id="sk-central-list">' + items + '</tbody></table></div>' :
      '<p class="sk-master-empty">Nie ma jeszcze zarejestrowanych instruktorów.</p>') +
    '</section>' +
    '<div class="sk-central-future"><section class="card"><h2>Szkolenia</h2>' +
    '<p>Rejestr szkoleń będzie dostępny tutaj po uruchomieniu modułu dodawania kursów.</p></section>' +
    '<section class="card"><h2>Ośrodki</h2>' +
    '<p>W kolejnym etapie dołączymy profile i licencje ośrodków szkoleniowych.</p></section>' +
    '<section class="card"><h2>Certyfikaty</h2>' +
    '<p>Centralny rejestr i kontrolę dokumentów podłączymy do rzeczywistej bazy kursów.</p></section></div>' +
    '<p class="subtle" style="margin-top:18px">Centrala SKS w tej wersji umożliwia bezpieczny podgląd instruktorów. Zmiany licencji wykonujesz obecnie w Supabase.</p>';
}

async function drawCentral(state) {
  const v = document.getElementById('view');
  const version = ++centralDrawVersion;
  v.innerHTML = head('Centrala SKS', 'Zarządzanie ogólnopolskim systemem instruktorów.') +
    '<section class="card"><p>Ładowanie rejestru instruktorów…</p></section>';

  try {
    const instructors = await window.SKAuth.listCentralInstructors();
    if (version !== centralDrawVersion || current !== 'central' || window.SKAuth.getState().isAdmin !== true) return;
    v.innerHTML = head('Centrala SKS', 'Zarządzanie ogólnopolskim systemem instruktorów.') +
      renderCentralInstructors(instructors);
  } catch (_) {
    if (version !== centralDrawVersion || current !== 'central') return;
    v.innerHTML = head('Centrala SKS', 'Panel administratora systemu.') +
      '<section class="card"><h2>Brak połączenia z rejestrem</h2>' +
      '<p>Nie udało się pobrać danych. Upewnij się, że skrypt uprawnień Centrali SKS jest uruchomiony w Supabase.</p>' +
      '<button class="button secondary" type="button" onclick="go(\'central\')" style="margin-top:16px">Spróbuj ponownie</button></section>';
  }
}


const skMaterialCatalogue = [
  {name:'SK-01_Preambula_SKS_0.9.pdf', code:'SK-01', title:'Preambuła',
    detail:'Założenia i wartości polskiego systemu kontroli krwotoków.'},
  {name:'SK-02_Karta_programu_SKS_0.9.pdf', code:'SK-02', title:'Karta programu',
    detail:'Cele, moduły i efekty uczenia się kursu podstawowego.'},
  {name:'SK-03_Standard_szkoleniowy_SKS_0.9.pdf', code:'SK-03', title:'Standard szkoleniowy',
    detail:'Obowiązujące założenia technik, organizacji ćwiczeń i oceny uczestnika.'}
];
function renderSKMaterials(files, isAdmin) {
  const available = new Set(files.map(file => file.name));
  const cards = skMaterialCatalogue.map(doc => {
    const ready = available.has(doc.name);
    return '<article class="card sk-document-card">' +
      '<div class="sk-document-code">' + doc.code + ' <span>WERSJA ROBOCZA 0.9</span></div>' +
      '<h2>' + doc.title + '</h2><p>' + doc.detail + '</p>' +
      '<div class="sk-document-bottom">' +
      (ready
        ? '<span class="tag green">Dostępny PDF</span>' +
          '<button type="button" class="button sk-document-open" data-file="' + doc.name +
          '" onclick="openSKMaterial(this.dataset.file)">Otwórz PDF ↗</button>'
        : '<span class="tag gold">Oczekuje na publikację</span>') +
      '</div></article>';
  }).join('');
  const admin = isAdmin ?
    '<section class="card sk-material-admin"><h2>Publikacja dokumentów — Centrala SKS</h2>' +
    '<p>Wybierz przygotowane pliki PDF (możesz zaznaczyć wszystkie trzy naraz). Po przesłaniu będą dostępne wyłącznie dla aktywnych instruktorów i Centrali SKS. Ponowne przesłanie pliku o tej samej nazwie zastąpi poprzednią wersję.</p>' +
    '<p style="margin-top:10px">Przy pierwszej publikacji wykonaj <a href="https://github.com/karolhuzarski-maker/stop-krwotokom-system/blob/main/backend/004_private_materials_admin.sql" target="_blank" rel="noopener noreferrer">jednorazowy skrypt uprawnień biblioteki</a> w Supabase SQL Editor.</p>' +
    '<div class="sk-material-upload-row"><input id="sk-material-upload" type="file" accept=".pdf,application/pdf" multiple aria-label="Wybierz pliki PDF do prywatnej biblioteki"/>' +
    '<button class="button" id="sk-material-upload-button" type="button" onclick="uploadSKMaterials()">Opublikuj pliki PDF</button></div>' +
    '<p class="sk-material-upload-status" id="sk-material-upload-status" role="status" aria-live="polite"></p></section>' : '';
  return '<div class="sk-material-intro"><p>Dokumenty systemowe dostępne dla autoryzowanych instruktorów. Pliki są przechowywane w prywatnym magazynie Supabase, nie na publicznej stronie.</p></div>' +
    '<div class="sk-material-grid">' + cards + '</div>' + admin +
    '<p class="subtle" style="margin-top:18px">Wydanie 0.9 jest robocze; dokumenty będą aktualizowane po dalszym audycie.</p>';
}
async function drawMaterials(state) {
  const view = document.getElementById('view');
  const version = ++materialsDrawVersion;
  view.innerHTML = head('Materiały instruktorskie', 'Oficjalna biblioteka dokumentów STOP KRWOTOKOM SYSTEM.') +
    '<section class="card"><p>Ładowanie prywatnej biblioteki…</p></section>';
  try {
    const files = await window.SKAuth.listInstructorMaterials();
    if (version !== materialsDrawVersion || current !== 'materials') return;
    const latest = window.SKAuth.getState();
    if (latest.mode !== 'active' && latest.isAdmin !== true) return;
    view.innerHTML = head('Materiały instruktorskie', 'Oficjalna biblioteka dokumentów STOP KRWOTOKOM SYSTEM.') +
      renderSKMaterials(files, latest.isAdmin === true);
  } catch (_) {
    if (version !== materialsDrawVersion || current !== 'materials') return;
    view.innerHTML = head('Materiały instruktorskie', 'Biblioteka prywatna STOP KRWOTOKOM SYSTEM.') +
      '<section class="card"><h2>Biblioteka jest chwilowo niedostępna</h2>' +
      '<p>Nie udało się pobrać dokumentów. Spróbuj ponownie albo skontaktuj się z organizatorem.</p>' +
      '<button type="button" class="button secondary" style="margin-top:15px" onclick="go(\'materials\')">Odśwież bibliotekę</button></section>';
  }
}
async function uploadSKMaterials() {
  const input = document.getElementById('sk-material-upload');
  const button = document.getElementById('sk-material-upload-button');
  const status = document.getElementById('sk-material-upload-status');
  if (!input || !button || !status) return;
  if (!input.files.length) { status.textContent = 'Najpierw wybierz pliki PDF.'; return; }
  button.disabled = true;
  status.textContent = 'Trwa przesyłanie plików do prywatnej biblioteki…';
  try {
    const files = await window.SKAuth.uploadInstructorMaterials(input.files);
    status.textContent = 'Opublikowano: ' + files.length + ' plik(i).';
    go('materials', false);
  } catch (error) {
    status.textContent = error && error.message ? error.message : 'Nie udało się opublikować dokumentów.';
  } finally {
    button.disabled = false;
  }
}
async function openSKMaterial(fileName) {
  // Reserve the new tab immediately on click: browsers would block it after an async request.
  const tab = window.open('', '_blank');
  try {
    const url = await window.SKAuth.getInstructorMaterialUrl(fileName);
    if (tab && !tab.closed) {
      tab.opener = null;
      tab.location.replace(url);
    } else {
      window.location.assign(url);
    }
  } catch (error) {
    if (tab && !tab.closed) tab.close();
    window.alert(error && error.message ? error.message : 'Nie można otworzyć dokumentu.');
  }
}


/* Indywidualna legitymacja: dane wyłącznie z uwierzytelnionego profilu Supabase.
   A5 jednostronne; brak fikcyjnych QR, podpisów, zdjęć i dat wydania. */
function renderInstructorCredential(state) {
  const p = state.profile || {};
  const isActive = state.mode === 'active';
  const name = mk(p.display_name || 'Dane instruktora nieuzupełnione');
  const instructorNumber = mk(p.instructor_id || 'Numer nie został nadany');
  const validUntil = p.valid_until ? mk(dateFormat(p.valid_until)) : 'Nie ustalono';
  const statusLabel = isActive ? 'AKTYWNA' : 'NIEAKTYWNA';
  return '<article class="sk-id-paper ' + (isActive ? 'sk-id-active' : 'sk-id-inactive') +
    '" id="sk-instructor-id" aria-label="Legitymacja instruktora STOP KRWOTOKOM SYSTEM">' +
    '<div class="sk-id-masthead">' +
    '<div class="sk-id-brand-sks"><img src="assets/images/logo-stop-krwotokom-system-prosty.webp" alt="STOP KRWOTOKOM SYSTEM"></div>' +
    '<span class="sk-id-brand-rule" aria-hidden="true"></span>' +
    '<img class="sk-id-brand-hcore" src="assets/images/h-core-edu-mark.svg" alt="H-CORE EDU">' +
    '</div>' +
    '<div class="sk-id-banner"><span>POLSKI SYSTEM KONTROLI KRWOTOKÓW</span>' +
    '<strong>LEGITYMACJA<br>INSTRUKTORA</strong></div>' +
    '<div class="sk-id-main">' +
    '<div class="sk-id-watermark" aria-hidden="true">SKS</div>' +
    '<div class="sk-id-main-kicker">AUTORYZACJA INSTRUKTORSKA</div>' +
    '<div class="sk-id-person"><span>IMIĘ I NAZWISKO</span><strong>' + name + '</strong></div>' +
    '<div class="sk-id-number"><span>NUMER INSTRUKTORA</span><strong>' + instructorNumber + '</strong></div>' +
    '<div class="sk-id-details">' +
      '<div><span>WAŻNA DO</span><strong>' + validUntil + '</strong></div>' +
      '<div><span>STATUS AUTORYZACJI</span><strong class="sk-id-status">' + statusLabel + '</strong></div>' +
    '</div>' +
    '<div class="sk-id-endorsement"><span class="sk-id-endorsement-mark" aria-hidden="true">✦</span>' +
    '<div><b>STOP KRWOTOKOM SYSTEM</b><small>Autoryzowany program szkoleniowy H-CORE EDU</small></div></div>' +
    '</div>' +
    '<footer class="sk-id-footer"><div><strong>H-CORE EDU</strong><span>Organizator programu</span></div>' +
    '<p>Dokument potwierdza status autoryzacji w chwili jego wygenerowania.<br>' +
    'Aktualność uprawnień potwierdza organizator.</p>' +
    '<b>stopkrwotokom-system.pl</b></footer>' +
    '</article>';
}
async function printInstructorCredential() {
  const button = document.getElementById('sk-id-print-button');
  if (button) { button.disabled = true; button.textContent = 'Sprawdzanie danych…'; }
  try {
    if (!window.SKAuth || typeof window.SKAuth.refresh !== 'function') throw new Error('Brak połączenia z kontem.');
    const state = await window.SKAuth.refresh();
    if (state.mode !== 'active' || !state.profile ||
        !state.profile.instructor_id || !state.profile.display_name || !state.profile.valid_until) {
      throw new Error('Legitymację można wydrukować wyłącznie dla aktywnego, kompletnego profilu instruktora.');
    }
    if (current !== 'profile') return;
    // Refresh dispatches sk:access; draw again if necessary before print.
    draw();
    const badge = document.getElementById('sk-instructor-id');
    if (!badge) throw new Error('Nie udało się przygotować legitymacji.');
    await Promise.all(Array.from(badge.querySelectorAll('img')).map(img =>
      img.complete ? Promise.resolve() : new Promise(resolve => {
        img.addEventListener('load', resolve, {once:true});
        img.addEventListener('error', resolve, {once:true});
      })
    ));
    window.print();
  } catch (error) {
    modal('Legitymacja instruktora', '<p>' + mk(error && error.message || 'Nie udało się przygotować legitymacji.') + '</p>');
  } finally {
    const currentButton = document.getElementById('sk-id-print-button');
    if (currentButton) { currentButton.disabled = false; currentButton.textContent = 'Zapisz jako PDF / drukuj A5'; }
  }
}

function drawConnectedPortal() {
  const state = getAuthState();
  const v = document.getElementById('view');
  if (!isSignedIn(state)) {
    drawGuest();
    if (state.mode === 'unavailable') v.insertAdjacentHTML('afterbegin',
      '<div class="notice">Nie można obecnie potwierdzić uprawnień. Spróbuj ponownie później.</div>');
    return;
  }
  if (current === 'verify') return drawGuest();
  if (current === 'materials') {
    drawMaterials(state);
    return;
  }
  if (current === 'central') {
    if (state.isAdmin !== true) {
      v.innerHTML = head('Centrala SKS', 'Dostęp ograniczony.') +
        '<section class="card"><h2>Brak uprawnień</h2><p>Widok jest przeznaczony dla administratora Centrali SKS.</p></section>';
      return;
    }
    drawCentral(state);
    return;
  }
  const profile = state.profile || {};
  const active = state.mode === 'active';
  const id = mk(profile.instructor_id || 'Do nadania');
  const name = mk(profile.display_name || 'Konto instruktora');
  const expiry = profile.valid_until ? mk(dateFormat(profile.valid_until)) : 'Nie ustalono';
  const status = active ? 'Autoryzacja aktywna' : 'Autoryzacja nieaktywna';
  if (current === 'home') {
    const homeLink = (tab, symbol, title, detail) =>
      '<button type="button" class="sk-home-link" data-tab="' + tab + '" onclick="go(this.dataset.tab)">' +
      '<span class="sk-home-link-icon" aria-hidden="true">' + symbol + '</span>' +
      '<span class="sk-home-link-copy"><strong>' + title + '</strong><small>' + detail + '</small></span>' +
      '<span class="sk-home-link-arrow" aria-hidden="true">›</span></button>';
    const actions =
      homeLink('profile', '♙', 'Mój profil i ID', 'Numer instruktora, licencja i dokumenty') +
      homeLink('courses', '▤', 'Moje szkolenia', 'Rejestr szkoleń w przygotowaniu') +
      (state.isAdmin === true ? homeLink('central', '♜', 'Centrala SKS', 'Wszystkie konta i autoryzacje instruktorów') : '');
    v.innerHTML = head('Pulpit instruktora', 'Twój punkt startowy w systemie STOP KRWOTOKOM.') +
      '<div class="sk-home-overview">' +
      '<section class="card sk-home-greeting"><div class="eyebrow">TWOJE KONTO</div>' +
      '<h2>Witaj, ' + name + '</h2>' +
      '<p>Wybierz, czym chcesz się teraz zająć. Informacje o numerze SKS-I i dokumenty znajdziesz w swoim profilu.</p></section>' +
      '<section class="card sk-home-status"><h2>Status uprawnień</h2>' +
      '<p><span class="tag ' + (active ? 'green' : 'gold') + '">' + status + '</span></p>' +
      '<p class="sk-home-validity">Ważność: <strong>' + expiry + '</strong></p></section></div>' +
      '<h2 class="sk-home-heading">Szybki dostęp</h2>' +
      '<div class="sk-home-links">' + actions + '</div>';
    return;
  }

  if (current === 'profile') {
    const hasData = Boolean(profile.instructor_id && profile.display_name && profile.valid_until);
    const printing = active && hasData;
    const actions =
      '<section class="card sk-id-action-card"><div class="eyebrow">TWOJA LEGITYMACJA</div>' +
      '<h2>Legitymacja instruktora A5</h2>' +
      '<p>Dane z Twojego konta w STOP KRWOTOKOM SYSTEM. Numer, nazwisko, status i data ważności aktualizują się automatycznie po zmianie w Supabase.</p>' +
      '<button id="sk-id-print-button" type="button" class="button sk-id-print" ' +
      (printing ? '' : 'disabled ') +
      'onclick="printInstructorCredential()">Zapisz jako PDF / drukuj A5</button>' +
      '<p class="subtle sk-id-availability">' +
      (printing
        ? 'Przed wydrukiem sprawdzimy ponownie aktualny status konta. W oknie drukowania wybierz „Zapisz jako PDF”.'
        : 'Drukowanie będzie dostępne po aktywowaniu licencji i uzupełnieniu danych przez organizatora.') +
      '</p></section>';
    const details =
      '<section class="card sk-id-detail-card"><h2>Dane i uprawnienia</h2>' +
      '<p><b>Numer instruktora:</b> ' + id + '</p>' +
      '<p><b>Adres konta:</b> ' + mk(state.email) + '</p>' +
      '<p><b>Ważność autoryzacji:</b> ' + expiry + '</p>' +
      '<p><span class="tag ' + (active ? 'green' : 'gold') + '">' + status + '</span></p>' +
      '<p class="subtle">Numer SKS-I pozostaje niezmienny przy odnowieniu licencji. Datę ważności i status określa Centrala SKS.</p></section>';
    const documents =
      '<section class="card sk-id-documents"><h2>Dokumenty systemowe</h2>' +
      '<div class="sk-id-document-links"><a href="regulamin-portalu.html">Regulamin portalu ↗</a>' +
      '<a href="polityka-prywatnosci.html">Polityka prywatności (RODO) ↗</a></div></section>';
    v.innerHTML = head('Mój profil i ID', 'Twoja legitymacja instruktorska i dane autoryzacji.') +
      '<div class="sk-profile-credential">' +
      '<div class="sk-id-preview-col">' + renderInstructorCredential(state) + '</div>' +
      '<div class="sk-id-sidebar-col">' + actions + details + documents + '</div></div>';
    return;
  }
  const titles = {courses:'Moje szkolenia', addCourse:'Dodaj szkolenie', materials:'Materiały'};
  const labels = {
    courses:'Ewidencja szkoleń i uczestników',
    addCourse:'Rejestracja nowego szkolenia',
    materials:'Biblioteka materiałów instruktorskich'
  };
  const title = titles[current] || 'Portal instruktora';
  v.innerHTML = head(title, '') + '<section class="card" style="max-width:770px">' +
    '<h2>' + (labels[current] || 'Moduł portalu') + '</h2>' +
    '<p>Ta funkcja nie jest jeszcze uruchomiona. Po podłączeniu bezpiecznego rejestru będzie dostępna na Twoim koncie.</p>' +
    '<p style="margin-top:18px"><button class="button secondary" onclick="go(\'profile\')">Mój profil i ID</button></p></section>';
}

function draw() {
  if (window.SKAuth && window.SKAuth.isConfigured()) drawConnectedPortal();
  else drawGuest();
}

function go(name, updateAddress = true) {
  if (!tabs.some(tab => tab[2] === name)) name = 'home';
  current = name;
  nav();
  updatePortalChrome();
  document.getElementById('crumb').textContent = tabs.find(tab => tab[2] === name)?.[0] || 'Pulpit instruktora';
  draw();
  window.scrollTo(0, 0);
  // Re-verify the profile on navigation; the access event redraws it with fresh server data.
  if (name === 'profile' && window.SKAuth?.isConfigured()) {
    window.SKAuth.refresh().catch(() => {});
  }
  if (updateAddress && !document.body.classList.contains('guest-mode')) {
    const route = '#panel/' + name;
    if (location.hash !== route) location.hash = route;
  }
}

function modal(title, content) {
  document.getElementById('modalContent').innerHTML = '<div class="modal-head"><h2>' + mk(title) +
    '</h2><button class="close" aria-label="Zamknij" onclick="closeModal()">✕</button></div>' + content;
  document.getElementById('modal').classList.add('show');
}
function closeModal() { document.getElementById('modal').classList.remove('show'); }
function authPrompt() {
  modal('Dostęp instruktorski',
    '<p>Dostęp do portalu przyznaje organizator po potwierdzeniu kwalifikacji.</p>' +
    '<div class="access-choices"><div class="access-choice"><h3>Masz konto?</h3>' +
    '<p>Zaloguj się przy użyciu adresu e-mail i własnego hasła.</p>' +
    '<a class="button" href="konto.html">Zaloguj się</a></div>' +
    '<div class="access-choice"><h3>Potrzebujesz dostępu?</h3>' +
    '<p>Skontaktuj się z organizatorem programu.</p>' +
    '<a class="button secondary" href="mailto:stop@h-core.edu.pl">Napisz wiadomość</a></div></div>');
}
async function logoutAccount() {
  try { await window.SKAuth.signOut(); }
  catch (error) { modal('Wylogowanie', '<p>' + mk(error.message) + '</p>'); return; }
  go('home');
}
function openCentresWindow() { window.open('./#osrodki', '_blank', 'noopener'); }

function setPublicMenu(open) {
  document.getElementById('mainPublicNav')?.classList.toggle('open', open);
  document.querySelector('.mobile-menu-btn')?.setAttribute('aria-expanded', String(open));
}
function togglePublicMenu() {
  setPublicMenu(!document.getElementById('mainPublicNav')?.classList.contains('open'));
}
function scrollPublic(id) {
  setPublicMenu(false);
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  });
}
function setPortalMode(panel) {
  document.getElementById('visitor').style.removeProperty('display');
  document.querySelector('.shell').style.removeProperty('display');
  document.body.classList.toggle('guest-mode', !panel);
  setPublicMenu(false);
}
function showPanel(tab = 'home', updateAddress = true) {
  closeModal();
  setPortalMode(true);
  go(tab, false);
  if (updateAddress) {
    const target = '#panel/' + tab;
    if (location.hash !== target) location.hash = target;
  }
}
function demoEntry() { showPanel('home'); } // Nazwa zachowana dla istniejących przycisków strony.
function backPublic() {
  closeModal();
  setPortalMode(false);
  if (location.hash !== '#start') location.hash = '#start';
  window.scrollTo({top:0, behavior:'instant'});
}
function syncRouteFromAddress() {
  let hash;
  try { hash = decodeURIComponent(location.hash.slice(1)); } catch (_) { hash = 'start'; }
  if (hash === 'panel' || hash.startsWith('panel/')) {
    const requested = hash.split('/')[1] || 'home';
    const tab = tabs.some(entry => entry[2] === requested) ? requested : 'home';
    if (document.body.classList.contains('guest-mode') || current !== tab) showPanel(tab, false);
  } else if (!document.body.classList.contains('guest-mode')) {
    closeModal();
    setPortalMode(false);
  }
}
function showCentreInfo() {
  modal('Ośrodki licencjonowane STOP KRWOTOKOM SYSTEM',
    '<p>Ośrodek potrzebuje minimum dwóch autoryzowanych instruktorów, w tym ratownika medycznego i ratownika KPP. Koordynatorem merytorycznym jest ratownik medyczny będący instruktorem SKS.</p>' +
    '<p>Po zatwierdzeniu ośrodek otrzymuje własny identyfikator i może stosować swoje oznaczenie obok marki systemu na dokumentach.</p>' +
    '<p style="margin-top:14px"><a class="button secondary" href="mailto:stop@h-core.edu.pl">Zapytaj o licencję ośrodka</a></p>');
}

document.getElementById('modal').addEventListener('click', event => {
  if (event.target.id === 'modal') closeModal();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeModal(); setPublicMenu(false); }
});
document.getElementById('mainPublicNav')?.addEventListener('click', event => {
  if (event.target.closest('a[href^="#"]')) setPublicMenu(false);
});
window.addEventListener('hashchange', syncRouteFromAddress);
window.addEventListener('sk:access', () => {
  if (!document.body.classList.contains('guest-mode')) {
    nav(); updatePortalChrome(); draw();
  }
});
if (window.SKAuth?.isConfigured()) window.SKAuth.init().catch(() => {});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && window.SKAuth?.isConfigured()) window.SKAuth.refresh();
});
go('home', false);
syncRouteFromAddress();
