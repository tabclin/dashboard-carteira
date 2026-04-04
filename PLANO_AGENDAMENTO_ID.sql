-- ═══════════════════════════════════════════════════════════════
-- Vincula cada consulta de plano ao agendamento criado na agenda
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE plano_consultas
  ADD COLUMN IF NOT EXISTS agendamento_id UUID
    REFERENCES agendamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_plano_consultas_agendamento
  ON plano_consultas(agendamento_id);
