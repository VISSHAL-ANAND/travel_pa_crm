-- Travel-PA schema — SAFE, idempotent, no destructive statements.
-- Running this file (in full or in part) will never delete existing data.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    region TEXT,
    destination_specific TEXT,
    destination TEXT,
    budget TEXT,
    travel_date TEXT,
    travel_date_end TEXT,
    notes TEXT,
    status TEXT DEFAULT 'new',
    custom_answers JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    message TEXT NOT NULL,
    overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    service_rating INTEGER NOT NULL CHECK (service_rating BETWEEN 1 AND 5),
    value_rating INTEGER NOT NULL CHECK (value_rating BETWEEN 1 AND 5),
    recommend_rating INTEGER NOT NULL CHECK (recommend_rating BETWEEN 1 AND 5),
    continue_booking TEXT NOT NULL CHECK (continue_booking IN ('yes', 'maybe', 'no')),
    agent_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS agent_form_config (
    agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
    custom_questions JSONB DEFAULT '[]',
    main_config JSONB DEFAULT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_agents_admin_id ON agents(admin_id);
CREATE INDEX IF NOT EXISTS idx_clients_agent_id ON clients(agent_id);
CREATE INDEX IF NOT EXISTS idx_feedback_client_id ON feedback(client_id);
CREATE INDEX IF NOT EXISTS idx_feedback_agent_id ON feedback(agent_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- ============================================================================
-- V2 FOUNDATION
-- White-label agent profiles, customer enrichment, and safer status semantics.
-- These statements are additive and safe to run against the existing database.
-- ============================================================================

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
ALTER TABLE agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_public_slug
    ON agents(public_slug)
    WHERE public_slug IS NOT NULL;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_method TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_strategy TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS report_path TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS questionnaire_version INTEGER NOT NULL DEFAULT 2;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS questionnaire_answers JSONB NOT NULL DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE agent_form_config ADD COLUMN IF NOT EXISTS core_questions JSONB DEFAULT '[]';
ALTER TABLE agent_form_config ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);

-- Keep status values controlled without destroying legacy rows.
-- Existing deployments should review/normalize any unexpected status before
-- validating this constraint in a future migration.


-- V2 CUSTOMER WORKSPACE
CREATE TABLE IF NOT EXISTS customer_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'lead_received','agent_opened','status_changed',
        'report_generated','feedback_submitted','ai_analysis'
    )),
    event_label TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customer_activity_client_created
    ON customer_activity(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_activity_agent_created
    ON customer_activity(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_activity_type
    ON customer_activity(event_type);
