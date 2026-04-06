import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { $Enums } from '@prisma/client'
type AnalysisStatus = $Enums.AnalysisStatus
import { PacientesList } from '@/components/check-exames/pacientes/pacientes-list'

export default async function PacientesCheckPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  let professional = await prisma.professional.findUnique({
    where: { authUserId: user.id },
  })

  if (!professional) {
    try {
      const org = await prisma.organization.upsert({
        where: { id: `org_${user.id}` },
        update: {},
        create: { id: `org_${user.id}`, name: user.email ?? 'Organização' },
      })
      professional = await prisma.professional.create({
        data: {
          orgId: org.id,
          authUserId: user.id,
          name: user.email?.split('@')[0] ?? 'Profissional',
          email: user.email ?? '',
        },
      })
    } catch {
      professional = await prisma.professional.findUnique({ where: { authUserId: user.id } })
    }
    if (!professional) return (
      <div className="p-6 text-center text-sm text-slate-500">
        Erro ao configurar perfil. Recarregue a página.
      </div>
    )
  }

  // Sincroniza pacientes da tabela nativa do ClinKPI
  const { data: pacientes } = await supabase
    .from('pacientes')
    .select('id, paciente, nascimento')
    .eq('user_id', user.id)
    .eq('ativo', true)
    .order('paciente')

  if (pacientes && pacientes.length > 0) {
    const professionalId = professional.id
    await Promise.all(
      pacientes.map((p) =>
        prisma.patient.upsert({
          where: { clinikpiId: p.id },
          update: { name: p.paciente },
          create: {
            id: p.id,
            professionalId,
            name: p.paciente,
            birthDate: (() => {
              if (!p.nascimento) return null
              const d = new Date(p.nascimento)
              return isNaN(d.getTime()) ? null : d
            })(),
            clinikpiId: p.id,
          },
        })
      )
    )
  }

  const patients = await prisma.patient.findMany({
    where: {
      professionalId: professional.id,
      analyses: { some: {} },
    },
    orderBy: { name: 'asc' },
    include: {
      analyses: {
        select: { status: true },
        orderBy: { collectedAt: 'desc' },
      },
    },
  })

  const patientItems = patients.map((p) => ({
    id: p.id,
    name: p.name,
    analysisCount: p.analyses.length,
    statuses: p.analyses.map((a) => a.status as AnalysisStatus),
  }))

  return (
    <div className="p-6">
      <div className="flex items-center justify-end mb-5">
        <Link
          href="/check-exames/analises/nova"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova análise
        </Link>
      </div>

      <PacientesList patients={patientItems} />
    </div>
  )
}
