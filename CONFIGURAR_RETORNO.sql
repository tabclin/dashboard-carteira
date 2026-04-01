-- =============================================================
-- CONFIGURAR_RETORNO.sql
-- Adiciona suporte a intervalos de retorno configuráveis por usuário
-- Execute este script no Supabase (SQL Editor)
-- =============================================================

-- 1. Tabela de configuração de intervalos de retorno por faixa etária
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carteira_config_retorno (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
                             DEFAULT current_team_id(),
  idade_min_dias INTEGER     NOT NULL DEFAULT 0,
  idade_max_dias INTEGER,    -- NULL = sem limite superior (última faixa)
  retorno_dias   INTEGER     NOT NULL,
  ordem          INTEGER     NOT NULL DEFAULT 0,
  criado_em      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, idade_min_dias)
);

-- RLS: cada usuário/equipe acessa apenas suas próprias regras
ALTER TABLE carteira_config_retorno ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON carteira_config_retorno;
CREATE POLICY "tenant_isolation" ON carteira_config_retorno
  FOR ALL USING (user_id = current_team_id());

-- Index de performance
CREATE INDEX IF NOT EXISTS idx_config_retorno_user ON carteira_config_retorno(user_id);

-- 2. Override manual por paciente
-- ---------------------------------------------------------------
-- NULL = usar regra automática | valor inteiro = intervalo personalizado em dias
ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS retorno_custom_dias INTEGER;

-- 3. Inserir regras padrão para todos os usuários existentes
-- ---------------------------------------------------------------
-- Faixa 1: 0 a 12 meses (0–364 dias) → retorno a cada 30 dias
INSERT INTO carteira_config_retorno (user_id, idade_min_dias, idade_max_dias, retorno_dias, ordem)
SELECT id, 0, 365, 30, 1 FROM auth.users
ON CONFLICT (user_id, idade_min_dias) DO NOTHING;

-- Faixa 2: 12 a 24 meses (365–729 dias) → retorno a cada 60 dias
INSERT INTO carteira_config_retorno (user_id, idade_min_dias, idade_max_dias, retorno_dias, ordem)
SELECT id, 365, 730, 60, 2 FROM auth.users
ON CONFLICT (user_id, idade_min_dias) DO NOTHING;

-- Faixa 3: 24 meses em diante (730+ dias) → retorno a cada 180 dias
INSERT INTO carteira_config_retorno (user_id, idade_min_dias, idade_max_dias, retorno_dias, ordem)
SELECT id, 730, NULL, 180, 3 FROM auth.users
ON CONFLICT (user_id, idade_min_dias) DO NOTHING;

-- 4. (Informativo) Como o status é calculado no app
-- ---------------------------------------------------------------
-- Ok      : recencia_dias <= FLOOR(retorno_ideal * 2/3)
-- Atenção  : recencia_dias entre (2/3 * retorno_ideal) e retorno_ideal
-- Perigo   : recencia_dias > retorno_ideal
--
-- Exemplo com retorno_ideal = 30 dias:
--   Ok      : recencia <= 20 dias
--   Atenção  : recencia 21–30 dias
--   Perigo   : recencia > 30 dias

SELECT 'CONFIGURAR_RETORNO.sql executado com sucesso!' AS resultado;
