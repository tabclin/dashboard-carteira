'use server'

import { revalidatePath } from 'next/cache'
import { usuarioAtual } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { obterProfissional } from '@/lib/profissional'
import { cifrar } from '@/lib/gestaods/chave'
import { testarChave, ErroGestaoDS } from '@/lib/gestaods/api'
import { sincronizarGestaoDS } from '@/lib/gestaods/sincronizar'
import { gravarImportacao, type ResumoImportacao } from '@/lib/gestaods/importar'
import { lerPlanilha } from '@/lib/gestaods/planilha'
import { corValida } from '@/lib/pdf/aparencia'

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string }

/** Sempre o profissional do login atual: uma conta nunca mexe na chave ou nos dados de outra. */
async function profissionalAtual() {
  const user = await usuarioAtual()
  if (!user) throw new Error('Sessão expirada. Entre de novo.')
  const p = await obterProfissional(user)
  if (!p) throw new Error('Perfil não encontrado.')
  return p
}

function atualizarTelas() {
  revalidatePath('/configuracoes')
  revalidatePath('/pacientes', 'layout')
}

export async function salvarChaveGestaoDS(token: string): Promise<Resultado<{ final: string }>> {
  const prof = await profissionalAtual()
  const t = token.trim()
  if (t.length < 10) return { ok: false, erro: 'Cole a chave completa do Gestão DS.' }
  let medicos: { id: number }[]
  try {
    medicos = await testarChave(t)
  } catch (e) {
    return { ok: false, erro: e instanceof ErroGestaoDS ? e.message : 'Não consegui falar com o Gestão DS agora. Tente de novo em instantes.' }
  }
  const dados = { tokenCifrado: cifrar(t), tokenFinal: t.slice(-4), medicoId: medicos.length === 1 ? medicos[0].id : null, ultimoStatus: null, ultimoErro: null }
  await prisma.integracaoGestaoDS.upsert({ where: { professionalId: prof.id }, create: { professionalId: prof.id, ...dados }, update: dados })
  atualizarTelas()
  return { ok: true, final: dados.tokenFinal }
}

export async function removerChaveGestaoDS(): Promise<Resultado> {
  const prof = await profissionalAtual()
  await prisma.integracaoGestaoDS.deleteMany({ where: { professionalId: prof.id } })
  atualizarTelas()
  return { ok: true }
}

export async function atualizarPeloGestaoDS(): Promise<Resultado<{ resumo: ResumoImportacao }>> {
  const prof = await profissionalAtual()
  const r = await sincronizarGestaoDS(prof.id)
  atualizarTelas()
  return r.ok ? { ok: true, resumo: r.resumo } : r
}

export async function importarPlanilhas(form: FormData): Promise<Resultado<{ arquivos: { arquivo: string; tipo: string; resumo: ResumoImportacao }[] }>> {
  const prof = await profissionalAtual()
  const arquivos = form.getAll('arquivos').filter((f): f is File => f instanceof File && f.size > 0)
  if (!arquivos.length) return { ok: false, erro: 'Escolha ao menos uma planilha.' }
  try {
    const lidas = await Promise.all(arquivos.map(async (f) => lerPlanilha(await f.text(), f.name)))
    // cadastro antes dos atendimentos, para as consultas já acharem os pacientes
    lidas.sort((a, b) => (a.tipo === 'pacientes' ? 0 : 1) - (b.tipo === 'pacientes' ? 0 : 1))
    const feitos = []
    for (const l of lidas) {
      const resumo = await gravarImportacao(prof.id, 'planilha', l.pacientes, l.tipo === 'atendimentos' ? { itens: l.consultas, periodo: l.periodo } : null)
      feitos.push({ arquivo: l.arquivo, tipo: l.tipo, resumo })
    }
    atualizarTelas()
    return { ok: true, arquivos: feitos }
  } catch (e) {
    return { ok: false, erro: (e as Error).message }
  }
}

export interface DadosAparenciaPdf { cor: string; nome: string; crm: string; rqe: string; especialidade: string; logo: string | null }

const LOGO_MAX = 1_400_000 // ~1 MB de imagem em base64

/** Aparência do PDF das orientações do login atual (campo vazio = usa o cadastro). */
export async function salvarAparenciaPdf(d: DadosAparenciaPdf): Promise<Resultado> {
  const prof = await profissionalAtual()
  if (!corValida(d.cor)) return { ok: false, erro: 'Escolha uma cor válida.' }
  if (!d.nome.trim()) return { ok: false, erro: 'Preencha o nome que aparece no PDF.' }
  if (d.logo && !/^data:image\/(png|jpeg);base64,/.test(d.logo)) return { ok: false, erro: 'A logo precisa ser PNG ou JPG.' }
  if (d.logo && d.logo.length > LOGO_MAX) return { ok: false, erro: 'A logo pode ter até 1 MB.' }
  const vazio = (s: string) => s.trim() || null
  const dados = { cor: d.cor.toLowerCase(), nome: d.nome.trim(), crm: vazio(d.crm), rqe: vazio(d.rqe), especialidade: vazio(d.especialidade), logo: d.logo || null }
  await prisma.aparenciaPdf.upsert({ where: { professionalId: prof.id }, create: { professionalId: prof.id, ...dados }, update: dados })
  revalidatePath('/configuracoes')
  return { ok: true }
}
