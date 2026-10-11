-- REVIEW ONLY. Durable deletion intent precedes object deletion, which precedes
-- deleting its owning vehicle. Retry keeps the same intent and object inventory.
begin;
create table if not exists public.security_vehicle_deletions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
  vehicle_id uuid not null unique, status text not null default 'pending' check(status in ('pending','completed')),
  source_paths jsonb not null, calibration_paths jsonb, created_at timestamptz not null default now(), completed_at timestamptz
);
alter table public.security_vehicle_deletions enable row level security;
revoke all on public.security_vehicle_deletions from public,anon,authenticated;
grant all on public.security_vehicle_deletions to service_role;
-- Opaque Calibration paths need an explicit owner inventory. Register before
-- issuing an upload token or writing bytes. Never infer ownership from a hash.
create table if not exists public.security_private_objects (
  path text primary key, owner_id uuid not null references auth.users(id), vehicle_id uuid not null,
  expires_at timestamptz not null, created_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists security_private_objects_owner on public.security_private_objects(owner_id,vehicle_id);
alter table public.security_private_objects enable row level security;
revoke all on public.security_private_objects from public,anon,authenticated;
grant all on public.security_private_objects to service_role;
-- Historical source preservation is separate from expiring Calibration objects.
-- It never infers an owner for unreferenced bytes and has no retention timer.
create table if not exists public.security_source_preservation (
  id uuid primary key default gen_random_uuid(),
  source_bucket text not null check(source_bucket in ('logs','tunes')), source_path text not null,
  destination_bucket text not null, destination_path text not null,
  classification text not null check(classification in ('referenced','quarantine')),
  owner_id uuid references auth.users(id), vehicle_id uuid,
  byte_length bigint not null check(byte_length>=0), sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(), copy_verified_at timestamptz,
  metadata_migrated_at timestamptz, owner_access_verified_at timestamptz,
  old_path_retired_at timestamptz, old_url_denied_at timestamptz,
  unique(source_bucket,source_path), unique(destination_bucket,destination_path),
  check((classification='referenced' and owner_id is not null and vehicle_id is not null
    and destination_bucket=source_bucket
    and destination_path ~ ('^'||owner_id::text||'/'||vehicle_id::text||'/[0-9a-f-]{36}[.](csv|bin|dtf)$'))
    or (classification='quarantine' and owner_id is null and vehicle_id is null
      and destination_bucket='subscriber-source-quarantine' and destination_path ~ '^[0-9a-f-]{36}$')),
  check(old_path_retired_at is null or (copy_verified_at is not null and
    (classification='quarantine' or (metadata_migrated_at is not null and owner_access_verified_at is not null)))),
  check(old_url_denied_at is null or old_path_retired_at is not null)
);
alter table public.security_source_preservation enable row level security;
revoke all on public.security_source_preservation from public,anon,authenticated;
grant all on public.security_source_preservation to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('subscriber-source-quarantine','subscriber-source-quarantine',false,33554432,array['application/octet-stream'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.register_private_objects_v1(p_owner_id uuid,p_vehicle_id uuid,p_paths text[],p_expires_at timestamptz)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare object_path text;
begin
  perform 1 from public.vehicles where id=p_vehicle_id and user_id=p_owner_id for update;
  if not found or exists(select 1 from public.security_vehicle_deletions where vehicle_id=p_vehicle_id)
    or not exists(select 1 from public.profiles where id=p_owner_id and legal_accepted=true and beta_access=true and beta_status='approved' and (beta_expires_at is null or beta_expires_at>now())) then raise exception 'Owned active vehicle required'; end if;
  if p_paths is null or p_expires_at is null or cardinality(p_paths) not between 1 and 8 or p_expires_at<=now() or p_expires_at>now()+interval '31 days' then raise exception 'Invalid inventory'; end if;
  if (select count(*) from (select path from public.security_private_objects where vehicle_id=p_vehicle_id and deleted_at is null and expires_at>now() union select unnest(p_paths)) active_paths)>128 then raise exception 'Private object limit reached'; end if;
  foreach object_path in array p_paths loop
    if object_path is null or object_path !~ '^(raw|sessions|session-active|sources|source-leases|source-active|vehicle-calibration-roles)/[A-Za-z0-9_-]{32,64}$' then raise exception 'Invalid private path'; end if;
    insert into public.security_private_objects(path,owner_id,vehicle_id,expires_at) values(object_path,p_owner_id,p_vehicle_id,p_expires_at)
      on conflict(path) do update set expires_at=excluded.expires_at,deleted_at=null
        where security_private_objects.owner_id=p_owner_id and security_private_objects.vehicle_id=p_vehicle_id;
    if not found then raise exception 'Private path owner mismatch'; end if;
  end loop;
end $$;
revoke all on function public.register_private_objects_v1(uuid,uuid,text[],timestamptz) from public,anon,authenticated;
grant execute on function public.register_private_objects_v1(uuid,uuid,text[],timestamptz) to service_role;
create or replace function tunesight_security.owns_vehicle(v uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select tunesight_security.beta_allowed() and exists(select 1 from public.vehicles where id=v and user_id=auth.uid())
    and not exists(select 1 from public.security_vehicle_deletions where vehicle_id=v);
$$;
create or replace function public.prepare_vehicle_deletion_v1(p_vehicle_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare job uuid; paths jsonb;
begin
  if not tunesight_security.beta_allowed() then raise exception 'Approved beta required'; end if;
  perform 1 from public.vehicles where id=p_vehicle_id and user_id=auth.uid() for update;
  if not found then
    select id into job from public.security_vehicle_deletions where vehicle_id=p_vehicle_id and owner_id=auth.uid() and status='completed';
    if found then return job; end if;
    raise exception 'Owned vehicle required';
  end if;
  if exists(select 1 from public.security_calibration_repair_leases where vehicle_id=p_vehicle_id and expires_at>now()) then raise exception 'Calibration operation in progress; retry deletion shortly'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',name)),'[]') into paths
    from (select bucket_id,name from storage.objects where bucket_id in ('logs','tunes')
      and name like auth.uid()::text || '/' || p_vehicle_id::text || '/%' limit 5001) objects;
  if jsonb_array_length(paths)>5000 then raise exception 'Deletion inventory exceeds bounded operation'; end if;
  insert into public.security_vehicle_deletions(owner_id,vehicle_id,source_paths) values(auth.uid(),p_vehicle_id,paths)
    on conflict(vehicle_id) do update set source_paths=excluded.source_paths where security_vehicle_deletions.owner_id=auth.uid() returning id into job;
  return job;
end $$;
create or replace function public.finish_vehicle_deletion_v1(p_job_id uuid,p_owner_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare job public.security_vehicle_deletions%rowtype;
begin
  select * into job from public.security_vehicle_deletions where id=p_job_id and owner_id=p_owner_id for update;
  if not found or job.calibration_paths is null then raise exception 'Deletion inventory unavailable'; end if;
  if job.status='completed' then return; end if;
  if exists(select 1 from storage.objects where bucket_id in ('logs','tunes') and name like p_owner_id::text || '/' || job.vehicle_id::text || '/%') then raise exception 'Source objects remain'; end if;
  if exists(select 1 from storage.objects where bucket_id='subscriber-calibration-private' and name in(select jsonb_array_elements_text(job.calibration_paths))) then raise exception 'Calibration objects remain'; end if;
  -- The existing log_uploads vehicle FK uses ON DELETE SET NULL. Remove its
  -- owned evidence tree explicitly so that legacy action cannot orphan it.
  delete from public.log_uploads where vehicle_id=job.vehicle_id and user_id=p_owner_id;
  delete from public.vehicles where id=job.vehicle_id and user_id=p_owner_id;
  update public.security_vehicle_deletions set status='completed',completed_at=now() where id=job.id;
end $$;
revoke all on function public.prepare_vehicle_deletion_v1(uuid) from public,anon;
grant execute on function public.prepare_vehicle_deletion_v1(uuid) to authenticated;
revoke all on function public.finish_vehicle_deletion_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.finish_vehicle_deletion_v1(uuid,uuid) to service_role;

-- Block service-role evidence writers too once deletion has begun. Deletion
-- itself uses DELETE and is allowed only through the trusted outbox completion.
create or replace function tunesight_security.guard_pending_vehicle_write()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  -- Take the same parent lock as deletion intent, including updates whose FK
  -- values did not change and therefore would not otherwise lock the vehicle.
  perform 1 from public.vehicles where id=new.vehicle_id for update;
  if not found then raise exception 'Owned vehicle required for evidence write'; end if;
  if exists(select 1 from public.security_vehicle_deletions where vehicle_id=new.vehicle_id) then raise exception 'Vehicle deletion is pending'; end if;
  return new;
end $$;
revoke all on function tunesight_security.guard_pending_vehicle_write() from public,anon,authenticated;
do $migration$
declare t text;
begin
  foreach t in array array['logs','log_uploads','log_summaries','tunes','tune_profiles','vehicle_setup_snapshots'] loop
    execute format('drop trigger if exists security_pending_deletion on public.%I',t);
    execute format('create trigger security_pending_deletion before insert or update on public.%I for each row execute function tunesight_security.guard_pending_vehicle_write()',t);
  end loop;
end $migration$;
-- Direct browser DELETE cannot bypass storage cleanup. Service-role completion
-- uses the function above after verifying the durable inventory is empty.
drop policy if exists security_vehicle_delete_outbox on public.vehicles;
create policy security_vehicle_delete_outbox on public.vehicles as restrictive for delete to authenticated using(false);

-- Serializes storage writes with deletion intent, including previously issued
-- signed upload URLs and trusted server writers. No vehicle bytes are inspected.
create or replace function tunesight_security.guard_storage_vehicle_write()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare owned_vehicle uuid; owned_user uuid; parts text[];
begin
  if new.bucket_id in ('logs','tunes') then
    parts:=string_to_array(new.name,'/');
    if cardinality(parts)<>3 then raise exception 'Owned source path required'; end if;
    begin owned_user:=parts[1]::uuid; owned_vehicle:=parts[2]::uuid; exception when invalid_text_representation then raise exception 'Owned source path required'; end;
  elsif new.bucket_id='subscriber-calibration-private' then
    select owner_id,vehicle_id into owned_user,owned_vehicle from public.security_private_objects where path=new.name and deleted_at is null and expires_at>now();
    if not found then raise exception 'Registered private object required'; end if;
  elsif new.bucket_id='subscriber-source-quarantine' then
    if not exists(select 1 from public.security_source_preservation where destination_bucket=new.bucket_id
      and destination_path=new.name and classification='quarantine') then raise exception 'Registered quarantine object required'; end if;
    return new;
  else return new;
  end if;
  perform 1 from public.vehicles where id=owned_vehicle and user_id=owned_user for update;
  if not found or exists(select 1 from public.security_vehicle_deletions where vehicle_id=owned_vehicle) then raise exception 'Vehicle unavailable for storage write'; end if;
  return new;
end $$;
drop trigger if exists security_storage_vehicle_write on storage.objects;
create trigger security_storage_vehicle_write before insert or update on storage.objects for each row execute function tunesight_security.guard_storage_vehicle_write();
create or replace function tunesight_security.mark_private_object_deleted()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if old.bucket_id='subscriber-calibration-private' then update public.security_private_objects set deleted_at=now() where path=old.name; end if;
  return old;
end $$;
drop trigger if exists security_private_object_deleted on storage.objects;
create trigger security_private_object_deleted after delete on storage.objects for each row execute function tunesight_security.mark_private_object_deleted();
revoke all on function tunesight_security.guard_storage_vehicle_write(),tunesight_security.mark_private_object_deleted() from public,anon,authenticated;
commit;
