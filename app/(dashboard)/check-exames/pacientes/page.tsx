import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { obterProfissional } from '@/lib/profissional'
import type { $Enums } from '@prisma/client'
type AnalysisStatus = $Enums.AnalysisStatus
import { PacientesList } from '@/components/check-exames/pacientes/pacientes-list'

export default async function PacientesCheckPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const professional = await obterProfissional(user)
  if (!professional) return (
    <div className="p-6 text-center text-sm text-slate-500">
      Erro ao configurar perfil. Recarregue a página.
    </div>
  )

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
      <PacientesList patients={patientItems} />
    </div>
  )
}
