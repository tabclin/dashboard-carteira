import { OrientacoesPage } from '@/components/orientacoes/orientacoes-page'
import { pacienteDoLogin } from '@/lib/paciente-do-login'

export const metadata = { title: 'Orientações | ClinKPI' }

export default async function Page({ searchParams }: { searchParams: { patientId?: string } }) {
  // vindo da ficha do paciente: já abre com ele escolhido
  const p = await pacienteDoLogin(searchParams.patientId)
  return <OrientacoesPage pacienteInicial={p && { id: p.id, name: p.name, sex: p.sex }} />
}
