-- ═══════════════════════════════════════════════════════════════
-- MÚLTIPLOS MODELOS DE ANAMNESE — ClinKPI
-- Execute no Supabase SQL Editor APÓS ANAMNESE_CONFIG.sql
-- ═══════════════════════════════════════════════════════════════

-- 1. Remover constraint UNIQUE(user_id) para permitir múltiplos modelos
ALTER TABLE anamnese_template
  DROP CONSTRAINT IF EXISTS anamnese_template_user_id_key;

-- 2. Adicionar colunas nome e is_padrao
ALTER TABLE anamnese_template
  ADD COLUMN IF NOT EXISTS nome TEXT NOT NULL DEFAULT 'Modelo Padrão';

ALTER TABLE anamnese_template
  ADD COLUMN IF NOT EXISTS is_padrao BOOLEAN NOT NULL DEFAULT false;

-- 3. Marcar registros existentes como padrão
UPDATE anamnese_template SET is_padrao = true WHERE is_padrao = false;

-- 4. Adicionar template_id e template_snapshot em prontuarios
ALTER TABLE prontuarios
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES anamnese_template(id) ON DELETE SET NULL;

ALTER TABLE prontuarios
  ADD COLUMN IF NOT EXISTS template_snapshot JSONB;

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_anamnese_template_user_padrao
  ON anamnese_template(user_id, is_padrao);
