
'use strict';
const tabs=[['Pulpit','▦','home'],['Moje szkolenia','▤','courses'],['Dodaj szkolenie','＋','addCourse'],['Uczestnicy kursu','☑','participants'],['Certyfikaty kursu','▣','certificates'],['Materiały','▥','materials'],['Mój profil i ID','♙','profile'],['Weryfikacja certyfikatu','◇','verify'],['Logowanie','↳','login'],['Instruktorzy · administracja','♧','admin'],['Raporty · administracja','◫','reports']];
let current='home', selectedCourse=1;
let portalAuthenticated=false; // UI state only; permissions are enforced by PostgreSQL.
const mk=(text)=>String(text??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const dateFormat=d=>new Date(d+'T12:00:00').toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'});
const guestCards = [
 {name:'courses',icon:'▤',title:'Moje szkolenia',detail:'Lista szkoleń, uczestnicy, dokumentacja ćwiczeń i certyfikaty.'},
 {name:'addCourse',icon:'＋',title:'Dodaj szkolenie',detail:'Tworzenie nowego terminu kursu w systemie.'},
 {name:'materials',icon:'▥',title:'Materiały',detail:'Prezentacja, podręcznik, karty obserwacji i wzory dokumentów.'},
 {name:'profile',icon:'♙',title:'Mój profil i ID',detail:'Indywidualny numer instruktora i status autoryzacji.'},
 {name:'centres',icon:'⌂',title:'Centra szkoleniowe',detail:'Wykaz licencjonowanych ośrodków STOP KRWOTOKOM SYSTEM.'}
];
// Płaska nawigacja: wszystkie 5 pozycji w jednej kolumnie, bez podmenu.
function nav(){
 const active = ['participants','certificates'].includes(current)?'courses':current;
 document.getElementById('nav').innerHTML=portalNavTabs().map(t=>{
  const action=t[2]==='addCourse'?'openAddCourse()':`go('${t[2]}')`;
  const locked=!portalAuthenticated && t[2]!=='home';
  return `<button type="button" class="nav-item ${active===t[2]?'active':''} ${locked?'nav-guest':''}" onclick="${action}"><span class="nav-icon">${t[1]}</span><span class="nav-label">${t[0]}</span>${locked?'<span class="nav-lock" aria-label="Wymaga logowania">🔒</span>':''}</button>`;
 }).join('')+`<button type="button" class="nav-verify-link" onclick="go('verify')">◇ Sprawdź certyfikat</button>`;
}
function guestHeader(){return `<div class="portal-guest-callout"><div><b>Przeglądasz panel bez logowania</b><p>Możesz zobaczyć, jak działa portal STOP KRWOTOKOM SYSTEM. Dodawanie kursów, dokumentowanie ćwiczeń i pełna biblioteka będą dostępne dla zatwierdzonych instruktorów.</p></div><div class="actions"><button class="button" onclick="authPrompt()">Zaloguj się / Zarejestruj</button></div></div>`;}

function openCentresWindow(){
  // Standalone preview in a fresh tab; no public list has been published yet.
  const page=`<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Licencjonowane ośrodki | STOP KRWOTOKOM SYSTEM</title></head><body><header class="top">STOP KRWOTOKOM SYSTEM</header><main class="wrap"><div class="eyebrow">Polski system kontroli krwotoków</div><h1>Licencjonowane ośrodki</h1><p>W tej sekcji będzie dostępny wykaz placówek posiadających aktywną licencję STOP KRWOTOKOM SYSTEM.</p><div class="grid"><section class="card"><h2>Wykaz ośrodków</h2><div class="notice"><b>Wersja demonstracyjna</b><div>Nie opublikowano jeszcze listy zatwierdzonych ośrodków.</div></div><p class="muted">W wersji produkcyjnej: nazwa, miejscowość, ID ośrodka i status licencji.</p></section><section class="card"><h2>Warunki uzyskania licencji</h2><p>Minimum dwóch autoryzowanych instruktorów STOP KRWOTOKOM SYSTEM: ratownik medyczny oraz ratownik KPP. Koordynatorem merytorycznym jest ratownik medyczny będący autoryzowanym instruktorem programu.</p><p>Ośrodek może prowadzić szkolenia pod własną nazwą i umieszczać swoje logo obok STOP KRWOTOKOM SYSTEM na certyfikatach.</p></section></div></main></body></html>`;
  const tab=window.open('about:blank','_blank');
  if(!tab){alert('Przeglądarka zablokowała nową kartę. Zezwól na otwieranie nowych kart dla tego pliku.');return;}
  tab.document.open();tab.document.write(page);tab.document.close();tab.opener=null;
}

function guestTeaser(item){const isCentres=item.name==='centres';const action=isCentres?'openCentresWindow()':"authPrompt('"+item.title+"')";return `<button class="lock-card" onclick="${action}" type="button"><span class="lock-icon">${item.icon}</span><b>${item.title}</b><small>${item.detail}</small><span class="lock-foot">${isCentres?'OTWÓRZ W NOWEJ KARCIE ↗':'🔒  ZOBACZ WARUNKI DOSTĘPU ↗'}</span></button>`;}
function drawGuest(){
 const v=document.getElementById('view');
 if(current==='verify')return; // Ta funkcja jest otwarta dla gości; obsłuży ją zwykły widok.
 const item=guestCards.find(x=>x.name===current);
 if(current==='home'){
  v.innerHTML=guestHeader()+head('Portal instruktora','Wszystkie główne funkcje są widoczne bez konta. Instruktor korzysta z nich po zatwierdzeniu dostępu.')+
    `<div class="lock-grid">${guestCards.map(guestTeaser).join('')}</div>`+
    `<div class="guest-intro"><h2>Co otrzymuje instruktor?</h2><p>Po kursie i autoryzacji instruktor otrzymuje dostęp do materiałów, dodawania szkoleń, dokumentowania wykonanych ćwiczeń i wydawania certyfikatów. Każdy instruktor posiada jedno stałe ID.</p><div class="inline-actions" style="margin-top:16px"><button class="button secondary" onclick="authPrompt()">Jak uzyskać dostęp?</button><button class="ghost-demo" onclick="backPublic()">Wróć do oferty kursu</button></div></div>`;
 }else if(item){
  const snippets={
    courses:['Lista kursów i terminów','Uczestnicy przypisani do kursu','Certyfikaty wystawiane z poziomu kursu'],
    addCourse:['Wybór daty i miejsca','Liczba uczestników i program','Zapis kursu w systemie'],
    materials:['Podręcznik i prezentacja szkolenia','Karty obserwacji ćwiczeń','Wzór certyfikatu i materiały do druku'],
    profile:['Indywidualny identyfikator','Status autoryzacji','Historia prowadzenia szkoleń']
  };
  v.innerHTML=guestHeader()+head(item.title,'Ta sekcja jest widoczna, ale jej pełne funkcje wymagają zatwierdzonego konta instruktora.')+
   `<div class="guest-intro"><span class="tag gold">PODGLĄD · DOSTĘP OGRANICZONY</span><h2 style="margin-top:14px">${item.title}</h2><p>${item.detail}</p><div style="margin:17px 0">${(snippets[current]||[]).map((x,i)=>`<div class="module"><span class="module-icon">${i+1}</span><span class="module-body"><b>${x}</b><small>${i===0?'Funkcja dostępna po aktywacji konta':'Dostęp dla autoryzowanych instruktorów'}</small></span><span class="tag">🔒</span></div>`).join('')}</div><button class="button" onclick="authPrompt('${item.title}')">🔒 Odblokuj dostęp</button><p class="guest-note">Możesz także przejrzeć pozostałe sekcje w menu po lewej. To wersja poglądowa — bez przechowywania danych.</p></div>`;
 }else go('home',false);
}
function head(title,sub,button=''){return `<div class="page-head"><div><div class="eyebrow">STOP KRWOTOKOM SYSTEM</div><h1>${title}</h1><p>${sub}</p></div>${button}</div>`;}
function closeModal(){document.getElementById('modal').classList.remove('show');}
function modal(title,body){document.getElementById('modalContent').innerHTML=`<div class="modal-head"><h2>${title}</h2><button aria-label="Zamknij" class="close" onclick="closeModal()">✕</button></div>${body}`;document.getElementById('modal').classList.add('show');}
function setPublicMenu(open){
  document.getElementById('mainPublicNav')?.classList.toggle('open',open);
  document.querySelector('.mobile-menu-btn')?.setAttribute('aria-expanded',String(open));
}
function togglePublicMenu(){
  setPublicMenu(!document.getElementById('mainPublicNav')?.classList.contains('open'));
}
function scrollPublic(id){
  setPublicMenu(false);
  document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}
// Jednoznaczne sterowanie strefą publiczną i panelem — bez pozostawiania stylów inline.
function setPortalMode(panel){
  const visitor=document.getElementById('visitor');
  visitor.style.removeProperty('display');
  document.querySelector('.shell').style.removeProperty('display');
  document.body.classList.toggle('guest-mode',!panel);
  setPublicMenu(false);
}
function showPanel(tab='home', updateAddress=true){
  closeModal();
  setPortalMode(true);
  go(tab,false);
  if(updateAddress){
    const target='#panel/'+tab;
    if(location.hash!==target)location.hash=target;
  }
}
function backPublic(){
  closeModal();
  portalAuthenticated=false;
  setPortalMode(false);
  if(location.hash!=='#start')location.hash='#start';
  window.scrollTo({top:0,behavior:'instant'});
}
// Przywrócenie właściwego ekranu po odświeżeniu i po użyciu Wstecz/Dalej.
function showSignupDemo(){modal('Jak będzie działał zapis',`<div class="module"><span class="module-icon">1</span><span class="module-body"><b>Wybierz termin</b><small>Wybór dostępnej grupy instruktorskiej</small></span></div><div class="module"><span class="module-icon">2</span><span class="module-body"><b>Uzupełnij dane i zapłać</b><small>Formularz i Stripe/BLIK — do podłączenia</small></span></div><div class="module"><span class="module-icon">3</span><span class="module-body"><b>Otrzymaj materiały przed kursem</b><small>Link do przygotowania, bez tworzenia konta instruktora</small></span></div><div class="notice" style="margin-top:17px">To wyłącznie demonstracja ścieżki. Zapisy i płatności nie działają w tym prototypie.</div><div class="inline-actions" style="justify-content:flex-end;margin-top:18px"><button class="button" onclick="closeModal()">Rozumiem</button></div>`);}

function showMaterialSample(which){const title=which==='skrypt'?'Przykładowy skrypt kursanta':'Przykładowa karta zaliczenia';const content=which==='skrypt'?['Bezpieczeństwo i wezwanie pomocy','Rozpoznawanie masywnych krwotoków','Ucisk bezpośredni i opaska uciskowa','Wypełnianie ran treningowych','Specyfika kontroli krwotoków u dzieci']:['Ocena bezpieczeństwa i alarmowanie','Założenie opaski uciskowej i ocena skuteczności','Ucisk bezpośredni i wypełnianie rany','Ucisk bezpośredni z użyciem dostępnej odzieży','Obserwacja ćwiczeń i korekta błędów'];modal(title,`<p>To podgląd zakresu planowanych materiałów. Pełne pliki PDF nie są jeszcze podłączone.</p><div class="card" style="margin-top:20px"><h3>Zawartość pakietu</h3>${content.map((t,i)=>`<div class="module"><span class="module-icon">${i+1}</span><span class="module-body"><b>${t}</b></span></div>`).join('')}</div><div style="text-align:right;margin-top:15px"><button class="button" onclick="closeModal()">Zamknij</button></div>`)}
document.getElementById('modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();setPublicMenu(false)}});
document.getElementById('mainPublicNav')?.addEventListener('click',e=>{
  if(e.target.closest('a[href^="#"]'))setPublicMenu(false);
});

function showCentreInfo(){modal('Ośrodki licencjonowane STOP KRWOTOKOM SYSTEM',`<p>Ośrodek potrzebuje minimum <b>2 autoryzowanych instruktorów STOP KRWOTOKOM SYSTEM</b>: <b>1 ratownika medycznego</b> i <b>1 ratownika KPP</b>. Koordynator merytoryczny musi być ratownikiem medycznym i autoryzowanym instruktorem programu.</p><p>Po zatwierdzeniu placówka otrzymuje ID ośrodka i może umieszczać własne logo obok marki STOP KRWOTOKOM SYSTEM na certyfikatach kursantów.</p><div class="notice" style="margin-top:15px">Zasady mają charakter projektowy. Ta makieta nie przyjmuje wniosków licencyjnych.</div><div style="text-align:right;margin-top:18px"><button class="button" onclick="closeModal()">Zamknij</button></div>`);}
