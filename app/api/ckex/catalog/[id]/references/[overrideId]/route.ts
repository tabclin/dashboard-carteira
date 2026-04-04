import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.professional.findUnique({ where: { authUserId: user.id } })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; overrideId: string }> },
) {
  const professional = await requireAuth()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { overrideId } = await params

  const override = await prisma.examReferenceOverride.findFirst({
    where: { id: overrideId, professionalId: professional.id },
  })
  if (!override) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const parentRefId = override.examReferenceId
  await prisma.examReferenceOverride.delete({ where: { id: overrideId } })

  const examRef = await prisma.examReference.findUnique({
    where: { id: parentRefId },
    include: { overrides: { select: { id: true } } },
  })
  if (examRef && examRef.refMin === null && examRef.refMax === null && examRef.overrides.length === 0) {
    await prisma.examReference.delete({ where: { id: parentRefId } })
  }

  return NextResponse.json({ ok: true })
}
