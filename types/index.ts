export type StatusPaciente = 'Ok' | 'Atenção' | 'Perigo'

export interface Paciente {
  paciente: string
  ultimo_atendimento: string | null
  qtd_at: number
  nascimento: string | null
  observacao: string | null
  agendado: string | null
  recencia_dias: number | null
  idade_dias: number | null
  status: StatusPaciente
  retorno_ideal_dias?: number | null   // calculado em runtime pelo app
  retorno_custom_dias?: number | null  // override manual salvo no banco
  ativo?: boolean                      // false = oculto da carteira principal
}

export interface ConfigRetornoFaixa {
  id: string
  user_id: string
  idade_min_dias: number
  idade_max_dias: number | null
  retorno_dias: number
  ordem: number
}

export interface AtendimentoMes {
  mes: string
  faturamento: number
  quantidade: number
  ticket_medio: number
}

export interface FaixaEtaria {
  faixa: string
  total: number
}

export interface FaixaRecencia {
  faixa: string
  total: number
}

export interface DashboardData {
  total_pacientes: number
  pacientes_ok: number
  pacientes_atencao: number
  pacientes_perigo: number
  faturamento_total_mes: number
  ticket_medio: number
  atendimentos_por_mes: AtendimentoMes[]
  faixas_etarias: FaixaEtaria[]
  faixas_recencia: FaixaRecencia[]
}

export interface UploadResult {
  sucesso: boolean
  inseridos: number
  erros: number
  mensagem: string
}

// ── Módulo: Planos de Acompanhamento ────────────────────────────

export type PlanoPagamentoTipo = 'desconto_fixo' | 'cashback' | 'personalizado'

export type PlanoStatus =
  | 'rascunho'
  | 'proposta_enviada'
  | 'em_andamento'
  | 'nao_aderido'
  | 'concluido'

export interface Servico {
  id: string
  nome: string
  descricao: string | null
  valor_cheio: number        // centavos
  valor_recorrente: number | null
  antecedencia_dias: number  // dias de antecedência necessários para agendamento
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface PlanoPagamento {
  id: string
  nome: string
  tipo: PlanoPagamentoTipo
  percentual: number | null
  descricao: string | null
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface PlanoAcompanhamento {
  id: string
  responsavel_nome: string
  responsavel_telefone: string | null
  status: PlanoStatus
  data_inicio: string | null
  data_fim: string | null
  plano_pagamento_id: string | null
  observacao: string | null
  criado_em: string
  atualizado_em: string
  // relações
  plano_pagamento?: PlanoPagamento | null
  plano_pacientes?: PlanoPaciente[]
}

export interface PlanoPaciente {
  id: string
  plano_id: string
  nome: string
  nascimento: string | null
  observacao: string | null
  ordem: number
  criado_em: string
  // relações
  plano_consultas?: PlanoConsulta[]
}

export interface PlanoConsulta {
  id: string
  paciente_id: string
  plano_id: string
  servico_id: string | null
  servico_nome: string
  data_sugerida: string | null
  data_agendamento: string | null  // data real de agendamento na agenda
  valor_cheio: number          // centavos
  valor_com_plano: number      // centavos
  cashback_gerado: number      // centavos
  cashback_utilizado: number   // centavos
  observacao: string | null
  realizada: boolean
  ordem: number
  criado_em: string
  atualizado_em: string
}

// ── Agendamento ─────────────────────────────────────────────────

/** Status derivado de uma consulta individual */
export type AgendamentoStatus = 'nao_agendada' | 'agendada' | 'concluida'

/** Alerta agregado de um plano inteiro */
export type PlanoAgendamentoAlerta = 'em_dia' | 'precisa_agendar' | 'atrasado'

/** Informação de agendamento calculada por plano (para a lista) */
export interface PlanoAgendamentoInfo {
  alerta: PlanoAgendamentoAlerta
  proxima_data_sugerida: string | null  // ISO date da próxima consulta pendente
  proxima_agendada: boolean
  total_pendentes: number
  total_sem_agendamento: number
}

// Estado efêmero do wizard (não persiste diretamente)
export interface ConsultaRascunho {
  tempId: string
  servico_id: string | null
  servico_nome: string
  data_sugerida: string
  valor_cheio: number
  valor_com_plano: number   // calculado
  cashback_gerado: number   // calculado
  cashback_utilizado: number
  observacao: string
}

export interface PacienteRascunho {
  tempId: string
  nome: string
  nascimento: string
  observacao: string
  carteira_id?: string | null
  consultas: ConsultaRascunho[]
}

export interface PlanoWizardState {
  responsavel_nome: string
  responsavel_telefone: string
  data_inicio: string
  data_fim: string
  plano_pagamento_id: string | null
  observacao: string
  pacientes: PacienteRascunho[]
}

// ── Módulo: Financeiro ──────────────────────────────────────────

export interface FinClassificacao {
  id: string
  nome: string
  tipo: 'fixo' | 'variavel'
  movimentacao: 'entrada' | 'saida'
  ativo: boolean
  criado_em: string
}

export interface FinCategoria {
  id: string
  nome: string
  descricao: string | null
  tipo: 'entrada' | 'saida'
  classificacao: string        // valor legado ('fixo' | 'variavel')
  classificacao_id: string | null
  meta_mensal: number | null   // centavos
  servico_id: string | null    // se tipo='entrada', vincula ao serviço correspondente
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface FinDreLinha {
  id: string
  nome: string
  tipo: 'entrada' | 'saida' | 'resultado'
  ordem: number
  ativo: boolean
  criado_em: string
  classificacao_ids: string[]  // de fin_dre_linha_classificacoes
}

export interface FinMovimentacao {
  id: string
  descricao: string
  valor: number                // centavos, sempre positivo
  tipo: 'entrada' | 'saida'
  categoria_id: string | null
  servico_id: string | null
  data_competencia: string     // ISO date
  data_caixa: string | null    // ISO date; null = pendente
  origem: 'manual' | 'importacao' | 'plano'
  observacao: string | null
  criado_em: string
  atualizado_em: string
  categoria?: FinCategoria | null
  servico?: { id: string; nome: string } | null
}

export interface FinAlocacao {
  id: string
  categoria_id: string
  servico_id: string
  tipo_alocacao: 'percentual_custo' | 'percentual_receita' | 'valor_fixo_unidade'
  valor: number
  ativo: boolean
  criado_em: string
  categoria?: FinCategoria | null
}

export interface FinOrcamento {
  id: string
  categoria_id: string
  ano: number
  mes: number
  valor_previsto: number       // centavos (0 quando tipo_calculo='percentual')
  tipo_calculo: 'fixo' | 'percentual'
  percentual: number | null        // ex: 10 = 10%
  categoria_ref_ids: string[]      // categorias cujo realizado serve de base
  criado_em: string
}

export interface FinKpis {
  receita_total: number
  despesa_total: number
  lucro_liquido: number
  margem_liquida: number       // 0-100
  custos_fixos: number
  custos_variaveis: number
  ponto_equilibrio_receita: number
  total_entradas: number
  total_saidas: number
}

export interface FinChartMes {
  mes: string                  // label "Jan", "Fev"...
  receita: number
  despesa: number
  lucro: number
}

export interface FinCategoriaPie {
  nome: string
  valor: number
}

// ── KPIs da tela de gestão ──────────────────────────────────────

// KPIs da tela de gestão
export interface PlanosKpi {
  total: number
  rascunho: number
  proposta_enviada: number
  em_andamento: number
  nao_aderido: number
  concluido: number
  receita_projetada: number   // centavos
  receita_realizada: number   // centavos
  taxa_conversao: number      // 0-100
}
