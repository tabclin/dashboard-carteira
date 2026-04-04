-- ═══════════════════════════════════════════════════════════════
-- ANAMNESE CONFIGURÁVEL — ClinKPI
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Template de anamnese por usuário (campos personalizados)
CREATE TABLE IF NOT EXISTS anamnese_template (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL DEFAULT current_team_id() REFERENCES auth.users(id) ON DELETE CASCADE,
  campos        JSONB       NOT NULL DEFAULT '[]',
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE anamnese_template ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON anamnese_template;
CREATE POLICY "tenant_isolation" ON anamnese_template
  FOR ALL USING (user_id = current_team_id()) WITH CHECK (user_id = current_team_id());

CREATE INDEX IF NOT EXISTS idx_anamnese_template_user ON anamnese_template(user_id);

-- 2. Adicionar coluna de dados dinâmicos ao prontuário
ALTER TABLE prontuarios ADD COLUMN IF NOT EXISTS dados_anamnese JSONB DEFAULT '{}';

-- 3. Adicionar coluna ultimo_atendimento em pacientes (caso não exista)
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS ultimo_atendimento DATE;
