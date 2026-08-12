alter table public.profiles
  add column profile_song_start_seconds integer not null default 0,
  add column profile_song_duration_ms integer;

alter table public.profiles
  add constraint profiles_song_start_seconds_check
    check (profile_song_start_seconds between 0 and 86400),
  add constraint profiles_song_duration_ms_check
    check (profile_song_duration_ms is null or profile_song_duration_ms between 30000 and 86400000),
  add constraint profiles_song_clip_window_check
    check (
      profile_song_duration_ms is null
      or profile_song_start_seconds <= greatest(floor(profile_song_duration_ms / 1000.0)::integer - 30, 0)
    );
