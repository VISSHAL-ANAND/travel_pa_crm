-- Travel-PA CRM V2 foundation migration
-- Run this after the existing schema. Additive only; no data is deleted.

ALTER TABLE agents ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS brand_tagline TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS brand_primary_color TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS public_slug TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_public_slug
ON agents(public_slug) WHERE public_slug IS NOT NULL;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_method TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_strategy TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS report_path TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE agent_form_config ADD COLUMN IF NOT EXISTS core_questions JSONB DEFAULT '[]';
ALTER TABLE agent_form_config ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);
