import { FlaskConical, Flame, ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { acaoDaTarefa } from '@/lib/tarefas-regras'

export const VISUAL_TIPO = {
  exames: { icone: FlaskConical, cor: 'bg-blue-50 text-blue-700 ring-blue-200' },
  dri: { icone: Flame, cor: 'bg-orange-50 text-orange-700 ring-orange-200' },
  orientacao: { icone: ScrollText, cor: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
} as Record<string, { icone: typeof FlaskConical; cor: string }>

/** Para onde ir para fazer a tarefa (a ferramenta já com o paciente escolhido). */
export function linkDaTarefa(tipo: string, patientId: string) {
  if (tipo === 'exames') return `/check-exames/analises/nova?patientId=${patientId}&de=paciente`
  if (tipo === 'dri') return `/dri/calculadora?patientId=${patientId}`
  return `/orientacoes?patientId=${patientId}`
}

export function SeloTipo({ tipo }: { tipo: string }) {
  const v = VISUAL_TIPO[tipo] ?? VISUAL_TIPO.exames
  const Icone = v.icone
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 whitespace-nowrap', v.cor)}>
      <Icone className="w-3.5 h-3.5" aria-hidden />{acaoDaTarefa(tipo)}
    </span>
  )
}
