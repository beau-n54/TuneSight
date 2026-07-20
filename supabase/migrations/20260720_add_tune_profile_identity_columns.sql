begin;

alter table public.tune_profiles
  add column if not exists software_version text null default null,
  add column if not exists calibration_id text null default null,
  add column if not exists checksum_family text null default null,
  add column if not exists checksum_verification_status text null default null,
  add column if not exists calibration_verification_status text null default null,
  add column if not exists exact_binary_match_status text null default null,
  add column if not exists dme_variant text null default null,
  add column if not exists stock_bin_suggested text null default null,
  add column if not exists map_switch_bin_suggested text null default null;

alter table public.tune_profiles
  add constraint tune_profiles_checksum_verification_status_check
  check (
    checksum_verification_status is null
    or checksum_verification_status in (
      'pending',
      'verified',
      'valid',
      'invalid',
      'matched',
      'not_matched',
      'not_available'
    )
  );

alter table public.tune_profiles
  add constraint tune_profiles_calibration_verification_status_check
  check (
    calibration_verification_status is null
    or calibration_verification_status in (
      'pending',
      'verified',
      'valid',
      'invalid',
      'matched',
      'not_matched',
      'not_available'
    )
  );

alter table public.tune_profiles
  add constraint tune_profiles_exact_binary_match_status_check
  check (
    exact_binary_match_status is null
    or exact_binary_match_status in (
      'pending',
      'verified',
      'valid',
      'invalid',
      'matched',
      'not_matched',
      'not_available'
    )
  );

commit;
