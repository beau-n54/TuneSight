insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'subscriber-calibration-private',
  'subscriber-calibration-private',
  false,
  33554432,
  array['application/octet-stream', 'application/x-binary']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
