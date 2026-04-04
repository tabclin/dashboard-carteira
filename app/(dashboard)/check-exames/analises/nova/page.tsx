import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { NewAnalysisForm } from '@/components/check-exames/analyses/new-analysis-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function NovaAnalisePage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>
}) {
  const { patientId: preselectedPatientId } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const professional = await prisma.professional.findUnique({
    where: { authUserId: user.id },
  })

  if (!professional) {
    return (
      <div className="p-6 text-center text-sm text-slate-500">
        Configure seu perfil no Check Exames primeiro.
      </div>
    )
  }

  // Busca pacientes direto da tabela nativa do ClinKPI
  const { data: pacientes } = await supabase
    .from('pacientes')
    .select('id, paciente, nascimento')
    .eq('user_id', user.id)
    .eq('ativo', true)
    .order('paciente')

  // Garante que cada paciente existe na tabela `patients` (Prisma/CkEx)
  if (pacientes && pacientes.length > 0) {
    await Promise.all(
      pacientes.map((p) =>
        prisma.patient.upsert({
          where: { clinikpiId: p.id },
          update: { name: p.paciente },
          create: {
            id: p.id,
            professionalId: professional.id,
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

  // Busca a lista final com os IDs da tabela patients
  const patients = await prisma.patient.findMany({
    where: { professionalId: professional.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, sex: true, birthDate: true },
  })

  // Determina de onde o usuário veio para o link de voltar
  const backHref = preselectedPatientId
    ? `/check-exames/pacientes/${preselectedPatientId}`
    : '/check-exames/analises'
  const backLabel = preselectedPatientId ? 'Voltar ao paciente' : 'Voltar às análises'

  return (
    <div className="p-6 max-w-2xl">
      <Link
        href={backHref}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        {backLabel}
      </Link>

      <h2 className="text-base font-semibold text-slate-800 mb-5">Nova análise</h2>

      <NewAnalysisForm patients={patients} preselectedPatientId={preselectedPatientId} />
    </div>
  )
}
