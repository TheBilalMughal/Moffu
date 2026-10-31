-- Email tracking columns for feedback_requests
alter table public.feedback_requests
  add column if not exists sent_at        timestamptz,
  add column if not exists open_count     integer not null default 0,
  add column if not exists last_opened_at timestamptz,
  add column if not exists clicked_at     timestamptz;
