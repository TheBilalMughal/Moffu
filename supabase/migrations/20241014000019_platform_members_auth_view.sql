-- RPC for admin app: returns platform member emails + last login from auth.users
-- SECURITY DEFINER allows reading auth schema which is otherwise restricted
create or replace function public.get_platform_members_auth()
returns table (
  user_id  uuid,
  email    text,
  last_sign_in_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    au.id            as user_id,
    au.email         as email,
    au.last_sign_in_at
  from auth.users au
  where au.id in (select pm.user_id from public.platform_members pm);
$$;

-- Only platform admins/super_admins should be able to call this
revoke execute on function public.get_platform_members_auth() from public, anon;
grant  execute on function public.get_platform_members_auth() to authenticated;
