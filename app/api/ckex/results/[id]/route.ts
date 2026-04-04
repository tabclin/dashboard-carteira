import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'
import { slugify } from '@/lib/utils'

const updateSchema = z.object({
  examName: z.string().optional(),
  value: z.string().optional().nullable(),
  valueNumeric: z.number().optional().nullable(),
  unit: z.string().optional().nullable(),
  refMin: z.number().optional().nullable(),
  refMax: z.number().optional().nullable(),
  refText: z.string().optional().nullable(),
  status: z.enum(['NOT_EVALUATED', 'NORMAL', 'ATTENTION', 'DANGER']).optional(),
  professionalNote: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  catalogId: z.string().optional().nullable(),
})

async function getProfessional() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.professional.findUnique({ where: { authUserId: user.id } })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const professional = await getProfessional()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const result = await prisma.result.findFirst({
    where: { id },
    include: { analysis: { select: { professionalId: true } } },
  })
  if (!result || result.analysis.professionalId !== professional.id) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const { examName, ...rest } = parsed.data

  const updated = await prisma.result.update({
    where: { id },
    data: {
      ...rest,
      ...(examName ? { examName, examSlug: slugify(examName) } : {}),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const professional = await getProfessional()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const result = await prisma.result.findFirst({
    where: { id },
    include: { analysis: { select: { professionalId: true } } },
  })
  if (!result || result.analysis.professionalId !== professional.id) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  }

  await prisma.result.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
