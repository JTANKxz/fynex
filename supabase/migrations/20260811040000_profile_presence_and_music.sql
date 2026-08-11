alter table public.profiles
  add column if not exists presence_status text not null default 'online',
  add column if not exists profile_song_id text,
  add column if not exists profile_song_name text,
  add column if not exists profile_song_artist text,
  add column if not exists profile_song_cover_url text,
  add column if not exists profile_song_preview_url text,
  add column if not exists profile_song_spotify_url text;

alter table public.profiles drop constraint if exists profiles_presence_status_check;
alter table public.profiles add constraint profiles_presence_status_check
  check (presence_status in ('online', 'idle', 'dnd', 'invisible'));

alter table public.profiles drop constraint if exists profiles_song_metadata_length;
alter table public.profiles add constraint profiles_song_metadata_length check (
  length(profile_song_id) <= 64 and length(profile_song_name) <= 160 and length(profile_song_artist) <= 160
);
