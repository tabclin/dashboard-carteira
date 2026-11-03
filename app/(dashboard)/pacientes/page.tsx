import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { obterProfissional } from '@/lib/profissional'
import { idadeTexto } from '@/lib/idade'
import { TabelaPacientes, type LinhaPaciente } from '@/components/pacientes/tabela-pacientes'
import { BotaoAtualizarGestaoDS } from '@/components/pacientes/botao-atualizar-gestaods'

// o botão "Atualizar do Gestão DS" roda aqui e pode passar de 1 minuto
export const maxDuration = 300

const dia = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)

export default async function PacientesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const prof = await obterProfissional(user)
  if (!prof) return null

  const [pacientes, consultas, integ] = await Promise.all([
    prisma.patient.findMany({
      where: { professionalId: prof.id },
      select: { id: true, name: true, birthDate: true, _count: { select: { analyses: true, driAvaliacoes: true, orientacoes: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.consulta.groupBy({
      by: ['patientId'],
      where: { professionalId: prof.id, patientId: { not: null } },
      _max: { data: true },
    }),
    prisma.integracaoGestaoDS.findUnique({ where: { professionalId: prof.id }, select: { ultimaSincronizacao: true } }),
  ])
  const ultima = new Map(consultas.map((c) => [c.patientId, dia(c._max.data)]))

  const linhas: LinhaPaciente[] = pacientes.map((p) => ({
    id: p.id,
    nome: p.name,
    idade: idadeTexto(p.birthDate),
    ultimaConsulta: ultima.get(p.id) ?? null,
    exames: p._count.analyses,
    dri: p._count.driAvaliacoes,
    orientacoes: p._count.orientacoes,
  }))

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{linhas.length} pacientes</p>
        {integ
          ? <BotaoAtualizarGestaoDS ultima={integ.ultimaSincronizacao?.toISOString() ?? null} />
          : <Link href="/configuracoes" className="text-sm text-brand-600 hover:underline">Ligar ao Gestão DS para trazer pacientes e consultas</Link>}
      </div>
      <TabelaPacientes linhas={linhas} />
    </div>
  )
}
