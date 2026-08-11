create or replace function private.can_manage_community_member(
  target_community_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_community_permission(target_community_id, 'manage_members')
    and target_user_id <> (select auth.uid())
    and not exists (
      select 1 from public.communities community
      where community.id = target_community_id
        and community.owner_id = target_user_id
    )
    and private.actor_role_position(target_community_id)
      > private.member_role_position(target_community_id, target_user_id);
$$;

drop policy if exists "Member managers can remove lower members" on public.community_members;
create policy "Member managers can remove lower members"
  on public.community_members for delete to authenticated
  using ((select private.can_manage_community_member(community_id, user_id)));

revoke all on function private.can_manage_community_member(uuid, uuid) from public, anon;
grant execute on function private.can_manage_community_member(uuid, uuid) to authenticated;
