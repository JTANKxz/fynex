create index if not exists community_member_tags_assigned_by_idx
  on public.community_member_tags (assigned_by);

create index if not exists community_member_tags_tag_community_idx
  on public.community_member_tags (tag_id, community_id);

create index if not exists community_stickers_created_by_idx
  on public.community_stickers (created_by);

create index if not exists community_tags_created_by_idx
  on public.community_tags (created_by);
