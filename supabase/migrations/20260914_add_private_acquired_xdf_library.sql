insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('acquired-xdf-private', 'acquired-xdf-private', false, 4194304, array['application/xml', 'text/xml', 'application/octet-stream']::text[])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.acquired_xdf_source_artifacts (
  id uuid primary key default gen_random_uuid(), source_digest text not null unique check (source_digest ~ '^[0-9a-f]{64}$'), byte_length integer not null check (byte_length between 1 and 4194304),
  parser_version text not null, storage_object_id text not null unique check (storage_object_id ~ '^[A-Za-z0-9_-]{24,64}$'), provenance_class text not null check (provenance_class = 'subscriber_contribution'),
  source_artifact_id text, definition_set_id text, definition_set_revision text, definition_count integer not null default 0 check (definition_count >= 0), parser_outcome text not null check (parser_outcome in ('structurally_interpreted','invalid','unsupported')),
  lifecycle text not null check (lifecycle in ('CONTRIBUTED_UNTRUSTED','STRUCTURALLY_PARSED','VALIDATED_CANDIDATE','SOURCE_AUTHORITY_REVIEW','APPLICABILITY_REVIEW','QUALIFIED_ADMITTED','ACTIVE','DUPLICATE_CONTENT','INVALID','UNSUPPORTED','DEFINITION_CONFLICT','QUARANTINED','REJECTED','SUPERSEDED')),
  safe_finding_codes text[] not null default '{}', validation jsonb not null default '{}'::jsonb, source_authority_state text not null default 'unresolved', applicability_state text not null default 'unpublished', admission_state text not null default 'not_admitted', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.acquired_xdf_candidate_relationships (
  id uuid primary key default gen_random_uuid(), source_artifact_id uuid not null references public.acquired_xdf_source_artifacts(id), candidate_identity jsonb not null, observed_evidence jsonb not null default '{}'::jsonb, validation_state jsonb not null default '{}'::jsonb,
  source_authority_id text, source_authority_revision text, applicability_id text, applicability_revision text, publication_id text, publication_revision text,
  lifecycle text not null default 'VALIDATED_CANDIDATE', supersedes_id uuid references public.acquired_xdf_candidate_relationships(id), created_at timestamptz not null default now(), unique(source_artifact_id, candidate_identity)
);
create table if not exists public.acquired_xdf_contribution_receipts (
  id uuid primary key default gen_random_uuid(), source_artifact_id uuid not null references public.acquired_xdf_source_artifacts(id), owner_id uuid not null references auth.users(id) on delete restrict, contribution_state text not null check (contribution_state in ('accepted','duplicate_content')), contributed_at timestamptz not null default now()
);
alter table public.acquired_xdf_source_artifacts enable row level security;
alter table public.acquired_xdf_candidate_relationships enable row level security;
alter table public.acquired_xdf_contribution_receipts enable row level security;
drop policy if exists acquired_xdf_receipts_owner_select on public.acquired_xdf_contribution_receipts;
create policy acquired_xdf_receipts_owner_select on public.acquired_xdf_contribution_receipts for select to authenticated using (owner_id = auth.uid());
revoke all on public.acquired_xdf_source_artifacts, public.acquired_xdf_candidate_relationships, public.acquired_xdf_contribution_receipts from anon, authenticated;
grant select on public.acquired_xdf_contribution_receipts to authenticated;
grant all on public.acquired_xdf_source_artifacts, public.acquired_xdf_candidate_relationships, public.acquired_xdf_contribution_receipts to service_role;
