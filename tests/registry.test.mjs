import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('migracja, RLS, decyzje, numeracja i kolejka na PostgreSQL WASM',async t=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;grant usage on schema auth to authenticated,anon;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
 await db.exec(await readFile(new URL('../supabase/migrations/202611070001_registry.sql',import.meta.url),'utf8'));
 const owner='00000000-0000-4000-8000-000000000001',a='00000000-0000-4000-8000-000000000002',b='00000000-0000-4000-8000-000000000003';
 const value=async(sql,params=[])=>Object.values((await db.query(sql,params)).rows[0])[0];
 const as=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);};
 const operator=()=>db.exec('reset role');
 const user=async(id,confirmed=false)=>db.query(`insert into auth.users values($1,$2,${confirmed?'now()':'null'},$3)`,[id,id+'@example.test',JSON.stringify({first_name:'Anna',last_name:'Test',privacy_accepted:true,privacy_version:'1',role:'superadmin',status:'approved'})]);
 await t.test('profil i jeden wniosek dopiero po potwierdzeniu e-mail; metadata nie nadaje roli',async()=>{
  await user(owner,true);await user(a);await user(b,true);
  assert.equal(await value('select count(*)::int from public.profiles'),2);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[a]);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[a]);
  assert.equal(await value('select count(*)::int from public.access_requests where user_id=$1',[a]),1);
  assert.equal(await value("select count(*)::int from public.notification_events where dedupe_key=$1",['access:'+a]),1);
  assert.equal(await value('select count(*)::int from public.admin_roles'),0);
 });
 await t.test('bootstrap właściciela i konflikt powtórzenia',async()=>{
  await db.query('select private.bootstrap_owner($1,true)',[owner]);
  await assert.rejects(db.query('select private.bootstrap_owner($1,true)',[a]),/Pierwszy administrator/);
  await as(owner);assert.equal(await value('select public.is_superadmin()'),true);assert.equal(await value('select public.has_active_authorization()'),true);
 });
 await t.test('pending: brak uprawnień, izolacja danych, zakaz zmian przez API',async()=>{
  await as(a);
  assert.equal(await value('select public.has_active_authorization()'),false);
  assert.equal(await value('select count(*)::int from public.profiles'),1);
  assert.equal(await value('select count(*)::int from public.admin_audit_log'),0);
  await assert.rejects(db.query("select public.admin_authorize($1,current_date,'próba ataku')",[a]),/Brak uprawnień/);
  await assert.rejects(db.exec("update public.profiles set status='approved'"),/permission denied/);
  await assert.rejects(db.exec("update public.instructor_authorizations set instructor_number='SK-I-2027-9999'"),/permission denied/);
  await assert.rejects(db.query('select private.bootstrap_owner($1,false)',[a]),/permission denied/);
  await assert.rejects(db.exec('select public.claim_notifications()'),/permission denied/);
 });
 let number;
 await t.test('akceptacja bez numeru; atomowe nadanie trzyletniej autoryzacji',async()=>{
  await as(owner);await db.query("select public.admin_account($1,'approved','Sprawdzono konto')",[a]);
  assert.equal(await value('select count(*)::int from public.instructor_authorizations where user_id=$1',[a]),0);
  number=await value("select public.admin_authorize($1,'2024-02-29','Kwalifikacje i egzamin sprawdzone')",[a]);
  assert.match(number,/^SK-I-\d{4}-0002$/);
  assert.equal(await value('select ends_on::text from public.instructor_authorizations where user_id=$1',[a]),'2027-02-28');
  const count=await value('select count(*)::int from public.notification_events');
  assert.equal(await value("select public.admin_authorize($1,'2024-02-29','Ponowienie żądania')",[a]),number);
  assert.equal(await value('select count(*)::int from public.notification_events'),count);
  await assert.rejects(db.query("select public.admin_authorize($1,current_date,'Brak akceptacji')",[b]),/zatwierdzone/);
 });
 await t.test('stały numer po odnowieniu, zawieszeniu i blokada wygasłej autoryzacji',async()=>{
  await as(owner);
  await db.query("select public.admin_authorize($1,(now() at time zone 'Europe/Warsaw')::date,'Odnowienie autoryzacji')",[a]);
  await db.query("select public.admin_suspend_authorization($1,true,'Zawieszenie testowe')",[a]);
  await as(a);assert.equal(await value('select public.has_active_authorization()'),false);
  assert.equal(await value('select instructor_number from public.instructor_authorizations'),number);
  await as(owner);await db.query("select public.admin_suspend_authorization($1,false,'Przywrócenie testowe')",[a]);
  await as(a);assert.equal(await value('select public.has_active_authorization()'),true);
  await as(owner);await db.query("select public.admin_authorize($1,'2010-01-01','Okres historyczny')",[a]);
  await as(a);assert.equal(await value('select public.has_active_authorization()'),false);
  assert.equal(await value('select instructor_number from public.instructor_authorizations'),number);
 });
 await t.test('zatwierdzone konto i zawieszona osoba nie uzyskują dostępu',async()=>{
  await as(owner);await db.query("select public.admin_account($1,'approved','Akceptacja konta')",[b]);
  await as(b);assert.equal(await value('select public.has_active_authorization()'),false);
  await as(owner);await db.query("select public.admin_authorize($1,(now() at time zone 'Europe/Warsaw')::date,'Egzamin sprawdzony')",[b]);
  await db.query("select public.admin_account($1,'suspended','Konto zawieszone')",[b]);
  await as(b);assert.equal(await value('select public.has_active_authorization()'),false);
 });
 await t.test('korekta z audytem, rezerwacja starego numeru i brak ponownego użycia',async()=>{
  await as(owner);const newNumber=number.replace(/0002$/,'0010');
  await assert.rejects(db.query("select public.admin_correct_number($1,$2,'Niepoprawne dodatkowe zero w numerze')",[a,number.replace(/0002$/,'00001')]),/Niekanoniczny/);
  await db.query("select public.admin_correct_number($1,$2,'Udokumentowana wyjątkowa korekta')",[a,newNumber]);
  await assert.rejects(db.query("select public.admin_correct_number($1,$2,'Próba ponownego użycia starego numeru')",[a,number]),/już użyty/);
  assert.equal(await value("select count(*)::int from public.admin_audit_log where action='number.correction'"),1);
  await operator();assert.equal(await value('select count(*)::int from public.instructor_numbers where number=$1',[number]),1);
  assert.equal(await value('select last_value from public.instructor_number_counters'),10);
 });
 await t.test('kolejka: leasing, błąd, ponowienie, sukces i odrzucenie starego leasingu',async()=>{
  await as('','service_role');const claimed=(await db.query('select * from public.claim_notifications()')).rows;
  assert.ok(claimed.length>0);assert.equal((await db.query('select * from public.claim_notifications()')).rows.length,0);
  const e=claimed[0];await db.query('select public.finish_notification($1,$2,false,$3)',[e.id,e.lease_id,'Provider HTTP 503']);
  await assert.rejects(db.query('select public.finish_notification($1,$2,true,$3)',[e.id,e.lease_id,'old']),/Nieaktualna/);
  await operator();await db.query("update public.notification_events set next_attempt_at=now()-interval '1 second' where id=$1",[e.id]);
  await as('','service_role');const retry=(await db.query('select * from public.claim_notifications()')).rows[0];
  assert.equal(retry.id,e.id);assert.notEqual(retry.lease_id,e.lease_id);
  await db.query('select public.finish_notification($1,$2,true,$3)',[retry.id,retry.lease_id,'provider-test']);
  await operator();assert.equal(await value('select status from public.notification_events where id=$1',[e.id]),'sent');
  assert.equal(await value('select count(*)::int from public.notification_attempts where event_id=$1',[e.id]),2);
 });
 await t.test('anon nie czyta rejestru; role administracyjne nie wynikają z autoryzacji',async()=>{
  await as('','anon');await assert.rejects(db.exec('select * from public.profiles'),/permission denied/);
  await as(a);assert.equal(await value('select public.is_superadmin()'),false);
 });
 await t.test('edycja własnego profilu nie zmienia roli, numeru ani stanu konta',async()=>{
  await as(a);await db.query("select public.update_own_profile('Maria','Nowa')");
  assert.equal(await value('select first_name from public.profiles'),'Maria');
  assert.equal(await value('select public.is_superadmin()'),false);
  assert.equal(await value('select status from public.profiles'),'approved');
  await assert.rejects(db.query("select private.assign_owner_first($1,2027,current_date)",[a]),/permission denied/);
 });
 await t.test('zbyt stara niejednoznaczna wysyłka wymaga sprawdzenia zamiast duplikowania',async()=>{
  await operator();await db.exec("update public.notification_events set status='sending',first_attempt_at=now()-interval '25 hours',locked_at=now()-interval '10 minutes' where status<>'sent'");
  await as('','service_role');assert.equal((await db.query('select * from public.claim_notifications()')).rows.length,0);
  await operator();assert.ok(await value("select count(*)::int from public.notification_events where status='review'")>0);
 });
 await db.close();
});

test('pierwszy numer właściciela po wcześniejszym utworzeniu administratora',async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
 await db.exec(await readFile(new URL('../supabase/migrations/202611070001_registry.sql',import.meta.url),'utf8'));
 const id='00000000-0000-4000-8000-000000000001';
 await db.query(`insert into auth.users values($1,'owner@example.test',now(),'{"first_name":"Owner","last_name":"Test","privacy_accepted":true}')`,[id]);
 await db.query('select private.bootstrap_owner($1,false)',[id]);
 await assert.rejects(db.query("select private.assign_owner_first($1,1900,current_date)",[id]),/Rok musi/);
 const {rows}=await db.query("select private.assign_owner_first($1,extract(year from now() at time zone 'Europe/Warsaw')::int,current_date) as number",[id]);
 assert.match(rows[0].number,/^SK-I-\d{4}-0001$/);
 await assert.rejects(db.query("select private.assign_owner_first($1,extract(year from now() at time zone 'Europe/Warsaw')::int,current_date)",[id]),/już numer/);
 assert.equal((await db.query('select count(*)::int as n from public.instructor_authorizations')).rows[0].n,1);
 await db.close();
});
