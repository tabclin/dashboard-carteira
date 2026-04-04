-- ── Telemedicina ─────────────────────────────────────────────────
-- Execute no Supabase SQL Editor

-- 1. Colunas na tabela de agendamentos
ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS telemedicina        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telemedicina_token  TEXT    UNIQUE,
  ADD COLUMN IF NOT EXISTS telemedicina_cpf_rg TEXT;

-- 2. Tabela de auditoria de consentimentos (inserida pelo paciente, sem auth)
CREATE TABLE IF NOT EXISTS telemedicina_consentimentos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID        REFERENCES agendamentos(id) ON DELETE SET NULL,
  paciente_nome  TEXT,
  cpf_rg         TEXT        NOT NULL,
  aceito_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. RLS em agendamentos: permitir leitura pública quando telemedicina=true
--    (o token UUID age como senha — sem ele não há como adivinhar a URL)
DROP POLICY IF EXISTS "telemedicina_token_publico" ON agendamentos;
CREATE POLICY "telemedicina_token_publico" ON agendamentos
  FOR SELECT USING (telemedicina = true AND telemedicina_token IS NOT NULL);

-- 3. RLS: qualquer pessoa pode inserir (paciente não autenticado),
--         apenas o dono do agendamento pode ler
ALTER TABLE telemedicina_consentimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_publico" ON telemedicina_consentimentos;
CREATE POLICY "insert_publico" ON telemedicina_consentimentos
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "leitura_dono" ON telemedicina_consentimentos;
CREATE POLICY "leitura_dono" ON telemedicina_consentimentos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agendamentos a
      WHERE a.id = telemedicina_consentimentos.agendamento_id
        AND a.user_id = current_team_id()
    )
  );
