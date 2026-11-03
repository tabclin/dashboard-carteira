import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { obterProfissional } from '@/lib/profissional'

/** Paciente pelo id, só se for do login atual (para abrir uma ferramenta já com o paciente escolhido). */
export async function pacienteDoLogin(id: string | undefined) {
  if (!id) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const prof = await obterProfissional(user)
  if (!prof) return null
  return prisma.patient.findFirst({
    where: { id, professionalId: prof.id },
    select: { id: true, name: true, birthDate: true, sex: true },
  })
}
