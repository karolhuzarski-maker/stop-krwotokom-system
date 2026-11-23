'use strict';

// Publiczna strona i portal korzystają z rzeczywistej sesji Supabase.
// Moduły szkoleń i certyfikatów są udostępniane dopiero po podłączeniu rejestrów.
const tabs = [
  ['Pulpit', '▦', 'home'],
  ['Moje szkolenia', '▤', 'courses'],
  ['Dodaj szkolenie', '＋', 'addCourse'],
  ['Materiały', '▥', 'materials'],
  ['Mój profil i ID', '♙', 'profile'],
  ['Weryfikacja certyfikatu', '◇', 'verify']
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

function nav() {
  const state = getAuthState();
  document.getElementById('nav').innerHTML = tabs.filter(tab => ['courses','addCourse','materials','profile'].includes(tab[2])).map(tab => {
    const locked = !isSignedIn(state);
    return '<button type="button" class="nav-item ' + (current === tab[2] ? 'active ' : '') +
      (locked ? 'nav-guest' : '') + '" onclick="go(\'' + tab[2] + '\')">' +
      '<span class="nav-icon">' + tab[1] + '</span><span class="nav-label">' + tab[0] + '</span>' +
      (locked ? '<span class="nav-lock" aria-label="Wymaga zalogowania">🔒</span>' : '') + '</button>';
  }).join('') +
  '<button type="button" class="nav-verify-link" onclick="go(\'verify\')">◇ Sprawdź certyfikat</button>';
}

function updatePortalChrome() {
  const state = getAuthState();
  const signed = isSignedIn(state);
  const status = document.getElementById('portal-status');
  const controls = document.getElementById('portal-controls');
  status.className = 'pill' + (state.mode === 'active' ? '' : ' visitor');
  status.textContent = state.mode === 'active' ? 'Instruktor · aktywny' :
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
