// Regras das tarefas (puras, sem banco): prazo sugerido, agrupamento e texto do prazo.
// Datas sempre como "AAAA-MM-DD" (dia, sem fuso).

export type TipoTarefa = 'exames' | 'dri' | 'orientacao'
export const TIPOS_TAREFA: { tipo: TipoTarefa; rotulo: string; acao: string }[] = [
  { tipo: 'exames', rotulo: 'Check Exames', acao: 'Analisar exames' },
  { tipo: 'dri', rotulo: 'DRI', acao: 'Fazer DRI' },
  { tipo: 'orientacao', rotulo: 'Orientações', acao: 'Enviar orientação' },
]
export const acaoDaTarefa = (t: string) => TIPOS_TAREFA.find((x) => x.tipo === t)?.acao ?? t

export type DiasPadrao = Record<TipoTarefa, number>
export const DIAS_PADRAO: DiasPadrao = { exames: 5, dri: 7, orientacao: 3 }

const MS_DIA = 86_400_000
const paraData = (s: string) => new Date(s + 'T00:00:00Z')
const paraTexto = (d: Date) => d.toISOString().slice(0, 10)
export const somarDias = (dia: string, n: number) => paraTexto(new Date(paraData(dia).getTime() + n * MS_DIA))
export const diasEntre = (de: string, ate: string) => Math.round((paraData(ate).getTime() - paraData(de).getTime()) / MS_DIA)
const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`

/**
 * Prazo sugerido: com retorno marcado no Gestão DS, o dia anterior ao retorno (nunca antes de hoje);
 * sem retorno, hoje + o prazo padrão do tipo.
 */
export function sugerirPrazo(p: { hoje: string; proximoAgendamento: string | null; tipo: TipoTarefa; dias: DiasPadrao }): { prazo: string; motivo: string } {
  const { hoje, proximoAgendamento: ag } = p
  if (ag && ag >= hoje) {
    const vespera = somarDias(ag, -1)
    return { prazo: vespera < hoje ? hoje : vespera, motivo: ag === hoje ? 'o retorno é hoje' : `antes do retorno em ${ddmm(ag)}` }
  }
  const n = p.dias[p.tipo]
  return { prazo: somarDias(hoje, n), motivo: `prazo padrão de ${n} ${n === 1 ? 'dia' : 'dias'}` }
}

export type Grupo = 'atrasadas' | 'hoje' | 'semana' | 'depois'
export const GRUPOS: { grupo: Grupo; titulo: string }[] = [
  { grupo: 'atrasadas', titulo: 'Atrasadas' },
  { grupo: 'hoje', titulo: 'Para hoje' },
  { grupo: 'semana', titulo: 'Próximos 7 dias' },
  { grupo: 'depois', titulo: 'Depois' },
]

export function grupoDoPrazo(prazo: string, hoje: string): Grupo {
  const d = diasEntre(hoje, prazo)
  return d < 0 ? 'atrasadas' : d === 0 ? 'hoje' : d <= 7 ? 'semana' : 'depois'
}

export function textoDoPrazo(prazo: string, hoje: string): string {
  const d = diasEntre(hoje, prazo)
  if (d === 0) return 'hoje'
  if (d === 1) return 'amanhã'
  if (d === -1) return 'venceu ontem'
  return d < 0 ? `venceu há ${-d} dias` : `em ${d} dias`
}
