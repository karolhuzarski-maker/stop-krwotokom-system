'use strict';
// Client state renders UI only. RLS and checked RPCs enforce all permissions.
let skClient=null, skUser=null, skProfile=null, skAuthorization=null, skAdmin=false, skReady=false;
let skRecovery=new URLSearchParams(location.hash.slice(1)).get('type')==='recovery', skLoad=0;
let adminSection='requests', adminRows=[], adminFilter='';
const statusLabels={pending:'Oczekuje',approved:'Zaakceptowane',rejected:'Odrzucone',suspended:'Zawieszone'};
const warsawToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function authorizationStatus(a=skAuthorization,p=skProfile){
 if(!a)return 'Brak autoryzacji';
 if(p?.status==='suspended'||a.suspended)return 'Zawieszony';
 if(p?.status!=='approved')return 'Brak dostępu';
 const today=warsawToday();
 return today<a.starts_on?'Jeszcze nieaktywna':today>=a.ends_on?'Wygasły':'Aktywny';
}
function portalNavTabs(){return tabs.filter(t=>['courses','addCourse','materials','profile'].includes(t[2])).concat(skAdmin?[['Administracja','♧','admin']]:[]);}
function updatePortalChrome(){
 const status=document.getElementById('portal-status');
 status.className='pill'+(skUser?'':' visitor');
 status.textContent=!skReady?'Sprawdzanie sesji…':skUser?(skAdmin?'Administrator · ':'Konto · ')+(statusLabels[skProfile?.status]||'Ładowanie'):'Gość';
 document.getElementById('portal-controls').innerHTML=skUser?'<button class="ghost-demo" onclick="logoutDemo()">Wyloguj</button>':'<button class="ghost-demo" onclick="showPanel(\'login\')">Zaloguj się / Zarejestruj</button>';
 document.querySelector('.side-bottom').innerHTML='<b>STOP KRWOTOKOM SYSTEM</b><br/>H-CORE EDU · Centralny rejestr instruktorów';
 document.querySelector('.shell main > .alert').textContent='Konto i autoryzacja instruktorska są zatwierdzane osobno. Moduły szkoleń i certyfikatów są w przygotowaniu.';
}
function go(name,updateAddress=true){
 if(!['home','courses','addCourse','materials','profile','verify','login','register','reset','password','admin','participants','certificates'].includes(name))name='home';
 current=name; nav(); updatePortalChrome();
 document.getElementById('crumb').textContent=({admin:'Administracja',login:'Logowanie',register:'Rejestracja',reset:'Reset hasła',password:'Nowe hasło'}[name]||tabs.find(t=>t[2]===name)?.[0]||'Panel instruktora');
 draw(); window.scrollTo(0,0);
 if(updateAddress&&!document.body.classList.contains('guest-mode'))history.replaceState(null,'','#panel/'+name);
}
function demoEntry(){showPanel(skUser?'home':'login');}
function authPrompt(){showPanel('login');}
function showAuthInfo(action){showPanel(action==='register'?'register':'login');}
function loginDemo(){showPanel('login');}
async function logoutDemo(){
 if(!skClient)return;
 const {error}=await skClient.auth.signOut();
 if(error){modal('Nie udało się wylogować',`<p>${mk(friendlyError(error))}</p>`);return;}
 clearAccount(); skRecovery=false; closeModal(); showPanel('login');
}
function clearAccount(){skUser=null;skProfile=null;skAuthorization=null;skAdmin=false;portalAuthenticated=false;adminRows=[];skLoad++;}
function syncRouteFromAddress(){
 // Auth callback owns the fragment until Supabase consumes it. Never overwrite tokens.
 if(/^#(?:access_token=|error=)/.test(location.hash)||new URLSearchParams(location.search).has('code'))return;
 const match=location.hash.match(/^#panel(?:\/([A-Za-z]+))?$/);
 if(match){setPortalMode(true);go(match[1]||'home',false);}
 else setPortalMode(false);
}
function field(label,name,type='text',extra=''){return `<div class="field full"><label for="auth-${name}">${label}</label><input id="auth-${name}" name="${name}" type="${type}" required ${extra}></div>`;}
function authView(mode){
 const title={login:'Logowanie',register:'Rejestracja',reset:'Reset hasła',password:'Ustaw nowe hasło'}[mode];
 const configured=!!skClient;
 let inputs='';
 if(mode==='register')inputs+=field('Imię','first_name','text','maxlength="80" autocomplete="given-name"')+field('Nazwisko','last_name','text','maxlength="80" autocomplete="family-name"');
 if(mode!=='password')inputs+=field('Adres e-mail','email','email','autocomplete="email" maxlength="254"');
 if(mode!=='reset')inputs+=field('Hasło','password','password',`autocomplete="${mode==='login'?'current-password':'new-password'}" minlength="12" maxlength="128"`);
 if(['register','password'].includes(mode))inputs+=field('Potwierdź hasło','confirm','password','autocomplete="new-password" minlength="12" maxlength="128"');
 const privacy=window.SK_CONFIG?.privacyUrl;
 if(mode==='register')inputs+=`<div class="field full"><label><input name="privacy" type="checkbox" required> Potwierdzam zapoznanie się z ${privacy?`<a href="${mk(privacy)}" target="_blank" rel="noopener">polityką prywatności</a>`:'polityką prywatności (wymaga podłączenia przez właściciela)'}. Bez zgody marketingowej.</label></div>`;
 document.getElementById('view').innerHTML=head(title,'STOP KRWOTOKOM SYSTEM · H-CORE EDU')+`<section class="card" style="max-width:560px">${configured?'':'<p class="notice">Logowanie wymaga konfiguracji Supabase przez właściciela. Nie można jeszcze wysłać formularza.</p>'}<form class="form" onsubmit="submitAuth(event,'${mode}')">${inputs}<p class="full notice" role="status" aria-live="polite" id="auth-message"></p><div class="full"><button class="button" type="submit" ${!configured||(mode==='register'&&!privacy)?'disabled':''}>${title}</button></div></form><div class="inline-actions" style="margin-top:18px"><button class="button secondary" onclick="showPanel('login')">Logowanie</button><button class="button secondary" onclick="showPanel('register')">Załóż konto</button><button class="ghost-demo" onclick="showPanel('reset')">Nie pamiętam hasła</button></div></section>`;
}
function friendlyError(error){
 const messages={invalid_credentials:'Nieprawidłowy e-mail lub hasło.',email_not_confirmed:'Potwierdź adres e-mail przed zalogowaniem.',user_already_exists:'Nie można utworzyć konta. Sprawdź pocztę lub skorzystaj z resetu hasła.',over_email_send_rate_limit:'Zbyt wiele wiadomości. Spróbuj ponownie później.',weak_password:'Hasło nie spełnia wymagań bezpieczeństwa.',same_password:'Podaj inne hasło.'};
 if(messages[error?.code])return messages[error.code];
 if(error?.code==='42501')return 'Brak uprawnień do tej operacji.';
 return error?.message&&/^[A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż ]+$/.test(error.message)?error.message:'Operacja nie powiodła się. Sprawdź połączenie i spróbuj ponownie.';
}
async function submitAuth(event,mode){
 event.preventDefault(); if(!skClient)return;
 const form=event.target, data=new FormData(form), msg=document.getElementById('auth-message'), button=form.querySelector('[type=submit]');
 if(data.has('confirm')&&data.get('confirm')!==data.get('password')){msg.textContent='Hasła muszą być jednakowe.';return;}
 button.disabled=true;msg.textContent='Trwa wysyłanie…';
 const redirect=location.origin+location.pathname;
 try{
  let result;
  if(mode==='register'){
   if(!data.get('privacy')||!window.SK_CONFIG.privacyUrl)throw Error('Brak potwierdzenia polityki prywatności');
   result=await skClient.auth.signUp({email:data.get('email').trim(),password:data.get('password'),options:{emailRedirectTo:redirect,data:{first_name:data.get('first_name').trim(),last_name:data.get('last_name').trim(),privacy_accepted:true,privacy_version:'1'}}});
  }else if(mode==='login')result=await skClient.auth.signInWithPassword({email:data.get('email').trim(),password:data.get('password')});
  else if(mode==='reset')result=await skClient.auth.resetPasswordForEmail(data.get('email').trim(),{redirectTo:redirect});
  else{
   if(!skRecovery)throw Error('Otwórz link do resetu hasła z wiadomości e-mail');
   result=await skClient.auth.updateUser({password:data.get('password')});
  }
  if(result.error)throw result.error;
  if(mode==='login'){await loadAccount(result.data.session);showPanel('home');}
  else if(mode==='password'){skRecovery=false;await skClient.auth.signOut();showPanel('login');document.getElementById('auth-message').textContent='Hasło zostało zmienione. Zaloguj się ponownie.';}
  else{form.reset();msg.textContent=mode==='register'?'Sprawdź skrzynkę i potwierdź adres e-mail. Jeśli konto już istnieje, skorzystaj z logowania lub resetu hasła.':'Jeśli konto istnieje, otrzymasz wiadomość z linkiem do resetu hasła.';}
 }catch(error){msg.textContent=friendlyError(error);}finally{button.disabled=false;}
}
function profileCard(){
 const p=skProfile,a=skAuthorization;
 return `<div class="card"><div class="badgeid"><div class="eyebrow">STOP KRWOTOKOM SYSTEM</div><strong>INSTRUKTOR</strong><div class="line"></div><b>${mk(p.first_name)} ${mk(p.last_name)}</b><div class="id">${mk(a?.instructor_number||'Numer nie został nadany')}</div><p>Status: <b>${authorizationStatus()}</b></p><p>Autoryzacja od: ${a?dateFormat(a.starts_on):'—'}</p><p>Autoryzacja do (wyłącznie): ${a?dateFormat(a.ends_on):'—'}</p><p>Konto: ${statusLabels[p.status]}</p></div></div>`;
}
function draw(){
 const v=document.getElementById('view');
 if(['login','register','reset','password'].includes(current)){authView(current);return;}
 if(current==='verify'){v.innerHTML=head('Weryfikacja instruktora','Publiczna weryfikacja rzeczywistych danych nie została uruchomiona.')+'<div class="card"><p>Zakres publicznie udostępnianych informacji wymaga zatwierdzenia właściciela. Numery demonstracyjne nie potwierdzają autoryzacji.</p></div>';return;}
 if(!skReady){v.innerHTML=head('Sprawdzanie sesji…','Poczekaj na odczyt konta.');return;}
 if(!skUser){drawGuest();return;}
 if(!skProfile){v.innerHTML=head('Nie udało się odczytać konta','Sprawdź połączenie lub konfigurację bazy.')+'<button class="button" onclick="refreshAccount()">Spróbuj ponownie</button>';return;}
 if(current==='admin'){
  if(!skAdmin){v.innerHTML=head('Brak dostępu','Administracja wymaga uprawnień superadministratora.');return;}
  drawAdmin();return;
 }
 const messages={pending:'Twoje konto oczekuje na zatwierdzenie przez administratora STOP KRWOTOKOM SYSTEM.',rejected:'Twoje zgłoszenie zostało odrzucone. Skontaktuj się z H-CORE EDU.',suspended:'Twoje konto jest zawieszone. Skontaktuj się z H-CORE EDU.'};
 const notice=messages[skProfile.status]?`<p class="notice">${messages[skProfile.status]}</p>`:'';
 if(current==='home'||current==='profile'){
  v.innerHTML=head(current==='profile'?'Mój profil i ID':'Pulpit instruktora','Konto i autoryzacja instruktorska są odrębnymi uprawnieniami.')+notice+profileCard()+`<div class="inline-actions" style="margin-top:18px"><button class="button secondary" onclick="refreshAccount()">Odśwież status</button><button class="button secondary" onclick="editOwnProfile()">Edytuj dane konta</button><button class="button secondary" onclick="showPanel('reset')">Zmień hasło</button>${skAdmin?'<button class="button" onclick="go(\'admin\')">Administracja</button>':''}</div>`;
 }else{
  const active=authorizationStatus()==='Aktywny';
  v.innerHTML=head(tabs.find(t=>t[2]===current)?.[0]||'Panel','')+notice+`<div class="card"><p>${active?'Ta sekcja jest w przygotowaniu. Nie ma jeszcze zapisanych szkoleń ani materiałów.':'Dostęp wymaga zatwierdzonego konta i aktywnej autoryzacji instruktorskiej.'}</p><p>Szkolenia, uczestnicy i certyfikaty demonstracyjne zostały wyłączone.</p></div>`;
 }
}
function openAddCourse(){go('addCourse');}
function newCourse(){go('addCourse');}
function publicVerify(){modal('Weryfikacja niedostępna','<p>Publiczna weryfikacja rzeczywistych danych nie została uruchomiona.</p>');}
async function loadAccount(session){
 const version=++skLoad;
 skUser=session?.user||null;skProfile=null;skAuthorization=null;skAdmin=false;portalAuthenticated=!!skUser;
 if(skUser){
  const results=await Promise.all([skClient.from('profiles').select('*').eq('id',skUser.id).single(),skClient.from('instructor_authorizations').select('*').eq('user_id',skUser.id).maybeSingle(),skClient.rpc('is_superadmin')]);
  if(version!==skLoad)return;
  if(results.some(r=>r.error)){skProfile=null;}else{skProfile=results[0].data;skAuthorization=results[1].data;skAdmin=results[2].data===true;}
 }
 if(version!==skLoad)return;
 skReady=true;nav();updatePortalChrome();draw();
}
async function refreshAccount(){if(!skClient)return;const {data,error}=await skClient.auth.getSession();if(!error)await loadAccount(data.session);}
async function initPortal(){
 const cfg=window.SK_CONFIG||{};
 if(cfg.supabaseUrl&&cfg.supabasePublishableKey&&window.supabase){
  skClient=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}});
  skClient.auth.onAuthStateChange((event,session)=>{
   if(event==='PASSWORD_RECOVERY')skRecovery=true;
   // Do not await Auth API inside its own lock.
   setTimeout(async()=>{
    await loadAccount(session);
    if(skRecovery&&session)showPanel('password');
    else if(['SIGNED_IN','SIGNED_OUT'].includes(event)&&/^#(?:access_token=|error=)/.test(location.hash))showPanel('home');
   },0);
  });
  const {data,error}=await skClient.auth.getSession();
  if(!error)await loadAccount(data.session);else skReady=true;
  if(skRecovery&&data.session)showPanel('password');
  else if(data.session&&!location.hash.startsWith('#panel/'))showPanel('home');
 }else skReady=true;
 syncRouteFromAddress();nav();updatePortalChrome();draw();
 // Expiry is evaluated on each DB operation, independently from this UI refresh.
 setInterval(()=>{if(skUser&&!document.hidden)refreshAccount();},60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&skUser)refreshAccount();});
}
initPortal();

window.addEventListener('hashchange',syncRouteFromAddress);

function editOwnProfile(){
 if(!skProfile)return;
 modal('Moje dane',`<form class="form" onsubmit="saveOwnProfile(event)">${field('Imię','first_name','text',`maxlength="80" value="${mk(skProfile.first_name)}"`)}${field('Nazwisko','last_name','text',`maxlength="80" value="${mk(skProfile.last_name)}"`)}${field('Adres e-mail','email','email',`autocomplete="email" value="${mk(skProfile.email)}"`)}<p class="full">Zmiana e-maila wymaga potwierdzenia zgodnie z ustawieniami Supabase Auth. Numer i uprawnienia nie są edytowalne.</p><p class="full notice" id="own-message" role="status"></p><div class="full"><button class="button" type="submit">Zapisz dane</button></div></form>`);
}
async function saveOwnProfile(event){
 event.preventDefault();const form=event.target,d=new FormData(form),button=form.querySelector('[type=submit]');button.disabled=true;
 try{
  const {error}=await skClient.rpc('update_own_profile',{p_first_name:d.get('first_name').trim(),p_last_name:d.get('last_name').trim()});if(error)throw error;
  if(d.get('email').trim()!==skProfile.email){
   const {error}=await skClient.auth.updateUser({email:d.get('email').trim()},{emailRedirectTo:location.origin+location.pathname});if(error)throw error;
   document.getElementById('own-message').textContent='Imię i nazwisko zapisano. Sprawdź pocztę, aby potwierdzić zmianę adresu.';
   await refreshAccount();
  }else{closeModal();await refreshAccount();}
 }catch(error){document.getElementById('own-message').textContent=friendlyError(error);}finally{button.disabled=false;}
}
