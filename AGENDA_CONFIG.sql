-- ============================================================
-- AGENDA_CONFIG.sql
-- Configuração centralizada de agenda: horários, dias ativos e bloqueios
-- Rodar no Supabase → SQL Editor
-- ============================================================

-- Tabela de configuração (uma linha por usuário/clínica)
CREATE TABLE IF NOT EXISTS agenda_config (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL DEFAULT current_team_id(),
  hora_inicio   TEXT        NOT NULL DEFAULT '07:00',
  hora_fim      TEXT        NOT NULL DEFAULT '20:00',
  dias_ativos   INTEGER[]   NOT NULL DEFAULT '{1,2,3,4,5,6}',
  -- 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Tabela de bloqueios de agenda (férias, feriados, ausências)
CREATE TABLE IF NOT EXISTS agenda_bloqueios (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL DEFAULT current_team_id(),
  data_inicio DATE        NOT NULL,
  data_fim    DATE        NOT NULL,
  hora_inicio TEXT        DEFAULT NULL,   -- NULL = dia inteiro bloqueado
  hora_fim    TEXT        DEFAULT NULL,   -- NULL = dia inteiro bloqueado
  motivo      TEXT        DEFAULT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security
ALTER TABLE agenda_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_bloqueios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_agenda_config"    ON agenda_config;
DROP POLICY IF EXISTS "owner_agenda_bloqueios" ON agenda_bloqueios;

CREATE POLICY "owner_agenda_config" ON agenda_config
  USING (user_id = current_team_id())
  WITH CHECK (user_id = current_team_id());

CREATE POLICY "owner_agenda_bloqueios" ON agenda_bloqueios
  USING (user_id = current_team_id())
  WITH CHECK (user_id = current_team_id());
