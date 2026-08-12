create index community_invite_links_created_by_idx
  on public.community_invite_links (created_by, created_at desc);
