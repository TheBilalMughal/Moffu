ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS contact_sales boolean NOT NULL DEFAULT false;
