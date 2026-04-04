-- ═══════════════════════════════════════════════════════════════
-- Redesign do fluxo do prontuário + integração com agenda
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Adicionar status em_consulta à agenda
--    (precisa recriar o CHECK constraint)
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check;
ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_status_check
  CHECK (status IN ('agendado','confirmado','em_consulta','realizado','faltou','cancelado'));

-- 2. Coluna orientacao na consulta (aba futura)
ALTER TABLE prontuario_consultas
  ADD COLUMN IF NOT EXISTS orientacao TEXT;
