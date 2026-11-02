
'use strict';
const tabs=[['Pulpit','▦','home'],['Moje szkolenia','▤','courses'],['Dodaj szkolenie','＋','addCourse'],['Uczestnicy kursu','☑','participants'],['Certyfikaty kursu','▣','certificates'],['Materiały','▥','materials'],['Mój profil i ID','♙','profile'],['Weryfikacja certyfikatu','◇','verify'],['Logowanie','↳','login'],['Instruktorzy · administracja','♧','admin'],['Raporty · administracja','◫','reports']];
let current='home', selectedCourse=1;
let portalAuthenticated=false; // WYŁĄCZNIE DEMO w przeglądarce, bez prawdziwego konta
let courses=[{id:1,title:'Kurs STOP KRWOTOKOM',city:'Kraków',date:'2026-11-14',limit:12,status:'Planowany'},{id:2,title:'Kurs STOP KRWOTOKOM',city:'Wrocław',date:'2026-10-10',limit:10,status:'Zakończony'}];
let people=[{id:1,courseId:2,name:'Anna Nowak (przykład)',q:[true,true,true],cert:'SK-R-2026-0001'},{id:2,courseId:2,name:'Jan Kowalski (przykład)',q:[true,false,true],cert:''}];
const mk=(text)=>String(text??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const dateFormat=d=>new Date(d+'T12:00:00').toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'});
const guestCards = [
 {name:'courses',icon:'▤',title:'Moje szkolenia',detail:'Lista szkoleń, uczestnicy, dokumentacja ćwiczeń i certyfikaty.'},
 {name:'addCourse',icon:'＋',title:'Dodaj szkolenie',detail:'Tworzenie nowego terminu kursu w systemie.'},
 {name:'materials',icon:'▥',title:'Materiały',detail:'Prezentacja, podręcznik, karty obserwacji i wzory dokumentów.'},
 {name:'profile',icon:'♙',title:'Mój profil i ID',detail:'Indywidualny numer instruktora i status autoryzacji.'},
 {name:'centres',icon:'⌂',title:'Centra szkoleniowe',detail:'Wykaz licencjonowanych ośrodków STOP KRWOTOKOM.'}
];
// Płaska nawigacja: wszystkie 5 pozycji w jednej kolumnie, bez podmenu.
function portalNavTabs(){return tabs.filter(t=>['courses','addCourse','materials','profile'].includes(t[2]));}
function openAddCourse(){
 if(!portalAuthenticated){authPrompt('dodawania szkolenia');return;}
 newCourse();
}
function nav(){
 const active = ['participants','certificates'].includes(current)?'courses':current;
 document.getElementById('nav').innerHTML=portalNavTabs().map(t=>{
  const action=t[2]==='addCourse'?'openAddCourse()':`go('${t[2]}')`;
  const locked=!portalAuthenticated && t[2]!=='home';
  return `<button type="button" class="nav-item ${active===t[2]?'active':''} ${locked?'nav-guest':''}" onclick="${action}"><span class="nav-icon">${t[1]}</span><span class="nav-label">${t[0]}</span>${locked?'<span class="nav-lock" aria-label="Wymaga logowania">🔒</span>':''}</button>`;
 }).join('')+`<button type="button" class="nav-verify-link" onclick="go('verify')">◇ Sprawdź certyfikat</button>`;
}
function updatePortalChrome(){
 const status=document.getElementById('portal-status');
 const controls=document.getElementById('portal-controls');
 if(portalAuthenticated){
  status.className='pill';status.innerHTML='<span class="dot"></span> Instruktor · demonstracja';
  controls.innerHTML='<button class="ghost-demo" onclick="logoutDemo()">Wyloguj (demo)</button>';
 }else{
  status.className='pill visitor';status.textContent='Gość · podgląd funkcji';
  controls.innerHTML='<button class="ghost-demo" onclick="authPrompt()">Zaloguj się / Zarejestruj</button>';
 }
}
function go(name, updateAddress=true){
 if(!tabs.some(t=>t[2]===name && !name.startsWith('sep')))name='home';
 if(['admin','reports','login'].includes(name))name='home';
 if(name==='addCourse'){openAddCourse();return;}
 current=name;
 nav();updatePortalChrome();
 document.getElementById('crumb').textContent=(name==='participants'?'Moje szkolenia / Uczestnicy i certyfikaty':name==='certificates'?'Moje szkolenia / Certyfikaty':(tabs.find(x=>x[2]===name)?.[0]||'Panel instruktora'));
 draw();
 window.scrollTo(0,0);
 if(updateAddress && !document.body.classList.contains('guest-mode')){
  const target='#panel/'+name;
  if(location.hash!==target)location.hash=target;
 }
}
function guestHeader(){return `<div class="portal-guest-callout"><div><b>Przeglądasz panel bez logowania</b><p>Możesz zobaczyć, jak działa portal STOP KRWOTOKOM. Dodawanie kursów, dokumentowanie ćwiczeń i pełna biblioteka będą dostępne dla zatwierdzonych instruktorów.</p></div><div class="actions"><button class="button" onclick="authPrompt()">Zaloguj się / Zarejestruj</button></div></div>`;}

function openCentresWindow(){
  // Standalone preview in a fresh tab; no public list has been published yet.
  const page=`<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Licencjonowane ośrodki | STOP KRWOTOKOM</title></head><body><header class="top">STOP KRWOTOKOM</header><main class="wrap"><div class="eyebrow">Polski system kontroli krwotoków</div><h1>Licencjonowane ośrodki</h1><p>W tej sekcji będzie dostępny wykaz placówek posiadających aktywną licencję STOP KRWOTOKOM.</p><div class="grid"><section class="card"><h2>Wykaz ośrodków</h2><div class="notice"><b>Wersja demonstracyjna</b><div>Nie opublikowano jeszcze listy zatwierdzonych ośrodków.</div></div><p class="muted">W wersji produkcyjnej: nazwa, miejscowość, ID ośrodka i status licencji.</p></section><section class="card"><h2>Warunki uzyskania licencji</h2><p>Minimum dwóch autoryzowanych instruktorów STOP KRWOTOKOM: ratownik medyczny oraz ratownik KPP. Koordynatorem merytorycznym jest ratownik medyczny będący autoryzowanym instruktorem programu.</p><p>Ośrodek może prowadzić szkolenia pod własną nazwą i umieszczać swoje logo obok STOP KRWOTOKOM na certyfikatach.</p></section></div></main></body></html>`;
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
function authPrompt(target='panelu instruktora'){
 modal('Dostęp do '+target,`<p>Pełne funkcje portalu są przeznaczone dla zatwierdzonych instruktorów programu STOP KRWOTOKOM. Możesz przeglądać opisy sekcji bez konta.</p><div class="access-choices"><div class="access-choice"><h3>Masz już konto?</h3><p>Zaloguj się, aby przejść do szkoleń, materiałów i certyfikatów.</p><button class="button" onclick="showAuthInfo('login')">Zaloguj się</button></div><div class="access-choice"><h3>Chcesz zostać instruktorem?</h3><p>Rejestracja konta i dostęp instruktorski wymagają zatwierdzenia przez organizatora.</p><button class="button secondary" onclick="showAuthInfo('register')">Zarejestruj się</button></div></div>`);
}
function showAuthInfo(action){
 if(action==='register'){
  modal('Rejestracja — w przygotowaniu',`<p>Tu docelowo powstanie formularz rejestracji. Po zgłoszeniu i weryfikacji uprawnień administrator aktywuje dostęp do panelu.</p><div class="notice" style="margin:16px 0">W tym prototypie <b>nie tworzymy prawdziwych kont</b> i nie zbieramy danych osobowych.</div><div class="inline-actions" style="justify-content:flex-end"><button class="button secondary" onclick="closeModal()">Zamknij</button><button class="button" onclick="closeModal();backPublic();scrollPublic('instruktor')">Zobacz kurs instruktorski</button></div>`);
 }else{
  modal('Logowanie — podgląd działania',`<p>Po wdrożeniu wpiszesz tutaj dane swojego konta instruktorskiego. W tej wersji nie ma jeszcze serwera ani prawdziwego logowania.</p><div class="notice" style="margin:16px 0">Aby obejrzeć, co zobaczy zatwierdzony instruktor, przejdź do przykładowego konta demonstracyjnego. <b>Nie wpisuj tutaj prawdziwych haseł.</b></div><div class="inline-actions" style="justify-content:flex-end"><button class="button secondary" onclick="closeModal()">Wróć</button><button class="button" onclick="loginDemo()">Pokaż widok po zalogowaniu (demo) ↗</button></div>`);
 }
}
function loginDemo(){portalAuthenticated=true;closeModal();go('home');}
function logoutDemo(){portalAuthenticated=false;closeModal();go('home');}
function head(title,sub,button=''){return `<div class="page-head"><div><div class="eyebrow">STOP KRWOTOKOM</div><h1>${title}</h1><p>${sub}</p></div>${button}</div>`;}
function draw(){if(!portalAuthenticated && current!=='verify'){drawGuest();return;}const v=document.getElementById('view');
if(current==='home')v.innerHTML=head('Pulpit instruktora','Najważniejsze informacje, nadchodzące szkolenia i szybkie działania.',`<button class="button" onclick="newCourse()">+ Dodaj szkolenie</button>`)+`<div class="grid" style="margin-bottom:19px"><section class="card stat"><p>Moje szkolenia</p><div class="number">${courses.length}</div><em>przykładowa ewidencja</em></section><section class="card stat"><p>Wydane certyfikaty</p><div class="number">${people.filter(p=>p.cert).length}</div><em>wewnętrzny rejestr systemu</em></section><section class="card stat"><p>Status instruktora</p><div class="number" style="font-size:22px;color:var(--green);padding-top:8px">Aktywny</div><em>przykładowa autoryzacja</em></section></div><div class="two"><section class="card"><h2>Ostatnie szkolenia</h2>${courseTable(courses.slice(0,3))}</section><section class="card"><h2>Szybki dostęp</h2><div class="module"><span class="module-icon">▥</span><span class="module-body"><b>Biblioteka materiałów</b><small>Slajdy, arkusze, scenariusze</small></span><button class="button secondary sm" onclick="go('materials')">Otwórz</button></div><div class="module"><span class="module-icon">▤</span><span class="module-body"><b>Moje szkolenia</b><small>Uczestnicy i certyfikaty przy każdym kursie</small></span><button class="button secondary sm" onclick="go('courses')">Otwórz</button></div><div class="module"><span class="module-icon">♙</span><span class="module-body"><b>Profil instruktora</b><small>ID i autoryzacja</small></span><button class="button secondary sm" onclick="go('profile')">Otwórz</button></div><div class="module"><span class="module-icon">⌂</span><span class="module-body"><b>Centra szkoleniowe</b><small>Wykaz licencjonowanych ośrodków</small></span><button class="button secondary sm" onclick="openCentresWindow()">Nowa karta ↗</button></div></section></div>`;
else if(current==='courses')v.innerHTML=head('Moje szkolenia','Lista kursów i formularz dodawania kolejnych terminów.',`<button class="button" onclick="newCourse()">+ Dodaj szkolenie</button>`)+`<div class="card"><h2>Zaplanowane i zakończone</h2>${courseTable(courses)}</div><div class="notice" style="margin-top:16px">Każdy kurs ma listę uczestników, zapis wymaganych ćwiczeń i rejestr wystawionych certyfikatów.</div>`;
else if(current==='participants'){const opts=courses.map(c=>`<option value="${c.id}" ${selectedCourse===c.id?'selected':''}>${mk(c.title)} · ${mk(c.city)} · ${dateFormat(c.date)}</option>`).join(''); const cp=people.filter(p=>p.courseId===selectedCourse);v.innerHTML=head('Uczestnicy i ćwiczenia','Certyfikat jest dostępny po potwierdzeniu wykonania wszystkich wymaganych ćwiczeń. Nie ma egzaminu końcowego kursanta.',`<button class="button" onclick="addParticipant()">+ Dodaj uczestnika</button>`)+`<div class="card"><div class="field" style="max-width:520px;margin-bottom:18px"><label>Wybierz szkolenie</label><select onchange="selectedCourse=Number(this.value);draw()">${opts}</select></div><table class="table"><thead><tr><th>Uczestnik</th><th>Opaska</th><th>Wypełnianie rany</th><th>Ucisk bezpośredni</th><th>Ćwiczenia</th><th></th></tr></thead><tbody>${cp.map(p=>`<tr><td><b>${mk(p.name)}</b></td>${p.q.map((q,i)=>`<td><input aria-label="Potwierdzenie wykonania ćwiczenia ${i+1}" type="checkbox" ${q?'checked':''} onchange="togglePass(${p.id},${i},this.checked)"></td>`).join('')}<td><span class="tag ${p.q.every(Boolean)?'green':'gold'}">${p.q.every(Boolean)?'Wykonał':'W trakcie'}</span></td><td>${p.cert?`<button class="button secondary sm" onclick="showCertificate(${p.id})">Certyfikat</button>`:`<button class="button sm" ${p.q.every(Boolean)?'':'disabled style="opacity:.35;cursor:not-allowed"'} onclick="issue(${p.id})">Wystaw wzór</button>`}</td></tr>`).join('')||'<tr><td colspan="6">Brak uczestników tego szkolenia.</td></tr>'}</tbody></table></div><p class="subtle" style="margin-top:13px">W produkcyjnym systemie zaliczenia zapisuje uprawniony egzaminator z datą i śladem audytowym. W demie stan resetuje się po odświeżeniu.</p>`;}
else if(current==='certificates')v.innerHTML=head('Certyfikaty','Rejestr dokumentów, podgląd i kontrola autentyczności.')+`<div class="card"><h2>Wydane certyfikaty uczestników (demonstracja)</h2><table class="table"><thead><tr><th>Instruktor ID</th><th>Uczestnik</th><th>Program</th><th>Status</th><th></th></tr></thead><tbody>${people.filter(p=>p.cert).map(p=>`<tr><td><b>SK-I-2026-0001</b></td><td>${mk(p.name)}</td><td>STOP KRWOTOKOM</td><td><span class="tag green">Ważny · DEMO</span></td><td><button class="button secondary sm" onclick="showCertificate(${p.id})">Podgląd</button></td></tr>`).join('')||'<tr><td colspan="5">Brak wydanych certyfikatów.</td></tr>'}</tbody></table></div><div class="notice" style="margin-top:16px">Na certyfikacie kursanta pokazujemy wyłącznie <b>ID instruktora</b>. Każdy dokument ma w bazie niewidoczny identyfikator i osobny token QR służący do weryfikacji konkretnego ukończenia kursu.</div>`;
else if(current==='materials')v.innerHTML=head('Materiały dla instruktorów','Biblioteka wersjonowanych, autorskich materiałów dostępnych dla aktywnych instruktorów.')+`<div class="grid"><section class="card span2"><h2>STOP KRWOTOKOM 1.0 · Pakiet podstawowy</h2>${[['▤','Prezentacja kursu','Slajdy do nauczania — plik PDF/PPTX'],['▧','Podręcznik instruktora','Metodyka, standardy i błędy krytyczne'],['☑','Karty umiejętności','Opaska uciskowa, wypełnianie rany, decyzje świadka'],['◈','Scenariusze ćwiczeń','Praktyczne tamowanie krwotoków, w tym bez apteczki'],['▣','Wzory dokumentów','Lista obecności, karta ćwiczeń, wzór certyfikatu']].map(([ico,note,detail])=>`<div class="module"><span class="module-icon">${ico}</span><span class="module-body"><b>${note}</b><small>${detail}</small></span><span class="tag">Do dodania</span></div>`).join('')}</section><section class="card"><h2>Aktualizacje</h2><p>Instruktor powinien zawsze wiedzieć, z której wersji programu korzysta.</p><div class="notice" style="margin-top:18px"><b>Przykład:</b><br>STOP KRWOTOKOM 1.0 · październik 2026<br><br>Wersja demonstracyjna — pliki źródłowe nie zostały jeszcze podłączone.</div></section></div>`;
else if(current==='profile')v.innerHTML=head('Mój profil i ID','Dane instruktora, certyfikat i zakres autoryzacji — przykład.')+`<div class="grid"><div class="card span2"><div class="badgeid"><div class="eyebrow">STOP KRWOTOKOM</div><strong>INSTRUKTOR</strong><div class="line"></div><b>Przykładowy Instruktor</b><div class="id">SK-I-2026-0001</div><p style="margin-top:12px"><span class="tag green">Autoryzacja aktywna · DEMO</span></p><p class="subtle" style="margin-top:11px">Zakres: Kurs STOP KRWOTOKOM</p></div></div><div class="card"><h2>Warunki autoryzacji</h2><p>Autoryzacja do prowadzenia programu i korzystania z materiałów wynika z umowy, nie z samego certyfikatu instruktorskiego.</p><div class="notice" style="margin-top:16px">Termin ważności, doskonalenie i odnowienie powinny wynikać z Twojego regulaminu instruktorskiego.</div></div></div>`;
else if(current==='verify')v.innerHTML=head('Weryfikacja','Identyfikator instruktora może być publiczny, certyfikaty kursantów weryfikujemy indywidualnym kodem QR.')+`<div class="card" style="max-width:710px"><h2>Sprawdź instruktora</h2><p style="margin-bottom:17px">Wersja demonstracyjna: wpisz <b>SK-I-2026-0001</b>.</p><form class="form" onsubmit="event.preventDefault();verifyCode()"><div class="field full"><label>ID instruktora</label><input id="verifycode" placeholder="SK-I-2026-0001" value="SK-I-2026-0001" required></div><div class="full"><button class="button" type="submit">Sprawdź</button></div></form><div id="verifyout" style="margin-top:20px"></div><div class="notice" style="margin-top:15px">Jeden instruktor może prowadzić setki szkoleń. Samo jego ID nie potwierdza autentyczności konkretnego certyfikatu kursanta — do tego służy osobny token w kodzie QR.</div></div>`;
else if(current==='login')v.innerHTML=head('Dostęp instruktorski','We wdrożeniu konta będą aktywowane wyłącznie po zatwierdzeniu instruktora.')+`<div class="card" style="max-width:550px"><h2>Logowanie — projekt</h2><p>W prawdziwym portalu zalogujesz się adresem e-mail i hasłem albo bezpiecznym linkiem jednorazowym. Tu nie ma serwera logowania — nie wpisuj prawdziwych haseł.</p><button class="button" style="margin-top:18px" onclick="go('home')">Otwórz demonstrację panelu</button><button class="button secondary" style="margin:18px 0 0 8px" onclick="backPublic()">Strona publiczna</button></div>`;
else if(current==='admin')v.innerHTML=head('Zarządzanie instruktorami','Dostęp tylko dla administratora ośrodka — widok poglądowy.')+`<div class="grid"><section class="card stat"><p>Kandydaci do zatwierdzenia</p><div class="number">2</div><em>dane przykładowe</em></section><section class="card stat"><p>Aktywne autoryzacje</p><div class="number">1</div><em>dane przykładowe</em></section><section class="card stat"><p>Autoryzacje wygasłe</p><div class="number">0</div><em>dane przykładowe</em></section></div><div class="card" style="margin-top:18px"><h2>Proces zatwierdzenia instruktora</h2><div class="module"><span class="module-icon">1</span><span class="module-body"><b>Sprawdzenie kwalifikacji i egzaminu</b><small>Administrator przegląda dowody zaliczenia i dokumenty.</small></span></div><div class="module"><span class="module-icon">2</span><span class="module-body"><b>Podpisanie umowy autoryzacyjnej</b><small>Zakres szkolenia, materiały, znak, okres obowiązywania.</small></span></div><div class="module"><span class="module-icon">3</span><span class="module-body"><b>Nadanie ID i dostępu</b><small>Automatyczne wygenerowanie numeru i dostęp do materiałów.</small></span></div></div>`;
else if(current==='reports')v.innerHTML=head('Raporty i nadzór','Kontrola jakości wszystkich instruktorów i szkoleń.')+`<div class="card"><h2>Raportowanie — zakres MVP</h2>${[['Liczba kursów','Terminy z podziałem na miasto, program i instruktora'],['Liczba uczestników','Osoby zapisane, obecne i zaliczone'],['Certyfikaty','Numery, daty i wyniki weryfikacji'],['Jakość','Skargi, korekty danych, cofnięte certyfikaty']].map(x=>`<div class="module"><span class="module-icon">◫</span><span class="module-body"><b>${x[0]}</b><small>${x[1]}</small></span></div>`).join('')}</div>`;
}
function courseTable(arr){return `<table class="table"><thead><tr><th>Program</th><th>Miejsce / data</th><th>Status</th><th></th></tr></thead><tbody>${arr.map(c=>`<tr><td><b>${mk(c.title)}</b></td><td>${mk(c.city)}<div class="subtle">${dateFormat(c.date)}</div></td><td><span class="tag ${c.status==='Zakończony'?'green':'gold'}">${c.status}</span></td><td><button class="button secondary sm" onclick="selectedCourse=${c.id};go('participants')">Uczestnicy</button></td></tr>`).join('')}</tbody></table>`;}
function closeModal(){document.getElementById('modal').classList.remove('show');}
function modal(title,body){document.getElementById('modalContent').innerHTML=`<div class="modal-head"><h2>${title}</h2><button aria-label="Zamknij" class="close" onclick="closeModal()">✕</button></div>${body}`;document.getElementById('modal').classList.add('show');}
function newCourse(){modal('Nowe szkolenie',`<form class="form" onsubmit="event.preventDefault();saveCourse()"><div class="field full"><label>Program</label><select id="ctitle"><option>Kurs STOP KRWOTOKOM</option><option>STOP KRWOTOKOM — kurs instruktorski</option></select></div><div class="field"><label>Miasto</label><input id="ccity" placeholder="Kraków" required maxlength="80"></div><div class="field"><label>Termin</label><input id="cdate" type="date" value="2026-11-14" required></div><div class="field"><label>Limit uczestników</label><input id="climit" type="number" min="1" max="200" value="12" required></div><div class="field"><label>Status</label><select id="cstatus"><option>Planowany</option><option>Zakończony</option></select></div><div class="full inline-actions" style="justify-content:flex-end"><button class="button secondary" type="button" onclick="closeModal()">Anuluj</button><button class="button" type="submit">Dodaj kurs w demie</button></div></form>`);}
function saveCourse(){const c={id:Math.max(...courses.map(c=>c.id))+1,title:document.getElementById('ctitle').value,city:document.getElementById('ccity').value.trim(),date:document.getElementById('cdate').value,limit:Number(document.getElementById('climit').value),status:document.getElementById('cstatus').value};if(!c.city||!c.date)return;courses.unshift(c);closeModal();go('courses');}
function addParticipant(){modal('Dodaj uczestnika (demo)',`<form class="form" onsubmit="event.preventDefault();saveParticipant()"><div class="field full"><label>Imię i nazwisko — użyj wyłącznie fikcyjnych danych</label><input id="pname" value="Przykładowa Uczestniczka" required maxlength="90"></div><div class="full inline-actions" style="justify-content:flex-end"><button class="button secondary" type="button" onclick="closeModal()">Anuluj</button><button class="button" type="submit">Dodaj do szkolenia</button></div></form>`);}
function saveParticipant(){const n=document.getElementById('pname').value.trim();if(!n)return;people.push({id:Math.max(...people.map(p=>p.id))+1,courseId:selectedCourse,name:n,q:[false,false,false],cert:''});closeModal();draw();}
function togglePass(id,i,val){let p=people.find(p=>p.id===id);if(!p)return;p.q[i]=val;if(p.cert&&!p.q.every(Boolean))p.cert='';draw();}
function issue(id){let p=people.find(p=>p.id===id);if(!p||!p.q.every(Boolean))return;const ids=people.map(p=>p.cert).filter(Boolean).map(x=>parseInt(x.slice(-4),10)||0);p.cert=`SK-R-2026-${String(Math.max(0,...ids)+1).padStart(4,'0')}`;draw();showCertificate(id);}
function showCertificate(id){let p=people.find(p=>p.id===id);if(!p||!p.cert)return;const course=courses.find(c=>c.id===p.courseId);modal('Certyfikat — wyłącznie wzór demonstracyjny',`<div class="certificate"><div class="eyebrow">STOP KRWOTOKOM</div><div class="huge">CERTYFIKAT</div><b>ukończenia szkolenia</b><div class="redbar"></div><p>Potwierdza się, że</p><strong class="name">${mk(p.name)}</strong><p>ukończył(a) szkolenie <b>${mk(course?.title||'STOP KRWOTOKOM')}</b> i wykonał(a) wymagane ćwiczenia praktyczne.</p><div class="redbar"></div><p>Instruktor prowadzący: <b>SK-I-2026-0001</b> · Data: ${dateFormat(course.date)}</p><p style="margin-top:8px;font-size:11px">Na rzeczywistym certyfikacie: indywidualny kod QR do weryfikacji. Bez widocznego numeru certyfikatu.</p><p style="margin-top:14px;font-size:11px">Dokument demonstracyjny, nieważny w rzeczywistym obrocie.</p></div><div class="inline-actions" style="justify-content:flex-end;margin-top:18px"><button class="button secondary" onclick="closeModal()">Zamknij</button><button class="button" onclick="window.print()">Drukuj wzór</button></div>`);}
function verifyCode(){const id=document.getElementById('verifycode').value.trim().toUpperCase();const ok=id==='SK-I-2026-0001';document.getElementById('verifyout').innerHTML=ok?`<div class="notice"><span class="tag green">Status demonstracyjny: aktywny</span><h3 style="margin-top:12px">${mk(id)}</h3><p>Przykładowy instruktor · program STOP KRWOTOKOM. To symulacja, nie prawdziwa weryfikacja.</p></div>`:`<div class="notice"><span class="tag red">Brak wpisu w demonstracji</span><p style="margin-top:8px">Sprawdzenie faktycznych uprawnień będzie możliwe dopiero po podłączeniu bazy.</p></div>`;}
function scrollPublic(id){document.getElementById(id)?.scrollIntoView({behavior:'smooth'});}
// Jednoznaczne sterowanie strefą publiczną i panelem — bez pozostawiania stylów inline.
function setPortalMode(panel){
  const visitor=document.getElementById('visitor');
  visitor.style.removeProperty('display');
  document.querySelector('.shell').style.removeProperty('display');
  document.body.classList.toggle('guest-mode',!panel);
  document.getElementById('mainPublicNav')?.classList.remove('open');
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
function demoEntry(){
  // Wejście z publicznej strony otwiera PANEL GOŚCIA, nigdy od razu konto instruktora.
  portalAuthenticated=false;
  showPanel('home');
}
function backPublic(){
  closeModal();
  portalAuthenticated=false;
  setPortalMode(false);
  if(location.hash!=='#start')location.hash='#start';
  window.scrollTo({top:0,behavior:'instant'});
}
// Przywrócenie właściwego ekranu po odświeżeniu i po użyciu Wstecz/Dalej.
function syncRouteFromAddress(){
  const hash=decodeURIComponent(location.hash.slice(1));
  if(hash==='panel' || hash.startsWith('panel/')){
    let tab=hash.split('/')[1]||'home';
    if(!tabs.some(t=>t[2]===tab && !tab.startsWith('sep')))tab='home';
    if(document.body.classList.contains('guest-mode') || current!==tab)showPanel(tab,false);
  }else if(!document.body.classList.contains('guest-mode')){
    closeModal();
    setPortalMode(false);
  }
}
function publicVerify(){const id=document.getElementById('public-instructor-id').value.trim().toUpperCase();document.getElementById('public-verify-result').innerHTML=id==='SK-I-2026-0001'?'<div class="notice"><span class="tag green">Przykładowe ID: aktywne (DEMO)</span><p style="margin-top:8px">Wersja demonstracyjna, bez dostępu do faktycznego rejestru.</p></div>':'<div class="notice"><span class="tag red">Nie znaleziono w danych demonstracyjnych</span><p style="margin-top:8px">Nie jest to informacja o rzeczywistej certyfikacji.</p></div>';}
function showSignupDemo(){modal('Jak będzie działał zapis',`<div class="module"><span class="module-icon">1</span><span class="module-body"><b>Wybierz termin</b><small>Wybór dostępnej grupy instruktorskiej</small></span></div><div class="module"><span class="module-icon">2</span><span class="module-body"><b>Uzupełnij dane i zapłać</b><small>Formularz i Stripe/BLIK — do podłączenia</small></span></div><div class="module"><span class="module-icon">3</span><span class="module-body"><b>Otrzymaj materiały przed kursem</b><small>Link do przygotowania, bez tworzenia konta instruktora</small></span></div><div class="notice" style="margin-top:17px">To wyłącznie demonstracja ścieżki. Zapisy i płatności nie działają w tym prototypie.</div><div class="inline-actions" style="justify-content:flex-end;margin-top:18px"><button class="button" onclick="closeModal()">Rozumiem</button></div>`);}

function showMaterialSample(which){const title=which==='skrypt'?'Przykładowy skrypt kursanta':'Przykładowa karta zaliczenia';const content=which==='skrypt'?['Bezpieczeństwo i wezwanie pomocy','Rozpoznawanie masywnych krwotoków','Ucisk bezpośredni i opaska uciskowa','Wypełnianie ran treningowych','Specyfika kontroli krwotoków u dzieci']:['Ocena bezpieczeństwa i alarmowanie','Założenie opaski uciskowej i ocena skuteczności','Ucisk bezpośredni i wypełnianie rany','Ucisk bezpośredni z użyciem dostępnej odzieży','Obserwacja ćwiczeń i korekta błędów'];modal(title,`<p>To podgląd zakresu planowanych materiałów. Pełne pliki PDF nie są jeszcze podłączone.</p><div class="card" style="margin-top:20px"><h3>Zawartość pakietu</h3>${content.map((t,i)=>`<div class="module"><span class="module-icon">${i+1}</span><span class="module-body"><b>${t}</b></span></div>`).join('')}</div><div style="text-align:right;margin-top:15px"><button class="button" onclick="closeModal()">Zamknij</button></div>`)}
document.getElementById('modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
window.addEventListener('hashchange',syncRouteFromAddress);
go('home',false);
syncRouteFromAddress();

function showCentreInfo(){modal('Ośrodki licencjonowane STOP KRWOTOKOM',`<p>Ośrodek potrzebuje minimum <b>2 autoryzowanych instruktorów STOP KRWOTOKOM</b>: <b>1 ratownika medycznego</b> i <b>1 ratownika KPP</b>. Koordynator merytoryczny musi być ratownikiem medycznym i autoryzowanym instruktorem programu.</p><p>Po zatwierdzeniu placówka otrzymuje ID ośrodka i może umieszczać własne logo obok marki STOP KRWOTOKOM na certyfikatach kursantów.</p><div class="notice" style="margin-top:15px">Zasady mają charakter projektowy. Ta makieta nie przyjmuje wniosków licencyjnych.</div><div style="text-align:right;margin-top:18px"><button class="button" onclick="closeModal()">Zamknij</button></div>`);}
