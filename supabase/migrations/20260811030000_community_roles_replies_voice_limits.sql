-- Community moderation foundation: hierarchical roles, safe permissions,
-- message replies and enforceable voice-channel configuration.

create table public.community_roles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  color text not null default '#8b5cf6',
  position smallint not null default 1,
  is_admin boolean not null default false,
  manage_channels boolean not null default false,
  manage_roles boolean not null default false,
  manage_messages boolean not null default false,
  manage_members boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_roles_name_check check (char_length(btrim(name)) between 1 and 32),
  constraint community_roles_color_check check (color ~ '^#[0-9a-fA-F]{6}$'),
  constraint community_roles_position_check check (position between 1 and 32000),
  constraint community_roles_id_community_unique unique (id, community_id)
);

create unique index community_roles_name_unique_idx
  on public.community_roles (community_id, lower(btrim(name)));
create index community_roles_community_position_idx
  on public.community_roles (community_id, position desc);

create table public.community_member_roles (
  community_id uuid not null,
  user_id uuid not null,
  role_id uuid not null,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (community_id, user_id, role_id),
  constraint community_member_roles_membership_fkey
    foreign key (community_id, user_id)
    references public.community_members(community_id, user_id) on delete cascade,
  constraint community_member_roles_role_fkey
    foreign key (role_id, community_id)
    references public.community_roles(id, community_id) on delete cascade
);

create index community_member_roles_user_idx
  on public.community_member_roles (user_id, community_id);
create index community_member_roles_role_idx
  on public.community_member_roles (role_id);

alter table public.channels
  add column created_by uuid references public.profiles(id) on delete set null,
  add column user_limit smallint;

update public.channels channel
set created_by = community.owner_id,
    user_limit = case when channel.type = 'voice' then 10 else null end
from public.communities community
where community.id = channel.community_id;

alter table public.channels
  add constraint channels_user_limit_check check (
    (type = 'text' and user_limit is null)
    or (type = 'voice' and user_limit between 1 and 10)
  );

create or replace function private.normalize_channel_configuration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type = 'voice' then
    new.user_limit := coalesce(new.user_limit, 10);
  else
    new.user_limit := null;
  end if;
  return new;
end;
$$;

create trigger normalize_channel_configuration_before_write
before insert or update of type, user_limit on public.channels
for each row execute function private.normalize_channel_configuration();

alter table public.messages
  add column reply_to_id uuid references public.messages(id) on delete set null;

create index messages_reply_to_id_idx on public.messages (reply_to_id)
  where reply_to_id is not null;

create or replace function private.has_community_permission(
  target_community_id uuid,
  requested_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.communities community
      where community.id = target_community_id
        and community.owner_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.community_member_roles assignment
      join public.community_roles role on role.id = assignment.role_id
        and role.community_id = assignment.community_id
      where assignment.community_id = target_community_id
        and assignment.user_id = (select auth.uid())
        and (
          role.is_admin
          or case requested_permission
            when 'manage_channels' then role.manage_channels
            when 'manage_roles' then role.manage_roles
            when 'manage_messages' then role.manage_messages
            when 'manage_members' then role.manage_members
            else false
          end
        )
    )
  );
$$;

create or replace function private.actor_role_position(target_community_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.communities community
      where community.id = target_community_id
        and community.owner_id = (select auth.uid())
    ) then 32767
    else coalesce((
      select max(role.position)::integer
      from public.community_member_roles assignment
      join public.community_roles role on role.id = assignment.role_id
        and role.community_id = assignment.community_id
      where assignment.community_id = target_community_id
        and assignment.user_id = (select auth.uid())
    ), 0)
  end;
$$;

create or replace function private.member_role_position(
  target_community_id uuid,
  target_user_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.communities community
      where community.id = target_community_id
        and community.owner_id = target_user_id
    ) then 32767
    else coalesce((
      select max(role.position)::integer
      from public.community_member_roles assignment
      join public.community_roles role on role.id = assignment.role_id
        and role.community_id = assignment.community_id
      where assignment.community_id = target_community_id
        and assignment.user_id = target_user_id
    ), 0)
  end;
$$;

create or replace function private.can_assign_community_role(
  target_community_id uuid,
  target_user_id uuid,
  target_role_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_community_permission(target_community_id, 'manage_roles')
    and not exists (
      select 1 from public.communities community
      where community.id = target_community_id
        and community.owner_id = target_user_id
    )
    and private.actor_role_position(target_community_id)
      > private.member_role_position(target_community_id, target_user_id)
    and exists (
      select 1 from public.community_roles role
      where role.id = target_role_id
        and role.community_id = target_community_id
        and role.position < private.actor_role_position(target_community_id)
    );
$$;

create or replace function private.can_manage_existing_role(target_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.community_roles role
    where role.id = target_role_id
      and private.has_community_permission(role.community_id, 'manage_roles')
      and role.position < private.actor_role_position(role.community_id)
  );
$$;

create or replace function private.can_delete_message(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.channels channel
    where channel.id = target_channel_id
      and private.has_community_permission(channel.community_id, 'manage_messages')
  );
$$;

create or replace function private.validate_message_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from public.messages parent
    where parent.id = new.reply_to_id
      and parent.channel_id = new.channel_id
  ) then
    raise exception 'Reply must reference a message in the same channel'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger validate_message_reply_before_write
before insert or update of reply_to_id, channel_id on public.messages
for each row execute function private.validate_message_reply();

create trigger community_roles_set_updated_at
before update on public.community_roles
for each row execute function private.set_updated_at();

alter table public.community_roles enable row level security;
alter table public.community_member_roles enable row level security;

create policy "Members can view community roles"
  on public.community_roles for select to authenticated
  using ((select private.is_community_member(community_id)));

create policy "Role managers can create lower roles"
  on public.community_roles for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.has_community_permission(community_id, 'manage_roles'))
    and position < (select private.actor_role_position(community_id))
  );

create policy "Role managers can update lower roles"
  on public.community_roles for update to authenticated
  using ((select private.can_manage_existing_role(id)))
  with check (
    (select private.has_community_permission(community_id, 'manage_roles'))
    and position < (select private.actor_role_position(community_id))
  );

create policy "Role managers can delete lower roles"
  on public.community_roles for delete to authenticated
  using ((select private.can_manage_existing_role(id)));

create policy "Members can view assigned roles"
  on public.community_member_roles for select to authenticated
  using ((select private.is_community_member(community_id)));

create policy "Role managers can assign lower roles"
  on public.community_member_roles for insert to authenticated
  with check (
    assigned_by = (select auth.uid())
    and (select private.can_assign_community_role(community_id, user_id, role_id))
  );

create policy "Role managers can remove lower roles"
  on public.community_member_roles for delete to authenticated
  using ((select private.can_assign_community_role(community_id, user_id, role_id)));

drop policy if exists "Owners can create channels" on public.channels;
drop policy if exists "Owners can update channels" on public.channels;
drop policy if exists "Owners can delete channels" on public.channels;

create policy "Channel managers can create channels"
  on public.channels for insert to authenticated
  with check (
    (select private.has_community_permission(community_id, 'manage_channels'))
    and created_by = (select auth.uid())
  );

create policy "Channel managers can update channels"
  on public.channels for update to authenticated
  using ((select private.has_community_permission(community_id, 'manage_channels')))
  with check ((select private.has_community_permission(community_id, 'manage_channels')));

create policy "Channel managers can delete channels"
  on public.channels for delete to authenticated
  using ((select private.has_community_permission(community_id, 'manage_channels')));

drop policy if exists "Authors can delete their messages" on public.messages;
create policy "Authors and moderators can delete messages"
  on public.messages for delete to authenticated
  using (
    author_id = (select auth.uid())
    or (select private.can_delete_message(channel_id))
  );

revoke all on public.community_roles, public.community_member_roles from anon;
revoke all on public.community_roles, public.community_member_roles from authenticated;
grant select, insert, update, delete on public.community_roles to authenticated;
grant select, insert, delete on public.community_member_roles to authenticated;

revoke all on function private.has_community_permission(uuid, text) from public, anon;
revoke all on function private.actor_role_position(uuid) from public, anon;
revoke all on function private.member_role_position(uuid, uuid) from public, anon;
revoke all on function private.can_assign_community_role(uuid, uuid, uuid) from public, anon;
revoke all on function private.can_manage_existing_role(uuid) from public, anon;
revoke all on function private.can_delete_message(uuid) from public, anon;
grant execute on function private.has_community_permission(uuid, text) to authenticated;
grant execute on function private.actor_role_position(uuid) to authenticated;
grant execute on function private.member_role_position(uuid, uuid) to authenticated;
grant execute on function private.can_assign_community_role(uuid, uuid, uuid) to authenticated;
grant execute on function private.can_manage_existing_role(uuid) to authenticated;
grant execute on function private.can_delete_message(uuid) to authenticated;

alter table public.channels replica identity full;
alter table public.messages replica identity full;
