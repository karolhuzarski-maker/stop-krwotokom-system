begin;
create schema if not exists private;
revoke all on schema private from public;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete restrict,
 first_name text not null check(length(first_name) between 1 and 80),
 last_name text not null check(length(last_name) between 1 and 80), email text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected','suspended')),
 privacy_accepted_at timestamptz not null, privacy_version text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index profiles_email_unique on public.profiles(lower(email));
create table public.admin_roles (user_id uuid primary key references public.profiles(id), role text not null check(role='superadmin'),created_at timestamptz not null default now());
create table public.access_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id),
 status text not null default 'pending' check(status in ('pending','approved','rejected','suspended')),
 created_at timestamptz not null default now(), decided_at timestamptz, decided_by uuid references public.profiles(id)
);
create table public.instructor_number_counters (year integer primary key check(year between 2000 and 9999), last_value integer not null check(last_value>0));
-- Permanent ledger: retired numbers cannot be reused, even after a correction.
create table public.instructor_numbers (
 number text primary key check(number ~ '^SK-I-[0-9]{4}-[0-9]{4,}$'), user_id uuid not null references public.profiles(id),
 assigned_at timestamptz not null default now(), retired_at timestamptz
);
create unique index one_current_number on public.instructor_numbers(user_id) where retired_at is null;
create table public.instructor_authorizations (
 user_id uuid primary key references public.profiles(id), instructor_number text not null unique references public.instructor_numbers(number),
 first_assigned_at timestamptz not null default now(), starts_on date not null, ends_on date not null,
 suspended boolean not null default false, updated_at timestamptz not null default now(), check(ends_on>starts_on)
);
create table public.admin_audit_log (
 id bigint generated always as identity primary key, actor_id uuid references public.profiles(id),target_id uuid not null references public.profiles(id),
 action text not null,before_data jsonb,after_data jsonb,reason text not null,created_at timestamptz not null default now()
);
create index audit_target on public.admin_audit_log(target_id,id desc);
create table public.notification_events (
 id uuid primary key default gen_random_uuid(),dedupe_key text not null unique,kind text not null,user_id uuid not null references public.profiles(id),payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','review')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),locked_at timestamptz,lease_id uuid,first_attempt_at timestamptz,sent_at timestamptz,provider_id text,created_at timestamptz not null default now()
);
create table public.notification_attempts (id bigint generated always as identity primary key,event_id uuid not null references public.notification_events(id),attempted_at timestamptz not null default now(),success boolean not null,detail text);
create function public.is_superadmin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_roles r join public.profiles p on p.id=r.user_id where r.user_id=auth.uid() and p.status='approved');
$$;
create function public.has_active_authorization() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.instructor_authorizations a join public.profiles p on p.id=a.user_id where a.user_id=auth.uid() and p.status='approved' and not a.suspended and (now() at time zone 'Europe/Warsaw')::date >= a.starts_on and (now() at time zone 'Europe/Warsaw')::date < a.ends_on);
$$;
create function private.confirmed_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email_confirmed_at is null then return new; end if;
 if new.raw_user_meta_data->>'privacy_accepted' is distinct from 'true' then raise exception 'Wymagane potwierdzenie polityki prywatności'; end if;
 insert into public.profiles(id,first_name,last_name,email,privacy_accepted_at,privacy_version)
 values(new.id,left(trim(new.raw_user_meta_data->>'first_name'),80),left(trim(new.raw_user_meta_data->>'last_name'),80),new.email,now(),coalesce(new.raw_user_meta_data->>'privacy_version','1')) on conflict(id) do nothing;
 insert into public.access_requests(user_id) values(new.id) on conflict(user_id) do nothing;
 insert into public.notification_events(dedupe_key,kind,user_id,payload)
 select 'access:'||new.id,'access_request',p.id,jsonb_build_object('name',p.first_name||' '||p.last_name,'email',p.email,'submitted_at',r.created_at)
 from public.profiles p join public.access_requests r on r.user_id=p.id where p.id=new.id on conflict(dedupe_key) do nothing;
 return new;
end; $$;
create trigger confirmed_user_insert after insert on auth.users for each row execute function private.confirmed_user();
create trigger confirmed_user_update after update of email_confirmed_at on auth.users for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null) execute function private.confirmed_user();
create function private.sync_email() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.profiles set email=new.email,updated_at=now() where id=new.id; return new; end; $$;
create trigger sync_confirmed_email after update of email on auth.users for each row execute function private.sync_email();
create function public.admin_account(p_user uuid,p_status text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v_before jsonb;v_after jsonb;
begin
 if not public.is_superadmin() then raise exception 'Brak uprawnień' using errcode='42501'; end if;
 if p_status is null or p_status not in ('approved','rejected','suspended') or length(trim(coalesce(p_reason,'')))<3 then raise exception 'Nieprawidłowa decyzja lub uzasadnienie'; end if;
 if exists(select 1 from public.admin_roles where user_id=p_user) and p_status<>'approved' then raise exception 'Nie można zablokować konta superadministratora'; end if;
 select to_jsonb(p) into v_before from public.profiles p where id=p_user for update;
 if v_before is null then raise exception 'Brak konta'; end if;
 if v_before->>'status'=p_status then return; end if;
 update public.profiles set status=p_status,updated_at=now() where id=p_user returning to_jsonb(profiles.*) into v_after;
 update public.access_requests set status=p_status,decided_at=now(),decided_by=auth.uid() where user_id=p_user;
 insert into public.admin_audit_log(actor_id,target_id,action,before_data,after_data,reason) values(auth.uid(),p_user,'account.'||p_status,v_before,v_after,p_reason);
 insert into public.notification_events(dedupe_key,kind,user_id,payload) values(gen_random_uuid()::text,'account_decision',p_user,jsonb_build_object('email',v_after->>'email','status',p_status));
end; $$;
create function public.admin_authorize(p_user uuid,p_start date,p_reason text) returns text language plpgsql security definer set search_path='' as $$
declare v_number text;v_year integer;v_serial integer;v_before jsonb;v_after jsonb;v_email text;v_status text;
begin
 if not public.is_superadmin() then raise exception 'Brak uprawnień' using errcode='42501'; end if;
 if p_start is null or length(trim(coalesce(p_reason,'')))<3 then raise exception 'Podaj datę i uzasadnienie'; end if;
 select status,email into v_status,v_email from public.profiles where id=p_user for update;
 if v_status is distinct from 'approved' then raise exception 'Konto musi być zatwierdzone'; end if;
 select to_jsonb(a),a.instructor_number into v_before,v_number from public.instructor_authorizations a where user_id=p_user;
 if v_before is not null and (v_before->>'starts_on')::date=p_start and not (v_before->>'suspended')::boolean then return v_number; end if;
 if v_number is null then
  v_year:=extract(year from now() at time zone 'Europe/Warsaw');
  insert into public.instructor_number_counters(year,last_value) values(v_year,1) on conflict(year) do update set last_value=public.instructor_number_counters.last_value+1 returning last_value into v_serial;
  v_number:='SK-I-'||v_year||'-'||lpad(v_serial::text,greatest(4,length(v_serial::text)),'0');
  insert into public.instructor_numbers(number,user_id) values(v_number,p_user);
 end if;
 insert into public.instructor_authorizations(user_id,instructor_number,starts_on,ends_on) values(p_user,v_number,p_start,(p_start+interval '3 years')::date)
 on conflict(user_id) do update set starts_on=excluded.starts_on,ends_on=excluded.ends_on,suspended=false,updated_at=now() returning to_jsonb(instructor_authorizations.*) into v_after;
 insert into public.admin_audit_log(actor_id,target_id,action,before_data,after_data,reason) values(auth.uid(),p_user,'authorization.grant',v_before,v_after,p_reason);
 insert into public.notification_events(dedupe_key,kind,user_id,payload) values(gen_random_uuid()::text,'authorization_granted',p_user,v_after||jsonb_build_object('email',v_email));
 return v_number;
end; $$;
create function public.admin_suspend_authorization(p_user uuid,p_suspended boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v_before jsonb;v_after jsonb;
begin
 if not public.is_superadmin() then raise exception 'Brak uprawnień' using errcode='42501'; end if;
 if p_suspended is null or length(trim(coalesce(p_reason,'')))<3 then raise exception 'Podaj uzasadnienie'; end if;
 perform 1 from public.profiles where id=p_user for update;
 select to_jsonb(a) into v_before from public.instructor_authorizations a where user_id=p_user;
 if v_before is null then raise exception 'Brak autoryzacji'; end if;
 if (v_before->>'suspended')::boolean=p_suspended then return; end if;
 update public.instructor_authorizations set suspended=p_suspended,updated_at=now() where user_id=p_user returning to_jsonb(instructor_authorizations.*) into v_after;
 insert into public.admin_audit_log(actor_id,target_id,action,before_data,after_data,reason) values(auth.uid(),p_user,'authorization.suspend',v_before,v_after,p_reason);
 insert into public.notification_events(dedupe_key,kind,user_id,payload) select gen_random_uuid()::text,'authorization_status',p_user,v_after||jsonb_build_object('email',email) from public.profiles where id=p_user;
end; $$;
create function public.admin_correct_number(p_user uuid,p_number text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v_before jsonb;v_after jsonb;v_year integer;v_serial integer;
begin
 if not public.is_superadmin() then raise exception 'Brak uprawnień' using errcode='42501'; end if;
 if p_number is null or p_number !~ '^SK-I-[0-9]{4}-[0-9]{4,}$' or length(trim(coalesce(p_reason,'')))<10 then raise exception 'Wymagany poprawny numer i szczegółowe uzasadnienie'; end if;
 perform 1 from public.profiles where id=p_user for update;
 select to_jsonb(a) into v_before from public.instructor_authorizations a where user_id=p_user;
 if v_before is null then raise exception 'Brak autoryzacji'; end if;
 if exists(select 1 from public.instructor_numbers where number=p_number) then raise exception 'Numer był już użyty'; end if;
 v_year:=split_part(p_number,'-',3)::integer;v_serial:=split_part(p_number,'-',4)::integer;
 if v_serial<1 or v_year<>extract(year from (v_before->>'first_assigned_at')::timestamptz at time zone 'Europe/Warsaw') then raise exception 'Korekta musi zachować rok pierwszego nadania'; end if;
 insert into public.instructor_number_counters values(v_year,v_serial) on conflict(year) do update set last_value=greatest(public.instructor_number_counters.last_value,excluded.last_value);
 update public.instructor_numbers set retired_at=now() where user_id=p_user and retired_at is null;
 insert into public.instructor_numbers(number,user_id) values(p_number,p_user);
 update public.instructor_authorizations set instructor_number=p_number,updated_at=now() where user_id=p_user returning to_jsonb(instructor_authorizations.*) into v_after;
 insert into public.admin_audit_log(actor_id,target_id,action,before_data,after_data,reason) values(auth.uid(),p_user,'number.correction',v_before,v_after,p_reason);
end; $$;
-- Service-only queue; bounded leases and SKIP LOCKED permit overlapping workers.
create function public.claim_notifications() returns setof public.notification_events language plpgsql security definer set search_path='' as $$
begin
 update public.notification_events set status='review' where status in ('pending','failed','sending') and first_attempt_at < now()-interval '23 hours';
 return query with candidates as (
 select id from public.notification_events where attempts<12 and next_attempt_at<=now() and (status in ('pending','failed') or (status='sending' and locked_at<now()-interval '5 minutes')) order by created_at for update skip locked limit 20)
 update public.notification_events e set status='sending',attempts=attempts+1,locked_at=now(),lease_id=gen_random_uuid(),first_attempt_at=coalesce(first_attempt_at,now()) from candidates c where e.id=c.id returning e.*;
end; $$;
create function public.finish_notification(p_id uuid,p_lease uuid,p_success boolean,p_detail text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.notification_events where id=p_id and lease_id=p_lease and status='sending' for update;
 if not found then raise exception 'Nieaktualna próba wysyłki'; end if;
 insert into public.notification_attempts(event_id,success,detail) values(p_id,p_success,left(p_detail,300));
 update public.notification_events set status=case when p_success then 'sent' when attempts>=12 then 'review' else 'failed' end,sent_at=case when p_success then now() end,provider_id=case when p_success then p_detail end,next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)),locked_at=null,lease_id=null where id=p_id;
end; $$;
-- Operator only, one-shot. Actual Warsaw assignment year; no public bootstrap endpoint.
create function private.bootstrap_owner(p_user uuid,p_first_number boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare v_year integer:=extract(year from now() at time zone 'Europe/Warsaw');v_number text;
begin
 perform pg_advisory_xact_lock(71927001);
 if exists(select 1 from public.admin_roles) then raise exception 'Pierwszy administrator już istnieje'; end if;
 perform 1 from public.profiles where id=p_user for update;
 if not found then raise exception 'Najpierw potwierdź e-mail właściciela'; end if;
 if p_first_number then
  insert into public.instructor_number_counters values(v_year,1);
  v_number:='SK-I-'||v_year||'-0001';
  insert into public.instructor_numbers(number,user_id) values(v_number,p_user);
  insert into public.instructor_authorizations(user_id,instructor_number,starts_on,ends_on) values(p_user,v_number,(now() at time zone 'Europe/Warsaw')::date,((now() at time zone 'Europe/Warsaw')::date+interval '3 years')::date);
 end if;
 update public.profiles set status='approved',updated_at=now() where id=p_user;
 update public.access_requests set status='approved',decided_at=now(),decided_by=p_user where user_id=p_user;
 insert into public.admin_roles values(p_user,'superadmin',now());
 insert into public.admin_audit_log(actor_id,target_id,action,after_data,reason) values(p_user,p_user,'bootstrap',jsonb_build_object('number',v_number),'Jednorazowa konfiguracja operatora Supabase');
end; $$;

-- Optional later owner assignment, e.g. after bootstrapping admin in 2026.
-- This operator-only function can assign 2027-0001 ONLY during Warsaw year 2027.
create function private.assign_owner_first(p_user uuid,p_year integer,p_start date) returns text language plpgsql security definer set search_path='' as $$
declare v_number text;
begin
 if p_year is null or p_year<>extract(year from now() at time zone 'Europe/Warsaw') or p_start is null then raise exception 'Rok musi odpowiadać faktycznej dacie nadania'; end if;
 perform 1 from public.profiles p join public.admin_roles r on r.user_id=p.id where p.id=p_user and p.status='approved' for update of p;
 if not found then raise exception 'Wymagane zatwierdzone konto superadministratora'; end if;
 if exists(select 1 from public.instructor_authorizations where user_id=p_user) then raise exception 'Właściciel ma już numer'; end if;
 insert into public.instructor_number_counters values(p_year,1);
 v_number:='SK-I-'||p_year||'-0001';
 insert into public.instructor_numbers(number,user_id) values(v_number,p_user);
 insert into public.instructor_authorizations(user_id,instructor_number,starts_on,ends_on) values(p_user,v_number,p_start,(p_start+interval '3 years')::date);
 insert into public.admin_audit_log(actor_id,target_id,action,after_data,reason) values(p_user,p_user,'authorization.grant',jsonb_build_object('number',v_number),'Pierwszy numer właściciela: konfiguracja operatora');
 insert into public.notification_events(dedupe_key,kind,user_id,payload) select 'owner-first:'||p_year,'authorization_granted',p_user,to_jsonb(a)||jsonb_build_object('email',p.email) from public.instructor_authorizations a join public.profiles p on p.id=a.user_id where p.id=p_user;
 return v_number;
end; $$;

do $$ declare t text; begin
 foreach t in array array['profiles','admin_roles','access_requests','instructor_numbers','instructor_authorizations','admin_audit_log','notification_events','notification_attempts','instructor_number_counters'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
grant select on public.profiles,public.admin_roles,public.access_requests,public.instructor_authorizations,public.admin_audit_log,public.notification_events,public.notification_attempts to authenticated;
create policy own_or_admin on public.profiles for select to authenticated using(id=auth.uid() or public.is_superadmin());
create policy own_or_admin on public.admin_roles for select to authenticated using(user_id=auth.uid() or public.is_superadmin());
create policy own_or_admin on public.access_requests for select to authenticated using(user_id=auth.uid() or public.is_superadmin());
create policy own_or_admin on public.instructor_authorizations for select to authenticated using(user_id=auth.uid() or public.is_superadmin());
create policy admin_read on public.admin_audit_log for select to authenticated using(public.is_superadmin());
create policy admin_read on public.notification_events for select to authenticated using(public.is_superadmin());
create policy admin_read on public.notification_attempts for select to authenticated using(public.is_superadmin());

create function public.update_own_profile(p_first_name text,p_last_name text) returns void language plpgsql security definer set search_path='' as $$
declare v_before jsonb;v_after jsonb;
begin
 if auth.uid() is null then raise exception 'Brak uprawnień' using errcode='42501'; end if;
 if p_first_name is null or p_last_name is null or length(trim(p_first_name)) not between 1 and 80 or length(trim(p_last_name)) not between 1 and 80 then raise exception 'Podaj poprawne imię i nazwisko'; end if;
 select to_jsonb(p) into v_before from public.profiles p where id=auth.uid() for update;
 if v_before is null then raise exception 'Brak konta'; end if;
 update public.profiles set first_name=trim(p_first_name),last_name=trim(p_last_name),updated_at=now() where id=auth.uid() returning to_jsonb(profiles.*) into v_after;
 insert into public.admin_audit_log(actor_id,target_id,action,before_data,after_data,reason) values(auth.uid(),auth.uid(),'profile.update',v_before,v_after,'Samodzielna aktualizacja imienia i nazwiska');
end; $$;
revoke all on function public.update_own_profile(text,text) from public,anon,authenticated;
grant execute on function public.update_own_profile(text,text) to authenticated;

revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.is_superadmin(),public.has_active_authorization(),public.admin_account(uuid,text,text),public.admin_authorize(uuid,date,text),public.admin_suspend_authorization(uuid,boolean,text),public.admin_correct_number(uuid,text,text),public.claim_notifications(),public.finish_notification(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.is_superadmin(),public.has_active_authorization(),public.admin_account(uuid,text,text),public.admin_authorize(uuid,date,text),public.admin_suspend_authorization(uuid,boolean,text),public.admin_correct_number(uuid,text,text) to authenticated;
grant execute on function public.claim_notifications(),public.finish_notification(uuid,uuid,boolean,text) to service_role;
commit;
