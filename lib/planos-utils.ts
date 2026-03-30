import type {
  PlanoPagamento, ConsultaRascunho, PlanoStatus,
  AgendamentoStatus, PlanoAgendamentoAlerta, PlanoAgendamentoInfo,
} from '@/types'

/**
 * Calcula o valor com plano e cashback para uma única consulta.
 * Todos os valores em centavos.
 */
export function calcularConsulta(
  valorCheio: number,
  plano: PlanoPagamento | null,
  saldoCashbackAnterior: number = 0
): {
  valorComPlano: number
  cashbackGerado: number
  cashbackUtilizado: number
  saldoApos: number
} {
  if (!plano) {
    return {
      valorComPlano: valorCheio,
      cashbackGerado: 0,
      cashbackUtilizado: 0,
      saldoApos: saldoCashbackAnterior,
    }
  }

  const pct = plano.percentual ?? 0

  if (plano.tipo === 'desconto_fixo') {
    const desconto = Math.round(valorCheio * pct / 100)
    return {
      valorComPlano: valorCheio - desconto,
      cashbackGerado: 0,
      cashbackUtilizado: 0,
      saldoApos: saldoCashbackAnterior,
    }
  }

  if (plano.tipo === 'cashback') {
    // Aplica saldo acumulado primeiro, depois gera cashback sobre valor pago
    const cashbackUtilizado = Math.min(saldoCashbackAnterior, valorCheio)
    const valorPago = valorCheio - cashbackUtilizado
    const cashbackGerado = Math.round(valorPago * pct / 100)
    return {
      valorComPlano: valorPago,
      cashbackGerado,
      cashbackUtilizado,
      saldoApos: saldoCashbackAnterior - cashbackUtilizado + cashbackGerado,
    }
  }

  // personalizado: sem cálculo automático, médica define valores manualmente
  return {
    valorComPlano: valorCheio,
    cashbackGerado: 0,
    cashbackUtilizado: 0,
    saldoApos: saldoCashbackAnterior,
  }
}

/**
 * Recalcula todas as consultas de uma lista em sequência,
 * propagando o saldo de cashback entre elas.
 */
export function recalcularTimeline(
  consultas: ConsultaRascunho[],
  plano: PlanoPagamento | null
): ConsultaRascunho[] {
  let saldo = 0
  return consultas.map(c => {
    const result = calcularConsulta(c.valor_cheio, plano, saldo)
    saldo = result.saldoApos
    return {
      ...c,
      valor_com_plano: result.valorComPlano,
      cashback_gerado: result.cashbackGerado,
      cashback_utilizado: result.cashbackUtilizado,
    }
  })
}

/**
 * Recalcula todas as consultas de todos os pacientes,
 * cada paciente tem seu próprio saldo de cashback.
 */
export function recalcularTodosPacientes<T extends { consultas: ConsultaRascunho[] }>(
  pacientes: T[],
  plano: PlanoPagamento | null
): T[] {
  return pacientes.map(p => ({
    ...p,
    consultas: recalcularTimeline(p.consultas, plano),
  }))
}

// ── Labels e cores de status ─────────────────────────────────────

export const STATUS_LABELS: Record<PlanoStatus, string> = {
  rascunho:         'Rascunho',
  proposta_enviada: 'Proposta Enviada',
  em_andamento:     'Em Andamento',
  nao_aderido:      'Não Aderido',
  concluido:        'Concluído',
}

// Transições válidas por status (máquina de estados)
export const STATUS_TRANSITIONS: Record<PlanoStatus, PlanoStatus[]> = {
  rascunho:         ['proposta_enviada'],
  proposta_enviada: ['em_andamento', 'nao_aderido'],
  em_andamento:     ['concluido', 'nao_aderido'],
  nao_aderido:      [],
  concluido:        [],
}

export const STATUS_COLORS: Record<PlanoStatus, { bg: string; text: string; border: string; dot: string }> = {
  rascunho:         { bg: 'bg-slate-100',    text: 'text-slate-600',    border: 'border-slate-200',    dot: 'bg-slate-400'    },
  proposta_enviada: { bg: 'bg-amber-50',     text: 'text-amber-700',    border: 'border-amber-200',    dot: 'bg-amber-400'    },
  em_andamento:     { bg: 'bg-blue-50',      text: 'text-blue-700',     border: 'border-blue-200',     dot: 'bg-blue-500'     },
  nao_aderido:      { bg: 'bg-red-50',       text: 'text-red-700',      border: 'border-red-200',      dot: 'bg-red-400'      },
  concluido:        { bg: 'bg-emerald-50',   text: 'text-emerald-700',  border: 'border-emerald-200',  dot: 'bg-emerald-500'  },
}

// ── Helpers financeiros ──────────────────────────────────────────

export function somarConsultas(consultas: ConsultaRascunho[]) {
  return consultas.reduce(
    (acc, c) => ({
      totalCheio: acc.totalCheio + c.valor_cheio,
      totalComPlano: acc.totalComPlano + c.valor_com_plano,
      totalCashback: acc.totalCashback + c.cashback_gerado,
    }),
    { totalCheio: 0, totalComPlano: 0, totalCashback: 0 }
  )
}

export function calcularEconomia(totalCheio: number, totalComPlano: number) {
  const economiaReais = totalCheio - totalComPlano
  const economiaPct = totalCheio > 0 ? Math.round((economiaReais / totalCheio) * 100) : 0
  return { economiaReais, economiaPct }
}

// ── Agendamento ──────────────────────────────────────────────────

/**
 * Alerta de agendamento de uma consulta individual.
 * Retorna null se a consulta está realizada, já agendada, ou sem data sugerida.
 */
export function calcularAlertaConsulta(
  realizada: boolean,
  data_sugerida: string | null,
  data_agendamento: string | null,
  antecedencia_dias: number
): 'atrasado' | 'precisa_agendar' | null {
  if (realizada || !data_sugerida || data_agendamento) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const dataSugerida = new Date(data_sugerida)
  dataSugerida.setHours(0, 0, 0, 0)
  const deadline = new Date(dataSugerida)
  deadline.setDate(deadline.getDate() - antecedencia_dias)
  if (hoje > deadline) return 'atrasado'
  if (hoje >= deadline && dataSugerida >= hoje) return 'precisa_agendar'
  return null
}

/** Status derivado de uma consulta individual */
export function calcularAgendamentoConsulta(
  realizada: boolean,
  data_agendamento: string | null
): AgendamentoStatus {
  if (realizada) return 'concluida'
  if (data_agendamento) return 'agendada'
  return 'nao_agendada'
}

interface ConsultaParaAlerta {
  data_sugerida: string | null
  data_agendamento: string | null
  realizada: boolean
  antecedencia_dias: number
}

/**
 * Calcula o alerta de agendamento agregado de um plano inteiro.
 * Usa a antecedência definida por serviço para determinar urgência.
 *
 * ATRASADO:       hoje > (data_sugerida - antecedencia_dias)  → passou do prazo de agendar
 * PRECISA_AGENDAR: hoje >= deadline E data_sugerida >= hoje    → dentro da janela de agendamento
 * EM_DIA:         hoje < deadline                              → ainda há tempo
 */
export function calcularAlertaPlano(consultas: ConsultaParaAlerta[]): PlanoAgendamentoInfo {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const pendentes = consultas.filter(c => !c.realizada)
  const semAgendamento = pendentes.filter(c => !c.data_agendamento)

  let temAtrasado = false
  let temPrecisaAgendar = false

  for (const c of semAgendamento) {
    if (!c.data_sugerida) continue

    const dataSugerida = new Date(c.data_sugerida)
    dataSugerida.setHours(0, 0, 0, 0)

    // Deadline = data_sugerida - antecedencia_dias
    const deadline = new Date(dataSugerida)
    deadline.setDate(deadline.getDate() - c.antecedencia_dias)

    if (hoje > deadline) {
      // Passou do prazo de agendar (independente de a data sugerida ter passado ou não)
      temAtrasado = true
      break
    } else if (hoje >= deadline && dataSugerida >= hoje) {
      // Dentro da janela: entre o deadline e a data sugerida
      temPrecisaAgendar = true
    }
  }

  // Próxima consulta pendente (menor data_sugerida)
  const pendentesComData = pendentes
    .filter(c => c.data_sugerida)
    .sort((a, b) => a.data_sugerida!.localeCompare(b.data_sugerida!))

  const proxima = pendentesComData[0] ?? null

  let alerta: PlanoAgendamentoAlerta = 'em_dia'
  if (temAtrasado) alerta = 'atrasado'
  else if (temPrecisaAgendar) alerta = 'precisa_agendar'

  return {
    alerta,
    proxima_data_sugerida: proxima?.data_sugerida ?? null,
    proxima_agendada: proxima ? !!proxima.data_agendamento : false,
    total_pendentes: pendentes.length,
    total_sem_agendamento: semAgendamento.length,
  }
}

/** Cores para o badge de alerta de agendamento */
export const AGENDAMENTO_ALERTA_COLORS: Record<PlanoAgendamentoAlerta, {
  bg: string; text: string; border: string; dot: string
}> = {
  em_dia:          { bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200',  dot: 'bg-emerald-500'  },
  precisa_agendar: { bg: 'bg-amber-50',    text: 'text-amber-700',    border: 'border-amber-200',    dot: 'bg-amber-400'    },
  atrasado:        { bg: 'bg-red-50',      text: 'text-red-700',      border: 'border-red-200',      dot: 'bg-red-500'      },
}

export const AGENDAMENTO_ALERTA_LABELS: Record<PlanoAgendamentoAlerta, string> = {
  em_dia:          'Em dia',
  precisa_agendar: 'Precisa Agendar',
  atrasado:        'Atrasado',
}

/** Formata uma data ISO para "Mai/2026" */
export function formatarMesAno(isoDate: string): string {
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const [ano, mes] = isoDate.split('-')
  return `${MESES[parseInt(mes, 10) - 1]}/${ano}`
}
