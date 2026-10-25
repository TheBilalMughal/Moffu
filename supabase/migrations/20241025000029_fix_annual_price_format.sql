-- Fix annual plan_prices that were incorrectly saved as yearly-total instead of per-month.
-- The correct format is per-month equivalent (e.g. $19/mo at 20% off → 1520 cents/mo).
-- If annual amount_cents > monthly amount_cents for the same plan, it was saved as yearly total → divide by 12.
UPDATE plan_prices annual_pp
SET amount_cents = ROUND(annual_pp.amount_cents::decimal / 12)
FROM plan_prices monthly_pp
WHERE annual_pp.billing_interval = 'annual'
  AND monthly_pp.billing_interval = 'monthly'
  AND annual_pp.plan_id = monthly_pp.plan_id
  AND annual_pp.currency = monthly_pp.currency
  AND annual_pp.amount_cents > monthly_pp.amount_cents;
