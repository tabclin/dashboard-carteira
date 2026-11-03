import { prisma } from '@/lib/prisma/client'
import { profissionalDoLogin } from '@/lib/profissional'

/** Paciente pelo id, só se for do login atual (para abrir uma ferramenta já com o paciente escolhido). */
export async function pacienteDoLogin(id: string | undefined) {
  if (!id) return null
  const prof = await profissionalDoLogin()
  if (!prof) return null
  return prisma.patient.findFirst({
    where: { id, professionalId: prof.id },
    select: { id: true, name: true, birthDate: true, sex: true },
  })
}
