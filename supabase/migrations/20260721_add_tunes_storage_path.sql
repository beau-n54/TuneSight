begin;

alter table public.tunes
  add column if not exists storage_path text null default null;

comment on column public.tunes.storage_path is
  'Exact object path within the Supabase tunes Storage bucket.';

commit;
