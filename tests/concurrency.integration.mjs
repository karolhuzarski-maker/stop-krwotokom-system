// Run ONLY against a new, disposable PostgreSQL database, never the production project.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
test('dwa niezależne połączenia: blokady, unikalność i rollback',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const clients=await Promise.all([0,1,2].map(async()=>{const c=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await c.connect();return c;}));
 const [control,left,right]=clients;
 try{
  const existing=await control.query("select to_regclass('public.profiles') as profiles,to_regclass('auth.users') as users");
  assert.equal(existing.rows[0].profiles,null,'Wymagana pusta testowa baza');assert.equal(existing.rows[0].users,null,'Wymagana pusta testowa baza');
  await control.query(`create role anon;create role authenticated;create role service_role bypassrls;
  create schema auth;grant usage on schema auth to anon,authenticated;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  await control.query(await readFile(new URL('../supabase/migrations/202611070001_registry.sql',import.meta.url),'utf8'));
  const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004'];
  for(const id of ids)await control.query(`insert into auth.users values($1,$2,now(),' {"first_name":"Anna","last_name":"Test","privacy_accepted":true}')`,[id,id+'@example.test']);
  await control.query('select private.bootstrap_owner($1,false)',[ids[0]]);
  for(const c of [left,right]){await c.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[0]]);await c.query('set role authenticated');}
  for(const id of ids.slice(1))await left.query("select public.admin_account($1,'approved','Konto testowe')",[id]);
  const grant=(c,id)=>c.query("select public.admin_authorize($1,current_date,'Egzamin testowy') as number",[id]);
  await left.query('begin');await right.query('begin');
  const first=await grant(left,ids[1]);
  const waiting=grant(right,ids[2]);
  await control.query('select pg_sleep(0.1)');
  const locks=await control.query("select count(*)::int as n from pg_stat_activity where pid=$1 and wait_event_type='Lock'",[right.processID]);
  assert.equal(locks.rows[0].n,1,'Drugie połączenie musi czekać na transakcyjny licznik');
  await left.query('commit');const second=await waiting;await right.query('commit');
  assert.notEqual(first.rows[0].number,second.rows[0].number);assert.match(first.rows[0].number,/-0001$/);assert.match(second.rows[0].number,/-0002$/);
  await left.query('begin');await right.query('begin');
  const original=await grant(left,ids[1]);const sameWaiting=grant(right,ids[1]);await left.query('commit');const repeated=await sameWaiting;await right.query('commit');
  assert.equal(original.rows[0].number,repeated.rows[0].number);
  const before=(await control.query('select last_value from public.instructor_number_counters')).rows[0].last_value;
  await control.query(`create function public.test_fail_grant() returns trigger language plpgsql as $$ begin raise exception 'injected failure';end $$;
  create trigger test_fail_grant before insert on public.instructor_authorizations for each row execute function public.test_fail_grant();`);
  await assert.rejects(grant(left,ids[3]),/injected failure/);
  assert.equal((await control.query('select last_value from public.instructor_number_counters')).rows[0].last_value,before);
  assert.equal((await control.query('select count(*)::int as n from public.instructor_numbers where user_id=$1',[ids[3]])).rows[0].n,0);
 }finally{await Promise.all(clients.map(async c=>{await c.query('rollback').catch(()=>{});await c.end();}));}
});
