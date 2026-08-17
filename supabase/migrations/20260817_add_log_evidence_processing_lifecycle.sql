begin;

alter table public.logs
  add column raw_source_storage_path text null default null,
  add column evidence_source_availability text not null default 'unknown',
  add column evidence_lifecycle_state text not null default 'legacy_unclassified',
  add column evidence_processing_contract_version text null default null,
  add column evidence_processing_stage text null default null,
  add column evidence_processing_outcome_kind text null default null,
  add column evidence_logger_platform text null default null,
  add column evidence_processing_reason_code text null default null,
  add column evidence_retry_disposition text null default null,
  add column evidence_diagnostic_reference text null default null,
  add column evidence_processing_started_at timestamptz null default null,
  add column evidence_processing_completed_at timestamptz null default null,
  add column authoritative_log_summary_id uuid null default null;

alter table public.logs
  add constraint logs_evidence_source_availability_check
  check (evidence_source_availability in ('available', 'unavailable', 'unknown')),
  add constraint logs_evidence_lifecycle_state_check
  check (evidence_lifecycle_state in ('legacy_unclassified', 'processing', 'terminal')),
  add constraint logs_evidence_processing_stage_check
  check (
    evidence_processing_stage is null
    or evidence_processing_stage in (
      'source_registration',
      'raw_source_storage',
      'source_classification',
      'translation',
      'evidence_derivation',
      'evidence_persistence'
    )
  ),
  add constraint logs_evidence_processing_outcome_kind_check
  check (
    evidence_processing_outcome_kind is null
    or evidence_processing_outcome_kind in (
      'evidence_established',
      'unsupported_source',
      'invalid_or_incomplete_source',
      'processing_failed',
      'persistence_failed'
    )
  ),
  add constraint logs_evidence_logger_platform_check
  check (
    evidence_logger_platform is null
    or evidence_logger_platform in ('mhd', 'bm3', 'dimsport', 'protool', 'xhp', 'unknown')
  ),
  add constraint logs_evidence_retry_disposition_check
  check (
    evidence_retry_disposition is null
    or evidence_retry_disposition in (
      'not_required',
      'retryable_from_source',
      'not_retryable',
      'retryability_unknown'
    )
  ),
  add constraint logs_evidence_processing_reason_code_check
  check (
    evidence_processing_reason_code is null
    or evidence_processing_reason_code in (
      'unknown_source_format',
      'translator_unavailable',
      'no_usable_rows',
      'missing_required_core_channels',
      'invalid_source_observations',
      'insufficient_usable_evidence',
      'source_registration_failure',
      'raw_source_storage_failure',
      'source_classification_failure',
      'translation_processing_failure',
      'evidence_derivation_failure',
      'authoritative_evidence_write_failure'
    )
  ),
  add constraint logs_evidence_diagnostic_reference_check
  check (
    evidence_diagnostic_reference is null
    or (
      char_length(evidence_diagnostic_reference) between 1 and 255
      and evidence_diagnostic_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]*$'
    )
  ),
  add constraint logs_evidence_source_path_check
  check (
    evidence_source_availability <> 'available'
    or nullif(btrim(raw_source_storage_path), '') is not null
  ),
  add constraint logs_evidence_processing_timestamp_check
  check (
    evidence_processing_completed_at is null
    or (
      evidence_processing_started_at is not null
      and evidence_processing_completed_at >= evidence_processing_started_at
    )
  ),
  add constraint logs_evidence_lifecycle_shape_check
  check (
    (
      evidence_lifecycle_state = 'legacy_unclassified'
      and evidence_source_availability = 'unknown'
      and evidence_processing_contract_version is null
      and evidence_processing_stage is null
      and evidence_processing_outcome_kind is null
      and evidence_logger_platform is null
      and evidence_processing_reason_code is null
      and evidence_retry_disposition is null
      and evidence_diagnostic_reference is null
      and evidence_processing_started_at is null
      and evidence_processing_completed_at is null
    )
    or (
      evidence_lifecycle_state = 'processing'
      and evidence_processing_contract_version = '1.0'
      and evidence_processing_stage is not null
      and evidence_processing_outcome_kind is null
      and evidence_processing_reason_code is null
      and evidence_retry_disposition is null
      and evidence_diagnostic_reference is null
      and evidence_processing_started_at is not null
      and evidence_processing_completed_at is null
    )
    or (
      evidence_lifecycle_state = 'terminal'
      and evidence_processing_contract_version = '1.0'
      and evidence_processing_stage is not null
      and evidence_processing_outcome_kind is not null
      and evidence_retry_disposition is not null
      and evidence_processing_started_at is not null
      and evidence_processing_completed_at is not null
    )
  ),
  add constraint logs_evidence_terminal_compatibility_check
  check (
    evidence_lifecycle_state <> 'terminal'
    or case evidence_processing_outcome_kind
      when 'evidence_established' then
        evidence_processing_stage = 'evidence_persistence'
        and evidence_retry_disposition = 'not_required'
        and evidence_processing_reason_code is null
        and evidence_diagnostic_reference is null
        and authoritative_log_summary_id is not null
      when 'unsupported_source' then
        evidence_processing_stage in ('source_classification', 'translation')
        and evidence_processing_reason_code in ('unknown_source_format', 'translator_unavailable')
        and evidence_retry_disposition <> 'not_required'
        and evidence_diagnostic_reference is null
      when 'invalid_or_incomplete_source' then
        evidence_processing_stage = 'translation'
        and evidence_processing_reason_code in (
          'no_usable_rows',
          'missing_required_core_channels',
          'invalid_source_observations',
          'insufficient_usable_evidence'
        )
        and evidence_retry_disposition <> 'not_required'
        and evidence_diagnostic_reference is null
      when 'processing_failed' then
        (
          (evidence_processing_reason_code = 'source_registration_failure' and evidence_processing_stage = 'source_registration')
          or (evidence_processing_reason_code = 'raw_source_storage_failure' and evidence_processing_stage = 'raw_source_storage')
          or (evidence_processing_reason_code = 'source_classification_failure' and evidence_processing_stage = 'source_classification')
          or (evidence_processing_reason_code = 'translation_processing_failure' and evidence_processing_stage = 'translation')
          or (evidence_processing_reason_code = 'evidence_derivation_failure' and evidence_processing_stage = 'evidence_derivation')
        )
        and evidence_retry_disposition <> 'not_required'
      when 'persistence_failed' then
        evidence_processing_stage = 'evidence_persistence'
        and evidence_processing_reason_code = 'authoritative_evidence_write_failure'
        and evidence_retry_disposition <> 'not_required'
      else false
    end
  );

create unique index log_summaries_id_log_id_uidx
  on public.log_summaries (id, log_id);

create index log_summaries_log_id_created_at_idx
  on public.log_summaries (log_id, created_at desc, id);

create index logs_authoritative_log_summary_id_idx
  on public.logs (authoritative_log_summary_id)
  where authoritative_log_summary_id is not null;

alter table public.logs
  add constraint logs_authoritative_log_summary_same_log_fkey
  foreign key (authoritative_log_summary_id, id)
  references public.log_summaries (id, log_id)
  on update no action
  on delete restrict;

create temporary table wp005_legacy_authority_candidates (
  log_id uuid primary key,
  summary_id uuid not null unique
) on commit drop;

insert into wp005_legacy_authority_candidates (log_id, summary_id)
select
  l.id,
  (array_agg(ls.id order by ls.id))[1]
from public.logs as l
join public.log_summaries as ls
  on ls.log_id = l.id
where l.authoritative_log_summary_id is null
group by l.id, l.user_id, l.vehicle_id
having count(*) = 1
   and count(*) filter (
     where ls.user_id = l.user_id
       and ls.vehicle_id = l.vehicle_id
       and jsonb_typeof(ls.summary -> 'engine_v2') = 'object'
   ) = 1;

do $wp005_backfill$
declare
  expected_count bigint;
  updated_count bigint;
begin
  select count(*) into expected_count
  from pg_temp.wp005_legacy_authority_candidates;

  update public.logs as l
  set authoritative_log_summary_id = c.summary_id
  from pg_temp.wp005_legacy_authority_candidates as c
  where l.id = c.log_id
    and l.authoritative_log_summary_id is null
    and l.evidence_lifecycle_state = 'legacy_unclassified';

  get diagnostics updated_count = row_count;

  if updated_count <> expected_count then
    raise exception 'WP-005.0.3A legacy authority backfill changed % rows; expected %',
      updated_count,
      expected_count;
  end if;

  if exists (
    select 1
    from pg_temp.wp005_legacy_authority_candidates as c
    join public.logs as l on l.id = c.log_id
    where l.authoritative_log_summary_id is distinct from c.summary_id
       or l.evidence_lifecycle_state <> 'legacy_unclassified'
       or l.evidence_source_availability <> 'unknown'
       or l.evidence_processing_contract_version is not null
       or l.evidence_processing_stage is not null
       or l.evidence_processing_outcome_kind is not null
       or l.evidence_logger_platform is not null
       or l.evidence_processing_reason_code is not null
       or l.evidence_retry_disposition is not null
       or l.evidence_diagnostic_reference is not null
       or l.evidence_processing_started_at is not null
       or l.evidence_processing_completed_at is not null
  ) then
    raise exception 'WP-005.0.3A legacy authority backfill violated legacy lifecycle integrity';
  end if;
end
$wp005_backfill$;

drop policy if exists "open insert" on public.log_summaries;

create policy log_summaries_owner_insert
on public.log_summaries
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.logs as parent_log
    where parent_log.id = public.log_summaries.log_id
      and parent_log.user_id = auth.uid()
      and parent_log.user_id = public.log_summaries.user_id
      and parent_log.vehicle_id = public.log_summaries.vehicle_id
  )
);

revoke insert, update on table public.logs from anon, authenticated;
grant insert (vehicle_id, user_id, log_name, file_name, file_url)
  on table public.logs to authenticated;
grant update (log_name, file_name, file_url)
  on table public.logs to authenticated;

revoke insert, update, delete on table public.log_summaries from anon;
revoke update, delete on table public.log_summaries from authenticated;

revoke truncate, references, trigger
  on table public.logs, public.log_summaries
  from anon, authenticated;

create or replace function public.establish_log_summary_authority_v1(
  p_log_id uuid,
  p_candidate_summary_id uuid,
  p_expected_user_id uuid,
  p_contract_version text,
  p_logger_platform text,
  p_source_availability text,
  p_processing_started_at timestamptz
)
returns table (
  log_id uuid,
  previous_authoritative_log_summary_id uuid,
  authoritative_log_summary_id uuid,
  outcome_kind text,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  target_log public.logs%rowtype;
  candidate_summary public.log_summaries%rowtype;
  previous_authority uuid;
  completion_time timestamptz := clock_timestamp();
begin
  if p_contract_version <> '1.0' then
    raise exception 'Unsupported Evidence processing contract version';
  end if;

  if p_processing_started_at is null or p_processing_started_at > completion_time then
    raise exception 'Evidence processing start time is invalid';
  end if;

  select * into target_log
  from public.logs
  where id = p_log_id
  for update;

  if not found then
    raise exception 'Evidence source log does not exist';
  end if;

  if target_log.user_id <> p_expected_user_id then
    raise exception 'Evidence source log ownership does not match';
  end if;

  select * into candidate_summary
  from public.log_summaries
  where id = p_candidate_summary_id;

  if not found
     or candidate_summary.log_id <> target_log.id
     or candidate_summary.user_id <> target_log.user_id
     or candidate_summary.vehicle_id <> target_log.vehicle_id
     or jsonb_typeof(candidate_summary.summary -> 'engine_v2') <> 'object' then
    raise exception 'Candidate Evidence summary is not valid for the source log';
  end if;

  previous_authority := target_log.authoritative_log_summary_id;

  update public.logs
  set authoritative_log_summary_id = p_candidate_summary_id,
      evidence_source_availability = p_source_availability,
      evidence_lifecycle_state = 'terminal',
      evidence_processing_contract_version = p_contract_version,
      evidence_processing_stage = 'evidence_persistence',
      evidence_processing_outcome_kind = 'evidence_established',
      evidence_logger_platform = p_logger_platform,
      evidence_processing_reason_code = null,
      evidence_retry_disposition = 'not_required',
      evidence_diagnostic_reference = null,
      evidence_processing_started_at = p_processing_started_at,
      evidence_processing_completed_at = completion_time
  where id = p_log_id;

  return query select
    p_log_id,
    previous_authority,
    p_candidate_summary_id,
    'evidence_established'::text,
    completion_time;
end
$function$;

create or replace function public.record_log_evidence_lifecycle_v1(
  p_log_id uuid,
  p_expected_user_id uuid,
  p_lifecycle_state text,
  p_contract_version text,
  p_processing_stage text,
  p_outcome_kind text,
  p_logger_platform text,
  p_source_availability text,
  p_reason_code text,
  p_retry_disposition text,
  p_diagnostic_reference text,
  p_processing_started_at timestamptz,
  p_raw_source_storage_path text
)
returns table (
  log_id uuid,
  lifecycle_state text,
  outcome_kind text,
  authoritative_log_summary_id uuid,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  target_log public.logs%rowtype;
  completion_time timestamptz;
begin
  if p_lifecycle_state not in ('processing', 'terminal') then
    raise exception 'Lifecycle mutation must be processing or terminal';
  end if;

  if p_lifecycle_state = 'terminal'
     and (p_outcome_kind is null or p_outcome_kind = 'evidence_established') then
    raise exception 'Failure lifecycle mutation cannot establish Evidence authority';
  end if;

  if p_lifecycle_state = 'processing' and p_outcome_kind is not null then
    raise exception 'Processing lifecycle cannot contain a terminal outcome';
  end if;

  if p_processing_started_at is null then
    raise exception 'Evidence processing start time is required';
  end if;

  select * into target_log
  from public.logs
  where id = p_log_id
  for update;

  if not found or target_log.user_id <> p_expected_user_id then
    raise exception 'Evidence source log ownership does not match';
  end if;

  completion_time := case
    when p_lifecycle_state = 'terminal' then clock_timestamp()
    else null
  end;

  if completion_time is not null and p_processing_started_at > completion_time then
    raise exception 'Evidence processing start time is invalid';
  end if;

  update public.logs
  set raw_source_storage_path = coalesce(
        p_raw_source_storage_path,
        raw_source_storage_path
      ),
      evidence_source_availability = p_source_availability,
      evidence_lifecycle_state = p_lifecycle_state,
      evidence_processing_contract_version = p_contract_version,
      evidence_processing_stage = p_processing_stage,
      evidence_processing_outcome_kind = p_outcome_kind,
      evidence_logger_platform = p_logger_platform,
      evidence_processing_reason_code = p_reason_code,
      evidence_retry_disposition = p_retry_disposition,
      evidence_diagnostic_reference = p_diagnostic_reference,
      evidence_processing_started_at = p_processing_started_at,
      evidence_processing_completed_at = completion_time
  where id = p_log_id;

  return query select
    p_log_id,
    p_lifecycle_state,
    p_outcome_kind,
    target_log.authoritative_log_summary_id,
    completion_time;
end
$function$;

revoke execute on function public.establish_log_summary_authority_v1(
  uuid, uuid, uuid, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.establish_log_summary_authority_v1(
  uuid, uuid, uuid, text, text, text, timestamptz
) to service_role;

revoke execute on function public.record_log_evidence_lifecycle_v1(
  uuid, uuid, text, text, text, text, text, text, text, text, text, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.record_log_evidence_lifecycle_v1(
  uuid, uuid, text, text, text, text, text, text, text, text, text, timestamptz, text
) to service_role;

comment on column public.logs.raw_source_storage_path is
  'Exact object path in the logs Storage bucket; not Evidence, availability proof, or a credential.';

comment on column public.logs.authoritative_log_summary_id is
  'Current authoritative Evidence summary for this log; recency alone never establishes authority.';

commit;
