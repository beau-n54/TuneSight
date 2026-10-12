-- R04 expand-only. Apply before the compatible application. No source objects,
-- binary snapshots, existing Working data, or existing tables are rewritten.
begin;
create unique index if not exists vehicles_id_owner_working on public.vehicles(id,user_id);
create table if not exists public.calibration_working_scopes (
  scope_id text primary key check(scope_id ~ '^[0-9a-f]{64}$'),
  owner_id uuid not null references auth.users(id), vehicle_id uuid not null,
  session_id text not null check(length(session_id) between 16 and 128),
  identity_text text not null check(octet_length(identity_text) <= 8192),
  head_id uuid, next_sequence integer not null default 1,
  foreign key(vehicle_id,owner_id) references public.vehicles(id,user_id) on delete cascade,
  check(scope_id = encode(sha256(convert_to(identity_text,'UTF8')),'hex'))
);
create index if not exists working_scope_owner_vehicle on public.calibration_working_scopes(owner_id,vehicle_id,session_id);
create table if not exists public.calibration_working_revisions (
  id uuid primary key default gen_random_uuid(), scope_id text not null references public.calibration_working_scopes(scope_id) on delete cascade,
  sequence integer not null check(sequence > 0), author_id uuid not null references auth.users(id),
  parent_id uuid, previous_head_id uuid, restored_from_id uuid,
  idempotency_key uuid not null, request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'),
  payload_text text not null check(octet_length(payload_text) between 2 and 2097152),
  content_hash text not null check(content_hash = encode(sha256(convert_to(payload_text,'UTF8')),'hex')),
  contract_version text not null default 'tunesight.durable-working.v1' check(contract_version = 'tunesight.durable-working.v1'),
  capability_state text not null default 'EDIT_ONLY_OUTPUT_LOCKED' check(capability_state = 'EDIT_ONLY_OUTPUT_LOCKED'),
  created_at timestamptz not null default now(),
  unique(scope_id,id), unique(scope_id,sequence), unique(scope_id,idempotency_key),
  foreign key(scope_id,parent_id) references public.calibration_working_revisions(scope_id,id) deferrable initially deferred,
  foreign key(scope_id,previous_head_id) references public.calibration_working_revisions(scope_id,id) deferrable initially deferred,
  foreign key(scope_id,restored_from_id) references public.calibration_working_revisions(scope_id,id) deferrable initially deferred,
  check(jsonb_typeof(payload_text::jsonb) = 'object')
);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='working_scope_head_fk') then
    alter table public.calibration_working_scopes add constraint working_scope_head_fk foreign key(scope_id,head_id)
      references public.calibration_working_revisions(scope_id,id) deferrable initially deferred;
  end if;
end $$;
alter table public.calibration_working_scopes enable row level security;
alter table public.calibration_working_revisions enable row level security;
revoke all on public.calibration_working_scopes,public.calibration_working_revisions from public,anon,authenticated,service_role;
grant select on public.calibration_working_scopes,public.calibration_working_revisions to authenticated,service_role;
drop policy if exists working_scope_owner_read on public.calibration_working_scopes;
create policy working_scope_owner_read on public.calibration_working_scopes for select to authenticated
  using(owner_id=auth.uid() and tunesight_security.owns_vehicle(vehicle_id));
drop policy if exists working_revision_owner_read on public.calibration_working_revisions;
create policy working_revision_owner_read on public.calibration_working_revisions for select to authenticated
  using(exists(select 1 from public.calibration_working_scopes s where s.scope_id=calibration_working_revisions.scope_id));
create or replace function tunesight_security.immutable_working_revision()
returns trigger language plpgsql set search_path=pg_catalog as $$ begin
  if TG_OP='UPDATE' then raise exception 'WORKING_REVISION_IMMUTABLE'; end if;
  return OLD;
end $$;
drop trigger if exists immutable_working_revision on public.calibration_working_revisions;
create trigger immutable_working_revision before update on public.calibration_working_revisions
  for each row execute function tunesight_security.immutable_working_revision();

-- One vehicle lock serialises head CAS, quotas, idempotency, and governed vehicle
-- deletion. The server replays mutations against fresh admitted evidence first.
create or replace function public.save_calibration_working_v1(
  p_owner uuid,p_vehicle uuid,p_session text,p_identity text,p_expected uuid,
  p_parent uuid,p_restore uuid,p_key uuid,p_request_hash text,p_payload text
) returns public.calibration_working_revisions language plpgsql security definer set search_path=pg_catalog as $$
declare sid text:=encode(sha256(convert_to(p_identity,'UTF8')),'hex');
  s public.calibration_working_scopes; r public.calibration_working_revisions; n bigint; bytes bigint;
begin
  perform 1 from public.vehicles v join public.profiles p on p.id=v.user_id
    where v.id=p_vehicle and v.user_id=p_owner and p.legal_accepted is true and p.beta_access is true
      and p.beta_status='approved' and (p.beta_expires_at is null or p.beta_expires_at>now()) for update of v;
  if not found or exists(select 1 from public.security_vehicle_deletions where vehicle_id=p_vehicle and status='pending')
    then raise exception 'WORKING_SCOPE_UNAVAILABLE'; end if;
  if p_identity::jsonb->>'ownerId' is distinct from p_owner::text or p_identity::jsonb->>'vehicleId' is distinct from p_vehicle::text
    or p_identity::jsonb->>'sessionId' is distinct from p_session then raise exception 'WORKING_SCOPE_MISMATCH'; end if;
  insert into public.calibration_working_scopes(scope_id,owner_id,vehicle_id,session_id,identity_text)
    values(sid,p_owner,p_vehicle,p_session,p_identity) on conflict do nothing;
  select * into strict s from public.calibration_working_scopes where scope_id=sid for update;
  if s.owner_id<>p_owner or s.vehicle_id<>p_vehicle or s.session_id<>p_session or s.identity_text<>p_identity then raise exception 'WORKING_SCOPE_MISMATCH'; end if;
  select * into r from public.calibration_working_revisions where scope_id=sid and idempotency_key=p_key;
  if found then
    if r.request_hash<>p_request_hash or r.payload_text<>p_payload or r.parent_id is distinct from p_parent
      or r.previous_head_id is distinct from p_expected or r.restored_from_id is distinct from p_restore then raise exception 'WORKING_IDEMPOTENCY_CONFLICT'; end if;
    return r;
  end if;
  if s.head_id is distinct from p_expected then raise exception 'WORKING_HEAD_CONFLICT'; end if;
  if (p_restore is null and p_parent is distinct from s.head_id) or (p_restore is not null and p_parent is distinct from p_restore)
    then raise exception 'WORKING_PARENT_MISMATCH'; end if;
  if p_restore is not null and not exists(select 1 from public.calibration_working_revisions where scope_id=sid and id=p_restore and payload_text=p_payload)
    then raise exception 'WORKING_RESTORE_MISMATCH'; end if;
  select count(*),coalesce(sum(octet_length(r1.payload_text)),0) into n,bytes from public.calibration_working_revisions r1
    join public.calibration_working_scopes s1 using(scope_id) where s1.vehicle_id=p_vehicle;
  if n>=128 or bytes+octet_length(p_payload)>67108864 then raise exception 'WORKING_RETENTION_LIMIT'; end if;
  insert into public.calibration_working_revisions(scope_id,sequence,author_id,parent_id,previous_head_id,restored_from_id,idempotency_key,request_hash,payload_text,content_hash)
    values(sid,s.next_sequence,p_owner,p_parent,p_expected,p_restore,p_key,p_request_hash,p_payload,encode(sha256(convert_to(p_payload,'UTF8')),'hex')) returning * into r;
  update public.calibration_working_scopes set head_id=r.id,next_sequence=s.next_sequence+1 where scope_id=sid;
  return r;
end $$;
revoke all on function public.save_calibration_working_v1(uuid,uuid,text,text,uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.save_calibration_working_v1(uuid,uuid,text,text,uuid,uuid,uuid,uuid,text,text) to service_role;
-- One bounded read can overlap fresh session storage validation. The application
-- checks the returned complete scope against that session before exposing it.
create or replace function public.read_calibration_working_v1(p_owner uuid,p_vehicle uuid,p_session text)
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
  select coalesce(jsonb_agg(row_to_json(candidate)), '[]'::jsonb) from (
    select s.scope_id,s.identity_text,
      (select to_jsonb(r) from public.calibration_working_revisions r where r.scope_id=s.scope_id and r.id=s.head_id) as head,
      (select coalesce(jsonb_agg(to_jsonb(h)-'payload_text'-'request_hash'-'idempotency_key'-'author_id'-'scope_id' order by h.sequence desc),'[]'::jsonb)
        from public.calibration_working_revisions h where h.scope_id=s.scope_id) as history
    from public.calibration_working_scopes s where s.owner_id=p_owner and s.vehicle_id=p_vehicle and s.session_id=p_session limit 2
  ) candidate;
$$;
revoke all on function public.read_calibration_working_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.read_calibration_working_v1(uuid,uuid,text) to service_role;
commit;
