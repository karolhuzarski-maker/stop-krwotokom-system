'use strict';
let adminGeneration=0;
async function allRows(table,order='created_at'){
 const rows=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await skClient.from(table).select('*').order(order,{ascending:false}).range(offset,offset+499);
  if(error)throw error;
  rows.push(...data);if(data.length<500)return rows;
 }
}
function adminActions(p){
 const button=(label,action)=>`<button class="button secondary sm" onclick="adminAction('${p.id}','${action}')">${label}</button>`;
 let html=button('Zobacz','details')+button('Historia','history');
 if(p.status!=='approved')html+=button(p.status==='pending'?'Akceptuj konto':'Przywróć konto','approved');
 if(p.status==='pending')html+=button('Odrzuć','rejected');
 if(p.status==='approved')html+=button('Zawieś konto','suspended')+button(p.authorization?'Przedłuż / zmień okres':'Nadaj autoryzację instruktora','authorize');
 if(p.authorization)html+=button(p.authorization.suspended?'Przywróć autoryzację':'Zawieś autoryzację','authorization');
 return `<div class="admin-actions">${html}</div>`;
}
function filterAdmin(){
 const query=adminFilter.toLocaleLowerCase('pl');
 const rows=adminRows.filter(p=>(adminSection!=='requests'||p.status==='pending')&&(adminSection!=='authorizations'||p.authorization)&&`${p.first_name} ${p.last_name} ${p.email} ${p.authorization?.instructor_number||''}`.toLocaleLowerCase('pl').includes(query));
 document.getElementById('admin-table').innerHTML=`<div class="admin-scroll"><table class="table"><thead><tr><th>Imię i nazwisko</th><th>E-mail</th><th>Numer instruktora</th><th>Status</th><th>Autoryzacja do</th><th>Działania</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${mk(p.first_name)} ${mk(p.last_name)}</td><td>${mk(p.email)}</td><td>${mk(p.authorization?.instructor_number||'—')}</td><td>${statusLabels[p.status]}<br>${authorizationStatus(p.authorization,p)}</td><td>${p.authorization?dateFormat(p.authorization.ends_on):'—'}</td><td>${adminActions(p)}</td></tr>`).join('')||'<tr><td colspan="6">Brak wyników.</td></tr>'}</tbody></table></div>`;
}
async function drawAdmin(){
 const generation=++adminGeneration;
 const v=document.getElementById('view');
 v.innerHTML=head('Administracja','Centralny rejestr · H-CORE EDU')+`<div class="inline-actions" style="margin-bottom:18px">${[['requests','Wnioski o dostęp'],['instructors','Instruktorzy'],['authorizations','Autoryzacje'],['history','Historia zmian']].map(([id,title])=>`<button class="button ${id===adminSection?'':'secondary'}" onclick="adminSection='${id}';drawAdmin()">${title}</button>`).join('')}</div><div id="admin-body" role="status">Ładowanie…</div>`;
 try{
  if(adminSection==='history'){
   const {data,error}=await skClient.from('admin_audit_log').select('*').order('id',{ascending:false}).limit(200);if(error)throw error;
   if(generation!==adminGeneration||current!=='admin'||!skAdmin)return;
   document.getElementById('admin-body').innerHTML=historyTable(data)+'<p>Ostatnie 200 wpisów. Pełny dziennik jest zachowany w bazie.</p>';return;
  }
  const [profiles,authorizations]=await Promise.all([allRows('profiles'),allRows('instructor_authorizations','updated_at')]);
  if(generation!==adminGeneration||current!=='admin'||!skAdmin)return;
  adminRows=profiles.map(p=>({...p,authorization:authorizations.find(a=>a.user_id===p.id)}));
  const stats=[['Oczekujące wnioski',profiles.filter(p=>p.status==='pending').length],['Zatwierdzone konta',profiles.filter(p=>p.status==='approved').length],['Aktywni instruktorzy',adminRows.filter(p=>authorizationStatus(p.authorization,p)==='Aktywny').length],['Wygasłe autoryzacje',authorizations.filter(a=>a.ends_on<=warsawToday()).length]];
  const {data:queue,error}=await skClient.from('notification_events').select('id',{count:'exact',head:false}).in('status',['failed','review']);if(error)throw error;
  if(generation!==adminGeneration||current!=='admin'||!skAdmin)return;
  document.getElementById('admin-body').innerHTML=`<div class="grid">${stats.map(([label,value])=>`<div class="card stat"><p>${label}</p><div class="number">${value}</div></div>`).join('')}</div><p class="notice">Powiadomienia wymagające uwagi: ${queue.length}. Szczegóły i próby wysyłki są w tabelach notification_events i notification_attempts w Supabase.</p><div class="card" style="margin-top:18px"><div class="field"><label for="admin-search">Szukaj po imieniu, nazwisku, e-mailu lub numerze</label><input id="admin-search" value="${mk(adminFilter)}" oninput="adminFilter=this.value;filterAdmin()" type="search"></div><div id="admin-table"></div></div>`;
  filterAdmin();
 }catch(error){if(current==='admin'&&document.getElementById('admin-body'))document.getElementById('admin-body').textContent=friendlyError(error);}
}
function historyTable(rows){return `<div class="admin-scroll"><table class="table"><thead><tr><th>Data</th><th>Operacja</th><th>Konto / administrator</th><th>Uzasadnienie i zmiana</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${mk(new Date(r.created_at).toLocaleString('pl-PL',{timeZone:'Europe/Warsaw'}))}</td><td>${mk(({bootstrap:'Konfiguracja właściciela','account.approved':'Akceptacja konta','account.rejected':'Odrzucenie konta','account.suspended':'Zawieszenie konta','authorization.grant':'Nadanie / przedłużenie autoryzacji','authorization.suspend':'Zmiana zawieszenia autoryzacji','number.correction':'Korekta numeru'})[r.action]||r.action)}</td><td>${mk(r.target_id)}<br>${mk(r.actor_id)}</td><td>${mk(r.reason)}<details><summary>Szczegóły</summary><pre>${mk(JSON.stringify({przed:r.before_data,po:r.after_data},null,2))}</pre></details></td></tr>`).join('')||'<tr><td colspan="4">Brak wpisów.</td></tr>'}</tbody></table></div>`;}
async function adminAction(id,action){
 if(!skAdmin)return;
 const p=adminRows.find(p=>p.id===id);if(!p)return;
 if(action==='history'){
  const {data,error}=await skClient.from('admin_audit_log').select('*').eq('target_id',id).order('id',{ascending:false}).limit(200);
  if(error){modal('Błąd',`<p>${mk(friendlyError(error))}</p>`);return;}
  modal('Historia konta',historyTable(data));return;
 }
 if(action==='details'){
  modal('Szczegóły konta',`<p>${mk(p.first_name)} ${mk(p.last_name)}</p><p>${mk(p.email)}</p><p>Konto: ${statusLabels[p.status]}</p><p>Numer: ${mk(p.authorization?.instructor_number||'—')}</p><p>Autoryzacja: ${authorizationStatus(p.authorization,p)}</p><p>Zgłoszenie: ${mk(new Date(p.created_at).toLocaleString('pl-PL',{timeZone:'Europe/Warsaw'}))}</p>${p.authorization?`<p>Okres: ${dateFormat(p.authorization.starts_on)} – ${dateFormat(p.authorization.ends_on)} (koniec wyłączny)</p><button class="button secondary" onclick="adminAction('${id}','correction')">Wyjątkowa korekta numeru</button>`:''}`);return;
 }
 const title={approved:'Zatwierdź / przywróć konto',rejected:'Odrzuć zgłoszenie',suspended:'Zawieś konto',authorize:'Nadaj / przedłuż autoryzację',authorization:'Zmień zawieszenie autoryzacji',correction:'Wyjątkowa korekta numeru'}[action];
 modal(title,`<p>${mk(p.first_name)} ${mk(p.last_name)} · ${mk(p.email)}</p><form class="form" onsubmit="submitAdmin(event,'${id}','${action}')">${action==='authorize'?field('Początek autoryzacji','starts_on','date',`value="${warsawToday()}" onchange="showAuthorizationEnd(this.value)"`)+'<p class="full" id="authorization-end"></p>':''}${action==='correction'?field('Nowy numer (stary pozostanie zastrzeżony)','number','text','pattern="SK-I-[0-9]{4}-[0-9]{4,}"'):''}${field('Uzasadnienie decyzji','reason','text',`minlength="${action==='correction'?10:3}" maxlength="1000"`)}<p class="full notice" id="admin-message" role="status"></p><div class="full"><button class="button" type="submit">Zapisz decyzję</button></div></form>`);
 if(action==='authorize')showAuthorizationEnd(warsawToday());
}
function showAuthorizationEnd(start){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start))return;
 // PostgreSQL interval semantics: Feb 29 becomes Feb 28 in a non-leap year.
 const [y,m,d]=start.split('-').map(Number),last=new Date(Date.UTC(y+3,m,0)).getUTCDate();
 const end=`${y+3}-${String(m).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`;
 document.getElementById('authorization-end').textContent='Proponowany koniec: '+dateFormat(end)+' (koniec wyłączny; 3 lata).';
}
async function submitAdmin(event,id,action){
 event.preventDefault();const form=event.target,d=new FormData(form),button=form.querySelector('[type=submit]');button.disabled=true;
 try{
  const p=adminRows.find(p=>p.id===id);let rpc,args={p_user:id,p_reason:d.get('reason').trim()};
  if(action==='authorize'){rpc='admin_authorize';args.p_start=d.get('starts_on');}
  else if(action==='authorization'){rpc='admin_suspend_authorization';args.p_suspended=!p.authorization.suspended;}
  else if(action==='correction'){rpc='admin_correct_number';args.p_number=d.get('number').trim();}
  else{rpc='admin_account';args.p_status=action;}
  const {error}=await skClient.rpc(rpc,args);if(error)throw error;
  closeModal();await refreshAccount();
 }catch(error){document.getElementById('admin-message').textContent=friendlyError(error);}finally{button.disabled=false;}
}
