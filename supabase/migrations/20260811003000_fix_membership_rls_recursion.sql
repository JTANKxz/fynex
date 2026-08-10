-- Avoid circular RLS evaluation between communities and community_members.
-- These helpers return booleans only and always bind checks to auth.uid().

create or replace function private.is_community_member(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.community_members membership
      where membership.community_id = target_community_id
        and membership.user_id = (select auth.uid())
    );
$$;

create or replace function private.is_community_owner(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.communities community
      where community.id = target_community_id
        and community.owner_id = (select auth.uid())
    );
$$;

create or replace function private.can_access_channel(target_channel_id uuid, required_type text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.channels channel
      join public.community_members membership
        on membership.community_id = channel.community_id
      where channel.id = target_channel_id
        and membership.user_id = (select auth.uid())
        and (required_type is null or channel.type = required_type)
    );
$$;

revoke all on function private.is_community_member(uuid) from public, anon;
revoke all on function private.is_community_owner(uuid) from public, anon;
revoke all on function private.can_access_channel(uuid, text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_community_member(uuid) to authenticated;
grant execute on function private.is_community_owner(uuid) to authenticated;
grant execute on function private.can_access_channel(uuid, text) to authenticated;

drop policy if exists "Members and owners can view their communities" on public.communities;
drop policy if exists "Users can view their memberships" on public.community_members;
drop policy if exists "Owners can create their membership" on public.community_members;
drop policy if exists "Members can view channels" on public.channels;
drop policy if exists "Owners can create channels" on public.channels;
drop policy if exists "Owners can update channels" on public.channels;
drop policy if exists "Owners can delete channels" on public.channels;
drop policy if exists "Members can view channel messages" on public.messages;
drop policy if exists "Members can create their messages" on public.messages;
drop policy if exists "Authors can update their messages" on public.messages;

create policy "Members and owners can view their communities"
  on public.communities for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (select private.is_community_member(id))
  );

create policy "Members can view community memberships"
  on public.community_members for select to authenticated
  using ((select private.is_community_member(community_id)));

create policy "Owners can add community members"
  on public.community_members for insert to authenticated
  with check (
    (select private.is_community_owner(community_id))
    and (
      role = 'member'
      or (role = 'owner' and user_id = (select auth.uid()))
    )
  );

create policy "Members can view channels"
  on public.channels for select to authenticated
  using ((select private.is_community_member(community_id)));

create policy "Owners can create channels"
  on public.channels for insert to authenticated
  with check ((select private.is_community_owner(community_id)));

create policy "Owners can update channels"
  on public.channels for update to authenticated
  using ((select private.is_community_owner(community_id)))
  with check ((select private.is_community_owner(community_id)));

create policy "Owners can delete channels"
  on public.channels for delete to authenticated
  using ((select private.is_community_owner(community_id)));

create policy "Members can view channel messages"
  on public.messages for select to authenticated
  using ((select private.can_access_channel(channel_id)));

create policy "Members can create their messages"
  on public.messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select private.can_access_channel(channel_id, 'text'))
  );

create policy "Authors can update their messages"
  on public.messages for update to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and (select private.can_access_channel(channel_id, 'text'))
  );
