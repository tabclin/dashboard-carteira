// Atualização pelo Gestão DS de um login, usando a chave daquele login.
import 'server-only'
import { prisma } from '@/lib/prisma/client'
import { decifrar } from './chave'
import { buscarAtendimentos, buscarPacientes, ErroGestaoDS, type AtendimentoAPI } from './api'
import { gravarImportacao, type ResumoImportacao } from './importar'
import { dataISO, type PacienteEntrada } from './vinculo'

// Na primeira vez busca o histórico; depois, só os últimos meses (o período é substituído inteiro)
const MESES_PRIMEIRA_VEZ = 60
const MESES_DEPOIS = 6

const texto = (v: unknown) => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim()
  return s === '' || s === '-' ? null : s
}
const hojeSP = () => new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()) + 'T00:00:00Z')
const iso = (d: Date) => d.toISOString().slice(0, 10)

export type ResultadoSinc = { ok: true; resumo: ResumoImportacao & { segundos: number } } | { ok: false; erro: string }

export async function sincronizarGestaoDS(professionalId: string): Promise<ResultadoSinc> {
  const integracao = await prisma.integracaoGestaoDS.findUnique({ where: { professionalId } })
  if (!integracao) return { ok: false, erro: 'Gestão DS não configurado para este login.' }
  const inicio = Date.now()
  try {
    const token = decifrar(integracao.tokenCifrado)
    const hoje = hojeSP()
    const ini = new Date(hoje); ini.setUTCMonth(ini.getUTCMonth() - (integracao.ultimaSincronizacao ? MESES_DEPOIS : MESES_PRIMEIRA_VEZ))

    const [atendimentos, pac] = await Promise.all([buscarAtendimentos(token, ini, hoje), buscarPacientes(token, hoje.getUTCFullYear())])

    // CPF e cidade vêm do atendimento mais recente de cada paciente; nascimento, dos aniversariantes
    const nascimento = new Map(pac.aniversariantes.map((p) => [p.paciente_id, dataISO(p.nascimento)]))
    const doAtendimento = new Map<number, NonNullable<AtendimentoAPI['paciente']>>()
    for (const a of [...atendimentos].sort((x, y) => (dataISO(x.data_atendimento) ?? '').localeCompare(dataISO(y.data_atendimento) ?? ''))) {
      if (a.paciente?.id) doAtendimento.set(a.paciente.id, a.paciente)
    }
    const pacientes: PacienteEntrada[] = []
    for (const p of pac.atividade) {
      const nome = texto(p.nome_paciente); if (!nome) continue
      const at = doAtendimento.get(p.id)
      pacientes.push({
        gestaodsId: p.id, nome, nascimento: nascimento.get(p.id) ?? null, cpf: texto(at?.cpf),
        telefone: texto(p.celular) ?? texto(at?.celular), email: texto(p.email), cidade: texto(at?.cidade),
      })
    }
    // paciente que aparece nos atendimentos mas não no relatório de atividade
    for (const [id, p] of Array.from(doAtendimento)) {
      if (!pacientes.some((x) => x.gestaodsId === id) && texto(p.nome)) {
        pacientes.push({ gestaodsId: id, nome: texto(p.nome)!, nascimento: nascimento.get(id) ?? null, cpf: texto(p.cpf), telefone: texto(p.celular), email: null, cidade: texto(p.cidade) })
      }
    }
    const itens = atendimentos.flatMap((a) => {
      const d = dataISO(a.data_atendimento), nome = texto(a.paciente?.nome)
      return d && nome ? [{ gestaodsId: a.id ?? null, pacienteGestaodsId: a.paciente?.id ?? null, pacienteCpf: texto(a.paciente?.cpf), pacienteNome: nome, data: d, tipo: texto(a.tipo), servico: texto(a.servico) }] : []
    })

    const resumo = { ...(await gravarImportacao(professionalId, 'gestaods', pacientes, { itens, periodo: [iso(ini), iso(hoje)] })), segundos: Math.round((Date.now() - inicio) / 100) / 10 }
    await prisma.integracaoGestaoDS.update({
      where: { professionalId },
      data: { ultimaSincronizacao: new Date(), ultimoStatus: 'ok', ultimoErro: null, ultimoResumo: resumo },
    })
    return { ok: true, resumo }
  } catch (e) {
    const erro = e instanceof ErroGestaoDS ? e.message : `Falha ao atualizar: ${(e as Error).message}`
    await prisma.integracaoGestaoDS.update({ where: { professionalId }, data: { ultimoStatus: 'erro', ultimoErro: erro } })
    return { ok: false, erro }
  }
}
