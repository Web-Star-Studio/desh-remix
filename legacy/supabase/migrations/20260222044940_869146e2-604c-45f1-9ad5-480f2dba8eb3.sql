
-- Step 1: Add 'credits' to subscription_plan enum only
ALTER TYPE subscription_plan ADD VALUE IF NOT EXISTS 'credits';

-- Add trial_eligible and unit_price to credit_packages
ALTER TABLE public.credit_packages
  ADD COLUMN IF NOT EXISTS trial_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unit_price numeric GENERATED ALWAYS AS (CASE WHEN credits > 0 THEN ROUND(price_brl / credits, 4) ELSE 0 END) STORED;
