-- A community owns one permanent invite URL. Administrators may manage the
-- community identity and its invite, but destructive ownership stays private
-- to the creator.

create unique index community_invite_links_community_unique_idx
  on public.community_invite_links (community_id);

drop policy if exists "Owners can update communities" on public.communities;
create policy "Owners and admins can update communities"
  on public.communities for update to authenticated
  using ((select private.has_community_permission(id, 'manage_community')))
  with check ((select private.has_community_permission(id, 'manage_community')));

drop policy if exists "Members can view community invite links" on public.community_invite_links;
drop policy if exists "Members can create community invite links" on public.community_invite_links;
drop policy if exists "Creators and owners can update community invite links" on public.community_invite_links;
drop policy if exists "Creators and owners can delete community invite links" on public.community_invite_links;

create policy "Admins can view permanent community invite"
  on public.community_invite_links for select to authenticated
  using ((select private.has_community_permission(community_id, 'manage_community')));

create policy "Admins can create permanent community invite"
  on public.community_invite_links for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.has_community_permission(community_id, 'manage_community'))
    and expires_at is null
    and max_uses is null
    and revoked_at is null
  );

create policy "Admins can keep permanent community invite active"
  on public.community_invite_links for update to authenticated
  using ((select private.has_community_permission(community_id, 'manage_community')))
  with check (
    (select private.has_community_permission(community_id, 'manage_community'))
    and expires_at is null
    and max_uses is null
    and revoked_at is null
  );

-- There is deliberately no delete policy: the URL is stable for the lifetime
-- of the community. The community owner can still delete the community itself.
