import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const base=new URL('../',import.meta.url);
async function portal(hash='#panel/home',config={}){
 const dom=new JSDOM(await readFile(new URL('index.html',base),'utf8'),{url:'https://example.test/stop-krwotokom-system/'+hash,runScripts:'outside-only'});
 dom.window.scrollTo=()=>{};dom.window.matchMedia=()=>({matches:false});dom.window.SK_CONFIG=config;
 dom.window.setInterval=()=>0;
 const context=dom.getInternalVMContext();
 for(const file of ['app.js','portal.js','admin.js'])vm.runInContext(await readFile(new URL('assets/js/'+file,base),'utf8'),context);
 return {dom,w:dom.window,run:code=>vm.runInContext(code,context)};
}
test('trasy, formularze i sesja bez demonstracyjnego obejścia',async()=>{
 const {dom,w,run}=await portal('#panel/login');
 assert.ok(w.document.querySelector('#auth-email'));assert.equal(w.document.querySelector('[type=submit]').disabled,true);
 run("loginDemo()");assert.equal(run('portalAuthenticated'),false);
 run("showPanel('register')");assert.ok(w.document.querySelector('[name=first_name]'));assert.ok(w.document.querySelector('[name=privacy]').required);
 run("showPanel('reset')");assert.ok(w.document.querySelector('[name=email]'));assert.equal(w.document.querySelector('[name=password]'),null);
 run("showPanel('admin')");assert.equal(w.document.querySelector('#admin-body'),null);
 run("showPanel('verify')");assert.match(w.document.querySelector('#view').textContent,/nie została uruchomiona/);
 dom.window.close();
});
test('własny profil, status pending, aktywność i wygaśnięcie',async()=>{
 const {dom,w,run}=await portal();
 run(`skReady=true;skUser={id:'person'};portalAuthenticated=true;skProfile={first_name:'<img src=x onerror=alert(1)>',last_name:'Test',status:'pending'};showPanel('profile')`);
 assert.equal(w.document.querySelector('#view img'),null);assert.match(w.document.querySelector('#view').textContent,/oczekuje na zatwierdzenie/);
 run("skProfile.status='approved';skAuthorization={instructor_number:'SK-I-2027-0002',starts_on:'2000-01-01',ends_on:'2003-01-01',suspended:false};draw()");
 assert.match(w.document.querySelector('#view').textContent,/Wygasły/);assert.match(w.document.querySelector('#view').textContent,/SK-I-2027-0002/);
 run("showPanel('addCourse')");assert.match(w.document.querySelector('#view').textContent,/wymaga zatwierdzonego konta/);
 run("skAuthorization.starts_on='2020-01-01';skAuthorization.ends_on='2099-01-01';draw()");assert.match(w.document.querySelector('#view').textContent,/w przygotowaniu/);
 run("showPanel('admin')");assert.match(w.document.querySelector('#view').textContent,/Brak dostępu/);
 assert.equal(w.document.querySelector('#view').textContent.includes('Przykładowy Instruktor'),false);
 dom.window.close();
});
test('fragment autoryzacji nie jest nadpisywany; odzyskanie sesji odczytuje bazę',async()=>{
 const {dom,w,run}=await portal('#access_token=test&type=recovery');
 assert.equal(w.location.hash,'#access_token=test&type=recovery');
 run(`skClient={from:table=>({select:()=>({eq:()=>({single:async()=>({data:{first_name:'Anna',last_name:'Test',status:'approved'}}),maybeSingle:async()=>({data:{instructor_number:'SK-I-2027-0009',starts_on:'2020-01-01',ends_on:'2099-01-01',suspended:false}})})})}),rpc:async()=>({data:false})}`);
 await run("loadAccount({user:{id:'person'}})");run("showPanel('profile')");
 assert.match(w.document.querySelector('#view').textContent,/Anna Test/);assert.match(w.document.querySelector('#view').textContent,/SK-I-2027-0009/);
 run('clearAccount();draw()');assert.equal(w.document.querySelector('#view').textContent.includes('0009'),false);
 dom.window.close();
});
