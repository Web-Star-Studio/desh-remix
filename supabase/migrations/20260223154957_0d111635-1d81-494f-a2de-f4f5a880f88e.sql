-- Enable realtime for gmail_messages_cache so UI updates instantly across tabs
ALTER PUBLICATION supabase_realtime ADD TABLE public.gmail_messages_cache;