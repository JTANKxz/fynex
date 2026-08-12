-- A member displays at most one community tag at a time.
create unique index community_member_tags_one_visible_tag_idx
  on public.community_member_tags (community_id, user_id);

create policy "Members can choose their own community tag"
  on public.community_member_tags for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and assigned_by = (select auth.uid())
    and (select private.is_community_member(community_id))
  );

create policy "Members can replace their own community tag"
  on public.community_member_tags for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and assigned_by = (select auth.uid())
    and (select private.is_community_member(community_id))
  );

create policy "Members can remove their own community tag"
  on public.community_member_tags for delete to authenticated
  using (user_id = (select auth.uid()));

grant update on public.community_member_tags to authenticated;
