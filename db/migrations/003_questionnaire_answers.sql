-- V2 questionnaire answer persistence. Safe and additive.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS questionnaire_version INTEGER NOT NULL DEFAULT 2;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS questionnaire_answers JSONB NOT NULL DEFAULT '{}';
