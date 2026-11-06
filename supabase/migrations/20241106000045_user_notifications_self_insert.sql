-- Allow portal users to insert their own notifications (e.g. usage-limit alerts from auto-operations)
create policy "users_insert_own_notifications"
  on public.user_notifications for insert to authenticated
  with check (user_id = auth.uid());
