
-- Add rich contact fields to contacts table
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS contact_type text NOT NULL DEFAULT 'person',
  ADD COLUMN IF NOT EXISTS phones jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS website text DEFAULT '',
  ADD COLUMN IF NOT EXISTS birthday date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS company_logo_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS company_description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_industry text DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_size text DEFAULT '',
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Migrate existing single phone/email into the new arrays for contacts that have them
UPDATE public.contacts
SET phones = jsonb_build_array(jsonb_build_object('number', phone, 'label', 'principal', 'is_primary', true))
WHERE phone IS NOT NULL AND phone != '' AND phones = '[]'::jsonb;

UPDATE public.contacts
SET emails = jsonb_build_array(jsonb_build_object('email', email, 'label', 'principal', 'is_primary', true))
WHERE email IS NOT NULL AND email != '' AND emails = '[]'::jsonb;

-- Add index for contact_type filtering
CREATE INDEX IF NOT EXISTS idx_contacts_contact_type ON public.contacts(contact_type);
