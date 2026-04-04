-- ═══════════════════════════════════════════════════════════════
-- INTEGRAÇÃO CARTEIRA ↔ AGENDA — ClinKPI
-- Recria a VIEW carteira unificando importação CSV + agenda interna
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════
--
-- Fontes unificadas:
--   • atendimentos  → consultas importadas via CSV (histórico)
--   • agendamentos  → agenda interna (status = 'realizado' = realizado)
--
-- Deduplicação: UNION (não UNION ALL) garante que o mesmo
-- paciente+data não seja contado duas vezes.
-- Em caso de colisão de data entre as duas fontes,
-- a agenda interna tem prioridade (fonte mais confiável).
-- ═══════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS carteira;
CREATE VIEW carteira AS
WITH

-- ── 1. Todos os atendimentos realizados (import + agenda) ────────
todos_realizados AS (

  -- Fonte A: importação via CSV
  -- data_atendimento está em texto DD/MM/YYYY → converte para DATE
  SELECT
    p.id          AS pid,
    TO_DATE(a.data_atendimento, 'DD/MM/YYYY') AS data,
    'import'::text AS origem
  FROM atendimentos a
  JOIN pacientes p
    ON p.paciente = a.paciente
   AND p.user_id  = a.user_id
  WHERE a.user_id = current_team_id()
    AND a.data_atendimento IS NOT NULL
    AND a.data_atendimento ~ '^\d{2}/\d{2}/\d{4}$'  -- ignora linhas com formato inválido

  UNION  -- elimina linhas duplicadas (mesmo pid + data)

  -- Fonte B: agenda interna (somente status = realizado)
  SELECT
    COALESCE(ag.paciente_id, p2.id) AS pid,
    ag.data                          AS data,
    'agenda'::text                   AS origem
  FROM agendamentos ag
  LEFT JOIN pacientes p2
    ON p2.paciente = ag.paciente_nome
   AND p2.user_id  = ag.user_id
  WHERE ag.user_id = current_team_id()
    AND ag.status  = 'realizado'
    AND COALESCE(ag.paciente_id, p2.id) IS NOT NULL
),

-- ── 2. Agrega por paciente ───────────────────────────────────────
agg AS (
  SELECT
    pid,
    COUNT(*)   AS qtd_at,
    MAX(data)  AS ultimo_atendimento
  FROM todos_realizados
  GROUP BY pid
),

-- ── 3. Origem do último atendimento ─────────────────────────────
-- Em caso de empate de data: 'agenda' vence 'import' (order DESC)
origem_ultimo AS (
  SELECT DISTINCT ON (t.pid)
    t.pid,
    t.origem AS origem_ultimo_atend
  FROM todos_realizados t
  JOIN agg ON agg.pid = t.pid AND agg.ultimo_atendimento = t.data
  ORDER BY t.pid, t.origem DESC
),

-- ── 4. Próximo agendamento — agenda interna ──────────────────────
prox_agenda AS (
  SELECT DISTINCT ON (COALESCE(ag.paciente_id, p2.id))
    COALESCE(ag.paciente_id, p2.id) AS pid,
    ag.data                          AS proximo_data
  FROM agendamentos ag
  LEFT JOIN pacientes p2
    ON p2.paciente = ag.paciente_nome
   AND p2.user_id  = ag.user_id
  WHERE ag.user_id = current_team_id()
    AND ag.status  IN ('agendado', 'confirmado')
    AND ag.data    >= CURRENT_DATE
    AND COALESCE(ag.paciente_id, p2.id) IS NOT NULL
  ORDER BY COALESCE(ag.paciente_id, p2.id), ag.data ASC
)

-- ── 5. SELECT final ──────────────────────────────────────────────
SELECT
  p.paciente,
  p.nascimento,
  NULL::text AS observacao,

  -- Último atendimento (mais recente entre import e agenda)
  agg.ultimo_atendimento,

  -- Total de atendimentos (deduplicado por data)
  COALESCE(agg.qtd_at, 0)::integer                              AS qtd_at,

  -- Recência em dias
  CASE WHEN agg.ultimo_atendimento IS NOT NULL
       THEN (CURRENT_DATE - agg.ultimo_atendimento)::integer
       ELSE NULL
  END                                                            AS recencia_dias,

  -- Idade em dias (nascimento é TEXT → cast para DATE)
  CASE WHEN p.nascimento IS NOT NULL AND p.nascimento ~ '^\d{4}-\d{2}-\d{2}$'
       THEN (CURRENT_DATE - p.nascimento::date)::integer
       ELSE NULL
  END                                                            AS idade_dias,

  -- Próximo agendamento (data como texto — mantém compatibilidade)
  pa.proximo_data::text                                          AS agendado,

  -- ── Novos campos de origem (para badge na carteira) ───────────
  -- De onde veio o último atendimento
  ou.origem_ultimo_atend                                         AS origem_ultimo_atend,

  -- De onde veio o próximo agendamento
  CASE WHEN pa.proximo_data IS NOT NULL THEN 'agenda' ELSE NULL
  END                                                            AS origem_agendado

FROM pacientes p
LEFT JOIN agg          ON agg.pid = p.id
LEFT JOIN origem_ultimo ou ON ou.pid = p.id
LEFT JOIN prox_agenda  pa  ON pa.pid = p.id
WHERE p.user_id = current_team_id();


-- ── Índice auxiliar para a nova query de agendamentos ────────────
-- (garante que o JOIN por paciente_nome seja eficiente)
CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente_nome
  ON agendamentos(user_id, paciente_nome, status, data);
