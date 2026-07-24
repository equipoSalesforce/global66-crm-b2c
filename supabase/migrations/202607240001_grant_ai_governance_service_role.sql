-- AI governance writes are performed by protected server-side routes.
-- The service role bypasses RLS, but still needs explicit table privileges.
grant select on table public.ai_features to service_role;
grant select, insert, update on table public.ai_user_feature_limits to service_role;
grant select, insert on table public.ai_limit_change_events to service_role;

notify pgrst, 'reload schema';
