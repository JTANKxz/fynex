-- FYNEX production foundation: authenticated profiles and global messages.
-- This intentionally replaces the anonymous prototype data model.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

drop table if exists public.messages;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  bio text not null default '',
  avatar_url text,
  accent_color text not null default '#8b5cf6',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username = lower(username)
    and username ~ '^[a-z0-9_]{3,24}$'
  ),
  constraint profiles_display_name_length check (
    display_name = btrim(display_name)
    and char_length(display_name) between 2 and 50
  ),
  constraint profiles_bio_length check (char_length(bio) <= 190),
  constraint profiles_avatar_url_https check (
    avatar_url is null or avatar_url ~ '^https://'
  ),
  constraint profiles_accent_color_format check (
    accent_color ~ '^#[0-9a-fA-F]{6}$'
  )
);

create unique index profiles_username_unique_idx
  on public.profiles (lower(username));

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'global',
  author_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint messages_channel_format check (channel ~ '^[a-z0-9_-]{1,32}$'),
  constraint messages_content_length check (
    content = btrim(content)
    and char_length(content) between 1 and 2000
  )
);

create index messages_channel_created_at_idx
  on public.messages (channel, created_at desc);
create index messages_author_id_idx
  on public.messages (author_id);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  requested_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  if requested_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Invalid username' using errcode = 'check_violation';
  end if;

  if char_length(requested_name) < 2 or char_length(requested_name) > 50 then
    raise exception 'Invalid display name' using errcode = 'check_violation';
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, requested_username, requested_name);

  return new;
end;
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.messages enable row level security;

create policy "Authenticated users can view profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Authenticated users can view messages"
  on public.messages for select
  to authenticated
  using (true);

create policy "Users can create their own messages"
  on public.messages for insert
  to authenticated
  with check ((select auth.uid()) = author_id);

create policy "Users can update their own messages"
  on public.messages for update
  to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "Users can delete their own messages"
  on public.messages for delete
  to authenticated
  using ((select auth.uid()) = author_id);

revoke all on public.profiles from anon;
revoke all on public.messages from anon;
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.messages to authenticated;

revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;

alter publication supabase_realtime add table public.messages;
