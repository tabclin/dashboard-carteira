// Grava no banco o que veio do Gestão DS (API ou planilha) para um login, numa transação só.
// Pacientes: liga/completa os existentes e cria os novos (nunca apaga nem renomeia).
// Consultas: substitui as do período importado (o período inteiro vem de novo a cada importação).
import 'server-only'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma/client'
import { planejarPacientes, ligarConsultas, type PacienteEntrada, type ConsultaEntrada, type Ambiguo } from './vinculo'

export type ResumoImportacao = {
  pacientesNovos: number
  pacientesCompletados: number
  revisar: Ambiguo[]
  consultas: number
  consultasSemPaciente: number
  periodo: [string, string] | null
}

const dia = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
const data = (s: string) => new Date(s + 'T00:00:00Z')

export async function gravarImportacao(
  professionalId: string,
  origem: 'gestaods' | 'planilha',
  pacientes: PacienteEntrada[],
  consultas: { itens: ConsultaEntrada[]; periodo: [string, string] } | null,
): Promise<ResumoImportacao> {
  const existentes = (await prisma.patient.findMany({
    where: { professionalId },
    select: { id: true, name: true, birthDate: true, gestaodsId: true, cpf: true, phone: true, email: true, cidade: true },
  })).map((p) => ({ ...p, birthDate: dia(p.birthDate) }))

  const plano = planejarPacientes(existentes, pacientes, randomUUID)

  // depois do plano, o cadastro completo (para ligar as consultas)
  const atualizados = new Map(plano.atualizar.map((a) => [a.id, a.dados]))
  const todos = [
    ...existentes.map((p) => ({ ...p, ...atualizados.get(p.id) })),
    ...plano.criar.map((c) => ({ id: c.id, name: c.nome, gestaodsId: c.gestaodsId, cpf: c.cpf })),
  ]
  const ligadas = consultas ? ligarConsultas(todos, consultas.itens) : []

  await prisma.$transaction(async (tx) => {
    for (const a of plano.atualizar) {
      const { birthDate, ...resto } = a.dados
      await tx.patient.update({ where: { id: a.id }, data: { ...resto, ...(birthDate ? { birthDate: data(birthDate) } : {}) } })
    }
    if (plano.criar.length) {
      await tx.patient.createMany({
        data: plano.criar.map((c) => ({
          id: c.id, professionalId, name: c.nome.replace(/\s+/g, ' ').trim(),
          birthDate: c.nascimento ? data(c.nascimento) : null,
          gestaodsId: c.gestaodsId, cpf: c.cpf, phone: c.telefone, email: c.email, cidade: c.cidade,
        })),
      })
    }
    if (consultas) {
      const [ini, fim] = consultas.periodo
      await tx.consulta.deleteMany({ where: { professionalId, data: { gte: data(ini), lte: data(fim) } } })
      const vistos = new Set<number>()
      await tx.consulta.createMany({
        data: ligadas
          .filter((c) => c.gestaodsId == null || (!vistos.has(c.gestaodsId) && vistos.add(c.gestaodsId)))
          .map((c) => ({
            professionalId, patientId: c.patientId, pacienteNome: c.pacienteNome.replace(/\s+/g, ' ').trim(),
            data: data(c.data), tipo: c.tipo, tipoResumido: c.tipoResumido, servico: c.servico,
            gestaodsId: c.gestaodsId, origem,
          })),
      })
    }
  }, { timeout: 120_000, maxWait: 20_000 })

  return {
    pacientesNovos: plano.criar.length,
    pacientesCompletados: plano.atualizar.length,
    revisar: plano.ambiguos,
    consultas: ligadas.length,
    consultasSemPaciente: ligadas.filter((c) => !c.patientId).length,
    periodo: consultas?.periodo ?? null,
  }
}
