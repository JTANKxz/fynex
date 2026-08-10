create index if not exists community_join_requests_reviewed_by_idx
  on public.community_join_requests(reviewed_by)
  where reviewed_by is not null;
