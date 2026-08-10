alter table public.profiles
  add column if not exists avatar_file_id text,
  add column if not exists banner_url text,
  add column if not exists banner_file_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_banner_url_https'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_banner_url_https
      check (banner_url is null or banner_url ~ '^https://');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_avatar_file_id_length'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_avatar_file_id_length
      check (avatar_file_id is null or char_length(avatar_file_id) between 8 and 200);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_banner_file_id_length'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_banner_file_id_length
      check (banner_file_id is null or char_length(banner_file_id) between 8 and 200);
  end if;
end
$$;
