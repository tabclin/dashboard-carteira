-- ═══════════════════════════════════════════════════════════════
-- Controle de ciclo de consulta + imutabilidade LGPD
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Novas colunas em prontuario_consultas
ALTER TABLE prontuario_consultas
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'em_atendimento', 'finalizado')),
  ADD COLUMN IF NOT EXISTS iniciado_em    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalizado_em  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duracao_minutos INTEGER;

-- Índice para localizar consulta ativa rapidamente
CREATE INDEX IF NOT EXISTS idx_consultas_status
  ON prontuario_consultas(prontuario_id, status);

-- ─────────────────────────────────────────────────────────────
-- Políticas RLS restritivas para imutabilidade pós-finalização
-- (coexistem com a política tenant_isolation FOR ALL já existente)
-- ─────────────────────────────────────────────────────────────

-- Bloquear UPDATE em registros finalizados
DROP POLICY IF EXISTS "block_update_finalizado" ON prontuario_consultas;
CREATE POLICY "block_update_finalizado" ON prontuario_consultas
  FOR UPDATE
  USING  (user_id = current_team_id() AND status <> 'finalizado')
  WITH CHECK (user_id = current_team_id());

-- Bloquear DELETE em registros finalizados
DROP POLICY IF EXISTS "block_delete_finalizado" ON prontuario_consultas;
CREATE POLICY "block_delete_finalizado" ON prontuario_consultas
  FOR DELETE
  USING  (user_id = current_team_id() AND status <> 'finalizado');

-- Bloquear DELETE em prescrições de consultas finalizadas
DROP POLICY IF EXISTS "block_delete_prescricao_finalizada" ON prontuario_prescricoes;
CREATE POLICY "block_delete_prescricao_finalizada" ON prontuario_prescricoes
  FOR DELETE
  USING (
    user_id = current_team_id() AND
    NOT EXISTS (
      SELECT 1 FROM prontuario_consultas c
      WHERE c.id = prontuario_prescricoes.consulta_id
        AND c.status = 'finalizado'
    )
  );
