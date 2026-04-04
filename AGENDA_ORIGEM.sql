-- ═══════════════════════════════════════════════════════════════
-- Adiciona campo origem em agendamentos (manual vs plano)
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual'
    CHECK (origem IN ('manual', 'plano'));

CREATE INDEX IF NOT EXISTS idx_agendamentos_origem
  ON agendamentos(user_id, origem);
