-- Explicit repair is serialized across processes; this is not an in-memory rate limiter.
begin;
create table if not exists public.security_calibration_repair_leases (
  vehicle_id uuid primary key references public.vehicles(id) on delete cascade,
  owner_id uuid not null references auth.users(id), token uuid not null, expires_at timestamptz not null
);
alter table public.security_calibration_repair_leases enable row level security;
revoke all on public.security_calibration_repair_leases from public,anon,authenticated;
grant all on public.security_calibration_repair_leases to service_role;
create or replace function public.claim_calibration_repair_v1(p_vehicle_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare result uuid;
begin
  perform 1 from public.vehicles where id=p_vehicle_id and user_id=auth.uid() for update;
  if not tunesight_security.owns_vehicle(p_vehicle_id) then raise exception 'Owned vehicle required'; end if;
  insert into public.security_calibration_repair_leases(vehicle_id,owner_id,token,expires_at)
    values(p_vehicle_id,auth.uid(),gen_random_uuid(),now()+interval '2 minutes')
    on conflict(vehicle_id) do update set token=excluded.token,expires_at=excluded.expires_at
      where security_calibration_repair_leases.expires_at<=now() and security_calibration_repair_leases.owner_id=auth.uid()
    returning token into result;
  return result;
end $$;
create or replace function public.release_calibration_repair_v1(p_vehicle_id uuid,p_token uuid)
returns void language sql security definer set search_path=pg_catalog as $$
  delete from public.security_calibration_repair_leases where vehicle_id=p_vehicle_id and token=p_token and owner_id=auth.uid();
$$;
revoke all on function public.claim_calibration_repair_v1(uuid),public.release_calibration_repair_v1(uuid,uuid) from public,anon;
grant execute on function public.claim_calibration_repair_v1(uuid),public.release_calibration_repair_v1(uuid,uuid) to authenticated;
commit;
