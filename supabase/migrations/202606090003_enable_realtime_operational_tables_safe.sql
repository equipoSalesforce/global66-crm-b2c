do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.cases;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.whatsapp_media_attachments;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.message_attachments;
  exception when duplicate_object then null;
  end;
end $$;
