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

function nav() {
  const state = getAuthState();
  document.getElementById('nav').innerHTML = tabs.filter(tab => ['courses','addCourse','materials','profile'].includes(tab[2])).map(tab => {
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
  if (current === 'home' || current === 'profile') {
    const profileCard = '<div class="grid"><section class="card span2">' +
      '<div class="badgeid"><div class="eyebrow">STOP KRWOTOKOM SYSTEM</div>' +
      '<strong>INSTRUKTOR</strong><div class="line"></div>' +
      '<b>' + name + '</b><div class="id">' + id + '</div>' +
      '<p class="subtle" style="margin-top:12px">' + mk(state.email) + '</p>' +
      '<p style="margin-top:12px"><span class="tag ' + (active ? 'green' : 'gold') + '">' + status + '</span></p>' +
      '<p style="margin-top:12px"><b>Ważność licencji:</b> ' + expiry + '</p></div></section>' +
      '<section class="card"><h2>Twoje uprawnienia</h2>' +
      '<p>Numer SKS-I jest stały. O zakresie i ważności autoryzacji decyduje organizator.</p>' +
      '<a class="button secondary" style="display:inline-block;margin-top:18px" href="mailto:stop@h-core.edu.pl">Kontakt z organizatorem</a></section></div>';
    const notice = current === 'profile' ?
      '<p class="subtle" style="margin-top:20px">Licencja PDF i identyfikator do pobrania zostaną udostępnione w tej sekcji po uruchomieniu dokumentów.</p>' :
      '<p class="subtle" style="margin-top:20px">Ewidencja szkoleń, certyfikaty i biblioteka materiałów będą uruchamiane etapami.</p>';
    v.innerHTML = head(current === 'profile' ? 'Mój profil i ID' : 'Pulpit instruktora',
      current === 'profile' ? 'Twoje dane i status autoryzacji.' : 'Twoje konto instruktorskie.') + profileCard + notice;
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
