import { prisma } from '@/lib/prisma/client'

/** Perfil do profissional do login; na primeira entrada cria a organização e o perfil. */
export async function obterProfissional(user: { id: string; email?: string | null }) {
  const existente = await prisma.professional.findUnique({ where: { authUserId: user.id } })
  if (existente) return existente
  try {
    const org = await prisma.organization.upsert({
      where: { id: `org_${user.id}` },
      update: {},
      create: { id: `org_${user.id}`, name: user.email ?? 'Organização' },
    })
    return await prisma.professional.create({
      data: {
        orgId: org.id,
        authUserId: user.id,
        name: user.email?.split('@')[0] ?? 'Profissional',
        email: user.email ?? '',
      },
    })
  } catch {
    // duas abas abrindo ao mesmo tempo: a outra já criou
    return prisma.professional.findUnique({ where: { authUserId: user.id } })
  }
}
