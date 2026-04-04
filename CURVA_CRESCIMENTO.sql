-- ═══════════════════════════════════════════════════════════════
-- CURVA DE CRESCIMENTO — ClinKPI
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crescimento_medicoes (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID        NOT NULL DEFAULT current_team_id()
                                        REFERENCES auth.users(id) ON DELETE CASCADE,
  prontuario_id             UUID        NOT NULL REFERENCES prontuarios(id) ON DELETE CASCADE,
  data                      DATE        NOT NULL,
  peso_kg                   NUMERIC(5,3),
  altura_cm                 NUMERIC(5,1),
  perimetro_cefalico_cm     NUMERIC(4,1),
  idade_gestacional_semanas INTEGER,
  criado_em                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crescimento_medicoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON crescimento_medicoes;
CREATE POLICY "tenant_isolation" ON crescimento_medicoes
  FOR ALL USING (user_id = current_team_id()) WITH CHECK (user_id = current_team_id());

CREATE INDEX IF NOT EXISTS idx_crescimento_prontuario ON crescimento_medicoes(prontuario_id);
CREATE INDEX IF NOT EXISTS idx_crescimento_data       ON crescimento_medicoes(data DESC);
