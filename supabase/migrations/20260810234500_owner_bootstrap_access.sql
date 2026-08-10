-- Let an owner read the community immediately after INSERT so the first
-- membership and default channels can be created without a circular RLS check.

drop policy "Members can view their communities" on public.communities;

create policy "Members and owners can view their communities"
  on public.communities for select to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.community_members membership
      where membership.community_id = communities.id
        and membership.user_id = (select auth.uid())
    )
  );
