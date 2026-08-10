drop policy if exists "Owners invited users and approved users can join" on public.community_members;

create policy "Owners invited users and approved users can join"
  on public.community_members for insert to authenticated
  with check (
    (select private.is_community_owner(community_id))
    or (
      user_id = (select auth.uid())
      and role = 'member'
      and (
        exists (
          select 1 from public.communities community
          where community.id = community_members.community_id
            and community.join_policy = 'open'
        )
        or exists (
          select 1 from public.community_invitations invitation
          where invitation.community_id = community_members.community_id
            and invitation.invitee_id = (select auth.uid())
            and invitation.status = 'accepted'
        )
        or exists (
          select 1 from public.community_join_requests request
          where request.community_id = community_members.community_id
            and request.user_id = (select auth.uid())
            and request.status = 'approved'
        )
      )
    )
    or (
      role = 'member'
      and (select private.can_review_join_requests(community_id))
      and exists (
        select 1 from public.community_join_requests request
        where request.community_id = community_members.community_id
          and request.user_id = community_members.user_id
          and request.status = 'approved'
      )
    )
  );
