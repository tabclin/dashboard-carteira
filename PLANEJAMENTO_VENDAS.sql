-- ============================================================
-- PLANEJAMENTO_VENDAS.sql
-- Tabela de planejamento de volume de vendas (qtd de atendimentos por serviço × mês)
-- Rodar no Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS fin_planejamento_vendas (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL DEFAULT current_team_id(),
  servico_id    UUID        REFERENCES servicos(id) ON DELETE CASCADE,
  servico_nome  TEXT        NOT NULL,
  ano           INTEGER     NOT NULL,
  mes           INTEGER     NOT NULL CHECK (mes BETWEEN 1 AND 12),
  quantidade    INTEGER     NOT NULL DEFAULT 0,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, servico_id, ano, mes)
);

-- Row Level Security
ALTER TABLE fin_planejamento_vendas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_planejamento_vendas" ON fin_planejamento_vendas;
CREATE POLICY "owner_planejamento_vendas" ON fin_planejamento_vendas
  USING (user_id = current_team_id())
  WITH CHECK (user_id = current_team_id());
