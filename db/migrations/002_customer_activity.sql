-- Travel-PA CRM V2 — customer workspace activity timeline
-- Additive migration. Safe to run once against an existing deployment.

CREATE TABLE IF NOT EXISTS customer_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
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

-- Keep event names predictable for reporting and UI.
ALTER TABLE customer_activity
    ADD CONSTRAINT customer_activity_event_type_check
    CHECK (event_type IN (
        'lead_received',
        'agent_opened',
        'status_changed',
        'report_generated',
        'feedback_submitted',
        'ai_analysis'
    ));
