-- Ensure plan_prices uses billing_interval (not the reserved word 'interval')
-- Rename only if the old column still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'plan_prices' AND column_name = 'interval'
  ) THEN
    ALTER TABLE public.plan_prices RENAME COLUMN interval TO billing_interval;
    ALTER TABLE public.plan_prices DROP CONSTRAINT IF EXISTS plan_prices_plan_id_currency_interval_key;
    ALTER TABLE public.plan_prices ADD CONSTRAINT plan_prices_plan_id_currency_billing_interval_key
      UNIQUE (plan_id, currency, billing_interval);
  END IF;
END $$;
