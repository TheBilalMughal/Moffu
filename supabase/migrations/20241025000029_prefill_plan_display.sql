-- Pre-fill description, features, badge_text for existing plans
UPDATE public.plans SET
  description = 'Try Moffu with no commitment.',
  features    = '["1 Google location", "7 AI reply drafts/week", "14 AI drafts/week", "1 team member", "Help center support"]'::jsonb,
  is_featured = false
WHERE slug = 'free';

UPDATE public.plans SET
  description = 'Great for single location businesses.',
  features    = '["1 location included", "100 replies/month", "200 AI drafts/month", "2 team members", "Brand Brain", "Email support"]'::jsonb,
  is_featured = false
WHERE slug = 'starter';

UPDATE public.plans SET
  description = 'For growing businesses with multiple locations.',
  features    = '["3 locations included", "300 replies/month", "600 AI drafts/month", "5 team members", "Brand Brain", "Priority support"]'::jsonb,
  is_featured = true,
  badge_text  = 'Most Popular'
WHERE slug = 'growth';

UPDATE public.plans SET
  description = 'For larger organizations and agencies.',
  features    = '["10 locations included", "1000 replies/month", "2000 AI drafts/month", "10 team members", "Unlimited Brand Brain", "Priority support"]'::jsonb,
  is_featured = false
WHERE slug = 'scale';
