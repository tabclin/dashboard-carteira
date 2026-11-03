import { usuarioAtual } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { NewAnalysisForm } from '@/components/check-exames/analyses/new-analysis-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// a leitura do PDF (extractPdfAction, com IA) roda nesta página e pode passar dos 10s padrão
export const maxDuration = 60

export default async function NovaAnalisePage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; de?: string }>
}) {
  const { patientId: preselectedPatientId, de } = await searchParams

  const user = await usuarioAtual()
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

  const patients = await prisma.patient.findMany({
    where: { professionalId: professional.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, sex: true, birthDate: true },
  })

  // Determina de onde o usuário veio para o link de voltar
  const backHref = preselectedPatientId
    ? (de === 'paciente' ? `/pacientes/${preselectedPatientId}` : `/check-exames/pacientes/${preselectedPatientId}`)
    : '/check-exames/pacientes'
  const backLabel = de === 'paciente' ? 'Voltar à ficha do paciente' : preselectedPatientId ? 'Voltar ao paciente' : 'Voltar aos pacientes'

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
