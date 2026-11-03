// Tarefas no servidor: preferências, conclusão automática e contagem para o menu.
import 'server-only'
import { prisma } from '@/lib/prisma/client'
import { DIAS_PADRAO, type DiasPadrao, type TipoTarefa } from './tarefas-regras'

/** Hoje em São Paulo, "AAAA-MM-DD". */
export const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
export const dataDoBanco = (s: string) => new Date(s + 'T00:00:00Z')

export async function diasPadrao(professionalId: string): Promise<DiasPadrao> {
  const p = await prisma.preferenciasTarefas.findUnique({ where: { professionalId } })
  return p ? { exames: p.diasExames, dri: p.diasDri, orientacao: p.diasOrientacao } : DIAS_PADRAO
}

/** A ferramenta foi usada para o paciente: as tarefas pendentes desse tipo viram feitas. */
export async function concluirTarefas(professionalId: string, patientId: string | null | undefined, tipo: TipoTarefa) {
  if (!patientId) return
  await prisma.tarefa.updateMany({
    where: { professionalId, patientId, tipo, status: 'pendente' },
    data: { status: 'feita', concluidaEm: new Date(), concluidaComo: 'automatico' },
  })
}

/** Quantas tarefas estão atrasadas ou vencem hoje (número no menu). */
export async function tarefasUrgentes(professionalId: string) {
  return prisma.tarefa.count({ where: { professionalId, status: 'pendente', prazo: { lte: dataDoBanco(hojeSP()) } } })
}
