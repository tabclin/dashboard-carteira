import DRICalculator from '@/components/dri/dri-calculator'
import { pacienteDoLogin } from '@/lib/paciente-do-login'

export default async function DRICalculadoraPage({ searchParams }: { searchParams: { patientId?: string } }) {
  // vindo da ficha do paciente: já abre com nome, idade e sexo preenchidos
  const p = await pacienteDoLogin(searchParams.patientId)
  return (
    <div className="flex-1 overflow-y-auto">
      <DRICalculator pacienteInicial={p && { id: p.id, name: p.name, birthDate: p.birthDate?.toISOString().slice(0, 10) ?? null, sex: p.sex }} />
    </div>
  )
}
