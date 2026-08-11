alter table public.communities
  add column if not exists avatar_url text,
  add column if not exists avatar_file_id text,
  add column if not exists banner_url text,
  add column if not exists banner_file_id text;

alter table public.communities
  add constraint communities_avatar_url_https check (avatar_url is null or avatar_url ~ '^https://'),
  add constraint communities_banner_url_https check (banner_url is null or banner_url ~ '^https://'),
  add constraint communities_avatar_file_id_length check (avatar_file_id is null or char_length(avatar_file_id) between 8 and 200),
  add constraint communities_banner_file_id_length check (banner_file_id is null or char_length(banner_file_id) between 8 and 200);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'communities'
  ) then
    alter publication supabase_realtime add table public.communities;
  end if;
end
$$;
