-- REVIEW ONLY: do not apply to Production without a separate release approval.
-- Adds restrictive guards; does not remove or infer the existing permissive policies.
begin;
create schema if not exists tunesight_security;
revoke all on schema tunesight_security from public, anon;
grant usage on schema tunesight_security to authenticated, service_role;

create or replace function tunesight_security.beta_allowed()
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid()
    and p.legal_accepted is true and p.beta_access is true and p.beta_status = 'approved'
    and (p.beta_expires_at is null or p.beta_expires_at > now()));
$$;
create or replace function tunesight_security.owns_vehicle(v uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select tunesight_security.beta_allowed() and exists(
    select 1 from public.vehicles where id = v and user_id = auth.uid());
$$;
create or replace function tunesight_security.owns_upload(u uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists(select 1 from public.log_uploads where id = u and user_id = auth.uid()
    and tunesight_security.owns_vehicle(vehicle_id));
$$;
create or replace function tunesight_security.owns_pull(p uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists(select 1 from public.pulls where id = p and tunesight_security.owns_upload(log_upload_id));
$$;
revoke all on all functions in schema tunesight_security from public, anon;
grant execute on all functions in schema tunesight_security to authenticated, service_role;

-- Restrictive policies also defeat a pre-existing broad permissive owner policy.
do $migration$
declare t text; predicate text;
begin
  foreach t in array array['profiles','vehicles','logs','log_uploads','log_summaries','tunes','tune_profiles',
    'vehicle_setup_snapshots','pulls','analysis_runs','reports','metric_summaries','pull_series_data','flags',
    'acquired_xdf_source_artifacts','acquired_xdf_candidate_relationships','acquired_xdf_contribution_receipts'] loop
    if to_regclass('public.' || t) is null then raise exception 'Required baseline table missing: %', t; end if;
    predicate := case
      when t = 'profiles' then 'id = auth.uid()'
      when t = 'vehicles' then 'user_id = auth.uid() and tunesight_security.beta_allowed()'
      when t in ('logs','log_uploads','log_summaries','tunes','tune_profiles') then 'user_id = auth.uid() and tunesight_security.owns_vehicle(vehicle_id)'
      when t = 'vehicle_setup_snapshots' then 'tunesight_security.owns_vehicle(vehicle_id)'
      when t in ('pulls','analysis_runs') then 'tunesight_security.owns_upload(log_upload_id)'
      when t in ('reports','metric_summaries','pull_series_data','flags') then 'tunesight_security.owns_pull(pull_id)'
      when t = 'acquired_xdf_contribution_receipts' then 'owner_id = auth.uid() and tunesight_security.beta_allowed()'
      else 'false' end;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists security_baseline_guard on public.%I', t);
    execute format('create policy security_baseline_guard on public.%I as restrictive for all to authenticated using (%s) with check (%s)', t, predicate, predicate);
    execute format('revoke all on public.%I from anon', t);
    -- These SQL privileges bypass ordinary row filtering or are unnecessary for
    -- subscriber API use. The live metadata export confirmed broad old grants.
    execute format('revoke truncate, references, trigger on public.%I from public, authenticated', t);
    execute format('drop policy if exists security_baseline_anon_guard on public.%I', t);
    execute format('create policy security_baseline_anon_guard on public.%I as restrictive for all to anon using (false) with check (false)', t);
  end loop;
end $migration$;

-- Privilege revocation includes inherited PUBLIC and column grants. The trigger is
-- an independent guard against protected-field changes via an old broad grant.
revoke all on public.profiles from public, anon, authenticated;
do $migration$
declare c record;
begin
  for c in select column_name from information_schema.columns where table_schema='public' and table_name='profiles' loop
    execute format('revoke insert (%I), update (%I), references (%I) on public.profiles from public, anon, authenticated', c.column_name,c.column_name,c.column_name);
  end loop;
end $migration$;
grant select on public.profiles to authenticated;
grant update (display_name, full_name, legal_accepted, legal_version, accepted_at) on public.profiles to authenticated;
drop policy if exists security_profile_read on public.profiles;
create policy security_profile_read on public.profiles for select to authenticated using (id=auth.uid());
drop policy if exists security_profile_edit on public.profiles;
create policy security_profile_edit on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
create or replace function tunesight_security.guard_profile_authority()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if current_user in ('anon','authenticated') then
    if tg_op = 'INSERT' then raise exception 'Profile creation requires trusted signup'; end if;
    if (to_jsonb(new) - array['display_name','full_name','legal_accepted','legal_version','accepted_at'])
      is distinct from (to_jsonb(old) - array['display_name','full_name','legal_accepted','legal_version','accepted_at'])
      then raise exception 'Profile authority is server owned'; end if;
  end if;
  return new;
end $$;
drop trigger if exists security_profile_authority on public.profiles;
create trigger security_profile_authority before insert or update on public.profiles
  for each row execute function tunesight_security.guard_profile_authority();
create or replace function tunesight_security.create_signup_profile()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  insert into public.profiles(id,email,full_name,role,beta_access,beta_status,legal_accepted)
    values(new.id,new.email,left(new.raw_user_meta_data->>'full_name',200),'user',false,'pending',false)
    on conflict(id) do update set role='user',beta_access=false,beta_status='pending',legal_accepted=false;
  -- Never consume role/plan/beta claims from user-editable signup metadata.
  return new;
end $$;
drop trigger if exists security_signup_profile on auth.users;
create trigger security_signup_profile after insert on auth.users
  for each row execute function tunesight_security.create_signup_profile();
revoke all on function tunesight_security.guard_profile_authority(), tunesight_security.create_signup_profile() from public, anon, authenticated;

create index if not exists security_vehicles_owner on public.vehicles(user_id,id);
create unique index if not exists security_vehicles_identity on public.vehicles(id,user_id);
do $migration$
declare t text;
begin
  foreach t in array array['logs','log_uploads','log_summaries','tunes','tune_profiles'] loop
    execute format('create index if not exists %I on public.%I(user_id,vehicle_id,id)', 'security_' || t || '_owner', t);
    if not exists(select 1 from pg_constraint where conrelid=('public.' || t)::regclass and conname='security_owned_vehicle_fk') then
      execute format('alter table public.%I add constraint security_owned_vehicle_fk foreign key(vehicle_id,user_id) references public.vehicles(id,user_id) on delete cascade not valid',t);
    end if;
  end loop;
end $migration$;

-- New uploads: one identity per owner/vehicle/kind/content, renewable 30-minute
-- processing lease. The reservation survives interruption; only a matching lease
-- can finish it. No automatic deletion of existing evidence is introduced.
create table if not exists public.security_upload_attempts (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
  vehicle_id uuid not null, kind text not null check(kind in ('log','tune')),
  digest text not null check(digest ~ '^[0-9a-f]{64}$'), resource_id uuid not null unique default gen_random_uuid(),
  token uuid not null default gen_random_uuid(), status text not null default 'processing' check(status in ('processing','failed','completed')),
  lease_until timestamptz not null default now()+interval '30 minutes', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(owner_id,vehicle_id,kind,digest), foreign key(vehicle_id,owner_id) references public.vehicles(id,user_id) on delete cascade
);
alter table public.security_upload_attempts enable row level security;
revoke all on public.security_upload_attempts from public,anon,authenticated;
grant select on public.security_upload_attempts to authenticated;
grant all on public.security_upload_attempts to service_role;
drop policy if exists security_upload_owner on public.security_upload_attempts;
create policy security_upload_owner on public.security_upload_attempts for select to authenticated
  using(owner_id=auth.uid() and tunesight_security.owns_vehicle(vehicle_id));
create or replace function public.claim_security_upload_v1(p_vehicle_id uuid,p_kind text,p_digest text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a public.security_upload_attempts%rowtype; outcome text;
begin
  perform 1 from public.vehicles where id=p_vehicle_id and user_id=auth.uid() for update;
  if not tunesight_security.owns_vehicle(p_vehicle_id) then raise exception 'Owned vehicle required'; end if;
  if p_kind not in ('log','tune') or p_digest !~ '^[0-9a-f]{64}$' then raise exception 'Invalid reservation'; end if;
  if not exists(select 1 from public.security_upload_attempts where owner_id=auth.uid() and vehicle_id=p_vehicle_id and kind=p_kind and digest=p_digest)
    and (select count(*) from public.security_upload_attempts where owner_id=auth.uid() and vehicle_id=p_vehicle_id and status='processing' and lease_until>now())>=3 then raise exception 'Upload concurrency limit reached; retry after current leases complete'; end if;
  insert into public.security_upload_attempts(owner_id,vehicle_id,kind,digest)
    values(auth.uid(),p_vehicle_id,p_kind,p_digest) on conflict do nothing returning * into a;
  if found then outcome := 'claimed';
  else
    select * into a from public.security_upload_attempts where owner_id=auth.uid() and vehicle_id=p_vehicle_id and kind=p_kind and digest=p_digest for update;
    if a.status='completed' then outcome := 'completed';
    elsif a.status='processing' and a.lease_until>now() then outcome := 'busy';
    else
      if (select count(*) from public.security_upload_attempts where owner_id=auth.uid() and vehicle_id=p_vehicle_id and status='processing' and lease_until>now())>=3 then raise exception 'Upload concurrency limit reached; retry after current leases complete'; end if;
      update public.security_upload_attempts set token=gen_random_uuid(),status='processing',lease_until=now()+interval '30 minutes',updated_at=now() where id=a.id returning * into a;
      outcome := 'claimed';
    end if;
  end if;
  return jsonb_build_object('id',a.id,'token',case when outcome='claimed' then a.token else null end,'resource_id',a.resource_id,'outcome',outcome);
end $$;
create or replace function public.finish_security_upload_v1(p_id uuid,p_token uuid,p_completed boolean)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
  update public.security_upload_attempts set status=case when p_completed then 'completed' else 'failed' end, updated_at=now()
    where id=p_id and token=p_token and owner_id=auth.uid() and tunesight_security.owns_vehicle(vehicle_id) and status='processing' and lease_until>now();
  if not found then raise exception 'Upload lease no longer active'; end if;
end $$;
revoke all on function public.claim_security_upload_v1(uuid,text,text), public.finish_security_upload_v1(uuid,uuid,boolean) from public,anon;
grant execute on function public.claim_security_upload_v1(uuid,text,text), public.finish_security_upload_v1(uuid,uuid,boolean) to authenticated;
-- Derived evidence and its source registrations are written only by the
-- owner-checked server pipeline. Ownership alone is not permission to forge a
-- qualification marker, summary, source pointer or Tune profile through REST.
do $migration$
declare t text; operation text;
begin
  foreach t in array array['logs','log_uploads','log_summaries','tunes','tune_profiles','vehicle_setup_snapshots',
    'pulls','analysis_runs','reports','metric_summaries','pull_series_data','flags','acquired_xdf_contribution_receipts'] loop
    foreach operation in array array['insert','update','delete'] loop
      execute format('drop policy if exists %I on public.%I','security_server_'||operation,t);
      if operation='insert' then
        execute format('create policy %I on public.%I as restrictive for insert to authenticated with check(false)','security_server_'||operation,t);
      elsif operation='update' then
        execute format('create policy %I on public.%I as restrictive for update to authenticated using(false) with check(false)','security_server_'||operation,t);
      else
        execute format('create policy %I on public.%I as restrictive for delete to authenticated using(false)','security_server_'||operation,t);
      end if;
    end loop;
  end loop;
end $migration$;

-- Bounded private source buckets. Updates/replacements are not admitted by this
-- policy; duplicate retries verify the immutable object content instead.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('logs','logs',false,4194304,array['text/csv','application/octet-stream']),
      ('tunes','tunes',false,33554432,array['application/octet-stream','application/x-binary'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function tunesight_security.owns_source_object(bucket text, object_name text)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare parts text[];
begin
  if bucket not in ('logs','tunes') then return false; end if;
  parts:=string_to_array(object_name,'/');
  if cardinality(parts)<>3 or parts[1]<>auth.uid()::text or parts[2] !~ '^[0-9a-fA-F-]{36}$'
    or parts[3] !~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,254}$' or position('..' in parts[3])>0 then return false; end if;
  return tunesight_security.owns_vehicle(parts[2]::uuid);
exception when invalid_text_representation then return false;
end $$;
revoke all on function tunesight_security.owns_source_object(text,text) from public,anon;
grant execute on function tunesight_security.owns_source_object(text,text) to authenticated;
drop policy if exists security_storage_guard on storage.objects;
create policy security_storage_guard on storage.objects as restrictive for all to authenticated
  using(tunesight_security.owns_source_object(bucket_id,name)) with check(tunesight_security.owns_source_object(bucket_id,name));
drop policy if exists security_storage_anon_guard on storage.objects;
create policy security_storage_anon_guard on storage.objects as restrictive for all to anon using(false) with check(false);
drop policy if exists security_source_read on storage.objects;
create policy security_source_read on storage.objects for select to authenticated using(tunesight_security.owns_source_object(bucket_id,name));
-- Subscribers must not mint arbitrarily long-lived bearer URLs or warm an
-- authenticated CDN response that outlives entitlement changes. Source reads,
-- inspection and 60-second signing run through owner-checked server handlers.
drop policy if exists security_source_server_read on storage.objects;
create policy security_source_server_read on storage.objects as restrictive for select to authenticated using(false);
drop policy if exists security_source_insert on storage.objects;
create policy security_source_insert on storage.objects for insert to authenticated with check(tunesight_security.owns_source_object(bucket_id,name));
drop policy if exists security_source_no_replace on storage.objects;
create policy security_source_no_replace on storage.objects as restrictive for update to authenticated using(false) with check(false);
create or replace function tunesight_security.source_upload_reserved(bucket text,object_name text)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.security_upload_attempts a where a.owner_id=auth.uid() and a.status='processing' and a.lease_until>now()
    and ((bucket='logs' and a.kind='log' and object_name=a.owner_id::text||'/'||a.vehicle_id::text||'/'||a.resource_id::text||'.csv')
      or (bucket='tunes' and a.kind='tune' and object_name in(a.owner_id::text||'/'||a.vehicle_id::text||'/'||a.resource_id::text||'.bin',a.owner_id::text||'/'||a.vehicle_id::text||'/'||a.resource_id::text||'.dtf'))));
$$;
revoke all on function tunesight_security.source_upload_reserved(text,text) from public,anon;
grant execute on function tunesight_security.source_upload_reserved(text,text) to authenticated;
drop policy if exists security_source_reservation on storage.objects;
create policy security_source_reservation on storage.objects as restrictive for insert to authenticated with check(tunesight_security.source_upload_reserved(bucket_id,name));
drop policy if exists security_source_delete_outbox on storage.objects;
create policy security_source_delete_outbox on storage.objects as restrictive for delete to authenticated using(false);
commit;
