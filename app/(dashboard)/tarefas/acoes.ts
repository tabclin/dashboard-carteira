'use server'

import { revalidatePath } from 'next/cache'
import { usuarioAtual } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { obterProfissional } from '@/lib/profissional'
import { hojeSP, dataDoBanco, diasPadrao } from '@/lib/tarefas'
import { sugerirPrazo, TIPOS_TAREFA, type TipoTarefa } from '@/lib/tarefas-regras'

type Resultado = { ok: true } | { ok: false; erro: string }
const TIPOS = TIPOS_TAREFA.map((t) => t.tipo)
const DIA = /^\d{4}-\d{2}-\d{2}$/

async function profissionalAtual() {
  const user = await usuarioAtual()
  if (!user) throw new Error('Sessão expirada. Entre de novo.')
  const p = await obterProfissional(user)
  if (!p) throw new Error('Perfil não encontrado.')
  return p
}

/** Tarefa só se for do login atual. */
async function tarefaDoLogin(id: string) {
  const prof = await profissionalAtual()
  const t = await prisma.tarefa.findFirst({ where: { id, professionalId: prof.id }, select: { id: true, patientId: true } })
  if (!t) throw new Error('Tarefa não encontrada.')
  return t
}

function atualizarTelas(patientId?: string) {
  revalidatePath('/tarefas')
  revalidatePath('/', 'layout') // número no menu
  if (patientId) revalidatePath(`/pacientes/${patientId}`)
}

/** Prazo sugerido para cada tipo de tarefa desse paciente. */
export async function sugerirPrazos(patientId: string) {
  const prof = await profissionalAtual()
  const p = await prisma.patient.findFirst({ where: { id: patientId, professionalId: prof.id }, select: { proximoAgendamento: true } })
  if (!p) return null
  const dias = await diasPadrao(prof.id)
  const hoje = hojeSP(), ag = p.proximoAgendamento?.toISOString().slice(0, 10) ?? null
  return Object.fromEntries(TIPOS.map((tipo) => [tipo, sugerirPrazo({ hoje, proximoAgendamento: ag, tipo, dias })])) as Record<TipoTarefa, { prazo: string; motivo: string }>
}

export async function criarTarefa(d: { patientId: string; tipos: string[]; prazos: Record<string, string>; observacao?: string }): Promise<Resultado> {
  const prof = await profissionalAtual()
  const paciente = await prisma.patient.findFirst({ where: { id: d.patientId, professionalId: prof.id }, select: { id: true } })
  if (!paciente) return { ok: false, erro: 'Paciente não encontrado.' }
  const tipos = d.tipos.filter((t): t is TipoTarefa => (TIPOS as string[]).includes(t))
  if (!tipos.length) return { ok: false, erro: 'Escolha ao menos um tipo de tarefa.' }
  if (tipos.some((t) => !DIA.test(d.prazos[t] ?? ''))) return { ok: false, erro: 'Informe o prazo.' }
  await prisma.tarefa.createMany({
    data: tipos.map((tipo) => ({
      professionalId: prof.id, patientId: paciente.id, tipo, prazo: dataDoBanco(d.prazos[tipo]),
      observacao: d.observacao?.trim() || null,
    })),
  })
  atualizarTelas(paciente.id)
  return { ok: true }
}

export async function concluirTarefa(id: string): Promise<Resultado> {
  const t = await tarefaDoLogin(id)
  await prisma.tarefa.update({ where: { id }, data: { status: 'feita', concluidaEm: new Date(), concluidaComo: 'manual' } })
  atualizarTelas(t.patientId)
  return { ok: true }
}

export async function reabrirTarefa(id: string): Promise<Resultado> {
  const t = await tarefaDoLogin(id)
  await prisma.tarefa.update({ where: { id }, data: { status: 'pendente', concluidaEm: null, concluidaComo: null } })
  atualizarTelas(t.patientId)
  return { ok: true }
}

export async function mudarPrazo(id: string, prazo: string): Promise<Resultado> {
  if (!DIA.test(prazo)) return { ok: false, erro: 'Data inválida.' }
  const t = await tarefaDoLogin(id)
  await prisma.tarefa.update({ where: { id }, data: { prazo: dataDoBanco(prazo) } })
  atualizarTelas(t.patientId)
  return { ok: true }
}

export async function excluirTarefa(id: string): Promise<Resultado> {
  const t = await tarefaDoLogin(id)
  await prisma.tarefa.update({ where: { id }, data: { status: 'cancelada' } })
  atualizarTelas(t.patientId)
  return { ok: true }
}

export async function salvarDiasPadrao(d: { exames: number; dri: number; orientacao: number }): Promise<Resultado> {
  const prof = await profissionalAtual()
  const ok = (n: number) => Number.isInteger(n) && n >= 0 && n <= 90
  if (![d.exames, d.dri, d.orientacao].every(ok)) return { ok: false, erro: 'Use de 0 a 90 dias.' }
  const dados = { diasExames: d.exames, diasDri: d.dri, diasOrientacao: d.orientacao }
  await prisma.preferenciasTarefas.upsert({ where: { professionalId: prof.id }, create: { professionalId: prof.id, ...dados }, update: dados })
  revalidatePath('/configuracoes')
  return { ok: true }
}
