-- Email-open tracking uses the service-role Edge Function, not a public RPC.
revoke all on function public.increment_feedback_open(text) from public, anon, authenticated;
grant execute on function public.increment_feedback_open(text) to service_role;
