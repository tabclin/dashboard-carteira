-- ═══════════════════════════════════════════════════════════════
-- AGENDA + PRONTUÁRIO ELETRÔNICO — ClinKPI
-- Execute este script inteiro no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. PROFISSIONAIS (preparar para multi-profissional)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profissionais (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL DEFAULT current_team_id() REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          TEXT        NOT NULL,
  especialidade TEXT,
  cor           TEXT        NOT NULL DEFAULT '#6366f1',  -- cor no calendário
  ativo         BOOLEAN     NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON profissionais;
CREATE POLICY "tenant_isolation" ON profissionais
  FOR ALL USING (user_id = current_team_id()) WITH CHECK (user_id = current_team_id());

CREATE INDEX IF NOT EXISTS idx_profissionais_user ON profissionais(user_id);

-- ─────────────────────────────────────────────────────────────
-- 2. AGENDAMENTOS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agendamentos (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL DEFAULT current_team_id() REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id      UUID        REFERENCES pacientes(id) ON DELETE SET NULL,
  paciente_nome    TEXT        NOT NULL,  -- desnormalizado para exibição rápida
  profissional_id  UUID        REFERENCES profissionais(id) ON DELETE SET NULL,
  servico_id       UUID        REFERENCES servicos(id) ON DELETE SET NULL,
  servico_nome     TEXT,                  -- desnormalizado
  data             DATE        NOT NULL,
  hora_inicio      TIME        NOT NULL,
  hora_fim         TIME        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'agendado'
                               CHECK (status IN ('agendado','confirmado','realizado','faltou','cancelado')),
  observacoes      TEXT,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON agendamentos;
CREATE POLICY "tenant_isolation" ON agendamentos
  FOR ALL USING (user_id = current_team_id()) WITH CHECK (user_id = current_team_id());

CREATE INDEX IF NOT EXISTS idx_agendamentos_user_data  ON agendamentos(user_id, data);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data       ON agendamentos(data);
CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente   ON agendamentos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status     ON agendamentos(status);

-- ─────────────────────────────────────────────────────────────
-- 3. PRONTUÁRIOS (um por paciente — contém anamnese estática)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prontuarios (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID        NOT NULL DEFAULT current_team_id() REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id               UUID        NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  -- Anamnese: preenchida na 1ª consulta, atualizada ao longo do tempo
  alergias                  TEXT,
  medicamentos_uso_continuo TEXT,
  historico_familiar        TEXT,
  habitos                   TEXT,  -- tabagismo, álcool, atividade física, dieta
  observacoes_gerais        TEXT,
  criado_em                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, paciente_id)
);

ALTER TABLE prontuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON prontuarios;
CREATE POLICY "tenant_isolation" ON prontuarios
  FOR ALL USING (user_id = current_team_id()) WITH CHECK (user_id = current_team_id());

CREATE INDEX IF NOT EXISTS idx_prontuarios_user     ON prontuarios(user_id);
CREATE INDEX IF NOT EXISTS idx_prontuarios_paciente ON prontuarios(paciente_id);

-- ─────────────────────────────────────────────────────────────
-- 4. CONSULTAS DO PRONTUÁRIO (uma por visita/atendimento)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prontuario_consultas (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL DEFAULT current_team_id() REFERENCES auth.users(id) ON DELETE CASCADE,
  prontuario_id         UUID        NOT NULL REFERENCES prontuarios(id) ON DELETE CASCADE,
  agendamento_id        UUID        REFERENCES agendamentos(id) ON DELETE SET NULL,
  data                  DATE        NOT NULL DEFAULT CURRENT_DATE,
  profissional_nome     TEXT,
  queixa_principal      TEXT,
  historia_doenca_atual TEXT,
  exame_fisico          TEXT,
  hipotese_diagnostica  TEXT,
  conduta               TEXT,
  evolucao              TEXT,  -- campo livre de evolução
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE prontuario_consultas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON prontuario_consultas;
CREATE POLICY "tenant_isolation" ON prontuario_consultas
  FOR ALL USING (user_id = current_team_id()) WITH CHECK (user_id = current_team_id());

CREATE INDEX IF NOT EXISTS idx_pron_consultas_prontuario ON prontuario_consultas(prontuario_id);
CREATE INDEX IF NOT EXISTS idx_pron_consultas_data       ON prontuario_consultas(data DESC);

-- ─────────────────────────────────────────────────────────────
-- 5. PRESCRIÇÕES (vinculadas à consulta)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prontuario_prescricoes (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL DEFAULT current_team_id() REFERENCES auth.users(id) ON DELETE CASCADE,
  consulta_id UUID    NOT NULL REFERENCES prontuario_consultas(id) ON DELETE CASCADE,
  medicamento TEXT    NOT NULL,
  dosagem     TEXT,
  frequencia  TEXT,
  duracao     TEXT,
  instrucoes  TEXT,
  ordem       INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE prontuario_prescricoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON prontuario_prescricoes;
CREATE POLICY "tenant_isolation" ON prontuario_prescricoes
  FOR ALL USING (user_id = current_team_id()) WITH CHECK (user_id = current_team_id());

CREATE INDEX IF NOT EXISTS idx_pron_prescricoes_consulta ON prontuario_prescricoes(consulta_id);

-- ─────────────────────────────────────────────────────────────
-- 6. EXAMES (upload via Supabase Storage — apenas URLs no banco)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prontuario_exames (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL DEFAULT current_team_id() REFERENCES auth.users(id) ON DELETE CASCADE,
  prontuario_id UUID        NOT NULL REFERENCES prontuarios(id) ON DELETE CASCADE,
  consulta_id   UUID        REFERENCES prontuario_consultas(id) ON DELETE SET NULL,
  nome          TEXT        NOT NULL,
  tipo          TEXT        CHECK (tipo IN ('laboratorial','imagem','outro')),
  arquivo_url   TEXT,        -- URL pública do Supabase Storage
  arquivo_nome  TEXT,
  data_exame    DATE,
  resultado     TEXT,        -- resumo ou laudo digitado manualmente
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE prontuario_exames ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON prontuario_exames;
CREATE POLICY "tenant_isolation" ON prontuario_exames
  FOR ALL USING (user_id = current_team_id()) WITH CHECK (user_id = current_team_id());

CREATE INDEX IF NOT EXISTS idx_pron_exames_prontuario ON prontuario_exames(prontuario_id);

-- ─────────────────────────────────────────────────────────────
-- 7. Inserir profissional padrão para todos os usuários existentes
-- ─────────────────────────────────────────────────────────────
INSERT INTO profissionais (user_id, nome, especialidade, cor)
SELECT id, 'Dra. Ana Beatriz Buzatto', 'Clínica Médica', '#6366f1'
FROM auth.users
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 8. Storage bucket para exames (execute separadamente se necessário)
-- ─────────────────────────────────────────────────────────────
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('exames', 'exames', false)
-- ON CONFLICT DO NOTHING;
--
-- CREATE POLICY "tenant_exames" ON storage.objects
--   FOR ALL USING (auth.uid() IS NOT NULL AND bucket_id = 'exames');

-- ═══════════════════════════════════════════════════════════════
-- FIM DO SCRIPT
-- Tabelas criadas: profissionais, agendamentos, prontuarios,
--   prontuario_consultas, prontuario_prescricoes, prontuario_exames
-- ═══════════════════════════════════════════════════════════════
