-- Replace the single global room with isolated communities and channels.

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  owner_id uuid not null references public.profiles (id) on delete cascade,
  accent_color text not null default '#8b5cf6',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communities_name_length check (
    name = btrim(name) and char_length(name) between 2 and 50
  ),
  constraint communities_description_length check (char_length(description) <= 190),
  constraint communities_accent_color_format check (accent_color ~ '^#[0-9a-fA-F]{6}$')
);

create index communities_owner_id_idx on public.communities (owner_id);

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id),
  constraint community_members_role_check check (role in ('owner', 'member'))
);

create index community_members_user_id_idx on public.community_members (user_id);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  name text not null,
  type text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint channels_name_format check (name ~ '^[a-z0-9_-]{1,32}$'),
  constraint channels_type_check check (type in ('text', 'voice')),
  constraint channels_position_check check (position >= 0),
  constraint channels_name_per_community_unique unique (community_id, name)
);

create index channels_community_position_idx on public.channels (community_id, position, created_at);

drop table public.messages;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint messages_content_length check (
    content = btrim(content) and char_length(content) between 1 and 2000
  )
);

create index messages_channel_created_at_idx on public.messages (channel_id, created_at desc);
create index messages_author_id_idx on public.messages (author_id);

create trigger communities_set_updated_at
  before update on public.communities
  for each row execute function private.set_updated_at();

alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;

create policy "Members can view their communities"
  on public.communities for select to authenticated
  using (exists (
    select 1 from public.community_members membership
    where membership.community_id = communities.id
      and membership.user_id = (select auth.uid())
  ));

create policy "Users can create owned communities"
  on public.communities for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Owners can update communities"
  on public.communities for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners can delete communities"
  on public.communities for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "Users can view their memberships"
  on public.community_members for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Owners can create their membership"
  on public.community_members for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'owner'
    and exists (
      select 1 from public.communities community
      where community.id = community_members.community_id
        and community.owner_id = (select auth.uid())
    )
  );

create policy "Members can view channels"
  on public.channels for select to authenticated
  using (exists (
    select 1 from public.community_members membership
    where membership.community_id = channels.community_id
      and membership.user_id = (select auth.uid())
  ));

create policy "Owners can create channels"
  on public.channels for insert to authenticated
  with check (exists (
    select 1 from public.communities community
    where community.id = channels.community_id
      and community.owner_id = (select auth.uid())
  ));

create policy "Owners can update channels"
  on public.channels for update to authenticated
  using (exists (
    select 1 from public.communities community
    where community.id = channels.community_id
      and community.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.communities community
    where community.id = channels.community_id
      and community.owner_id = (select auth.uid())
  ));

create policy "Owners can delete channels"
  on public.channels for delete to authenticated
  using (exists (
    select 1 from public.communities community
    where community.id = channels.community_id
      and community.owner_id = (select auth.uid())
  ));

create policy "Members can view channel messages"
  on public.messages for select to authenticated
  using (exists (
    select 1
    from public.channels channel
    join public.community_members membership on membership.community_id = channel.community_id
    where channel.id = messages.channel_id
      and membership.user_id = (select auth.uid())
  ));

create policy "Members can create their messages"
  on public.messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1
      from public.channels channel
      join public.community_members membership on membership.community_id = channel.community_id
      where channel.id = messages.channel_id
        and channel.type = 'text'
        and membership.user_id = (select auth.uid())
    )
  );

create policy "Authors can update their messages"
  on public.messages for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "Authors can delete their messages"
  on public.messages for delete to authenticated
  using (author_id = (select auth.uid()));

revoke all on public.communities, public.community_members, public.channels, public.messages from anon;
grant select, insert, update, delete on public.communities to authenticated;
grant select, insert on public.community_members to authenticated;
grant select, insert, update, delete on public.channels to authenticated;
grant select, insert, update, delete on public.messages to authenticated;

-- Give every existing account a private starter community.
with created as (
  insert into public.communities (name, description, owner_id, accent_color)
  select 'Espa' || chr(231) || 'o de ' || display_name, 'Sua primeira comunidade no FYNEX.', id, accent_color
  from public.profiles
  returning id, owner_id
), members as (
  insert into public.community_members (community_id, user_id, role)
  select id, owner_id, 'owner' from created
  returning community_id
)
insert into public.channels (community_id, name, type, position)
select community_id, 'geral', 'text', 0 from members
union all
select community_id, 'conversa', 'voice', 1 from members;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  requested_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  profile_color text := '#8b5cf6';
  community_id uuid;
begin
  if requested_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Invalid username' using errcode = 'check_violation';
  end if;

  if char_length(requested_name) < 2 or char_length(requested_name) > 50 then
    raise exception 'Invalid display name' using errcode = 'check_violation';
  end if;

  insert into public.profiles (id, username, display_name, accent_color)
  values (new.id, requested_username, requested_name, profile_color);

  insert into public.communities (name, description, owner_id, accent_color)
  values ('Espa' || chr(231) || 'o de ' || requested_name, 'Sua primeira comunidade no FYNEX.', new.id, profile_color)
  returning id into community_id;

  insert into public.community_members (community_id, user_id, role)
  values (community_id, new.id, 'owner');

  insert into public.channels (community_id, name, type, position)
  values (community_id, 'geral', 'text', 0), (community_id, 'conversa', 'voice', 1);

  return new;
end;
$$;

alter publication supabase_realtime add table public.messages;
