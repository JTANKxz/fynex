create index if not exists messages_sticker_id_idx
  on public.messages (sticker_id)
  where sticker_id is not null;
