-- Ensure one public response can be stored for each one-use feedback link.
create unique index if not exists feedback_responses_request_id_unique
  on public.feedback_responses (request_id);

-- Keep the token check, expiry check, response insert, and request status update
-- in one row-locked transaction so simultaneous submissions cannot both win.
create or replace function public.submit_feedback_response(
  p_token text,
  p_sentiment text,
  p_feedback_text text default null,
  p_rating_choice integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_request public.feedback_requests%rowtype;
  v_feedback text := nullif(btrim(p_feedback_text), '');
begin
  if p_token is null or btrim(p_token) = '' or length(p_token) > 128
     or p_sentiment is null or p_sentiment not in ('happy', 'unhappy')
     or (p_rating_choice is not null and p_rating_choice not between 1 and 5)
     or length(coalesce(p_feedback_text, '')) > 5000
     or (p_sentiment = 'unhappy' and v_feedback is null) then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_request
    from public.feedback_requests
   where token = p_token
   for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_request.status = 'responded' then
    return jsonb_build_object('status', 'already_responded');
  end if;

  if v_request.status = 'expired' or v_request.expires_at <= now() then
    update public.feedback_requests set status = 'expired' where id = v_request.id;
    return jsonb_build_object('status', 'expired');
  end if;

  insert into public.feedback_responses (
    request_id, org_id, location_id, sentiment, rating_choice, feedback_text
  ) values (
    v_request.id,
    v_request.org_id,
    v_request.location_id,
    p_sentiment,
    p_rating_choice,
    case when p_sentiment = 'unhappy' then v_feedback else null end
  );

  update public.feedback_requests set status = 'responded' where id = v_request.id;

  return jsonb_build_object(
    'status', 'ok',
    'sentiment', p_sentiment,
    'google_review_url', v_request.google_review_url
  );
end;
$$;

revoke all on function public.submit_feedback_response(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.submit_feedback_response(text, text, text, integer) to service_role;
