-- =============================================================
-- CARTEIRA_ATIVO.sql
-- Adiciona campo ativo à tabela pacientes
-- Execute este script no Supabase (SQL Editor)
-- =============================================================

-- Marca cada paciente como ativo (true) ou inativo (false)
-- NULL herdado de linhas antigas é tratado como true no app
ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

SELECT 'CARTEIRA_ATIVO.sql executado com sucesso!' AS resultado;
