import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'

const patchSchema = z.object({
  grupos:    z.array(z.any()).optional(),
  refeicoes: z.array(z.any()).optional(),
  condutaIa: z.string().optional().nullable(),
  notes:     z.string().optional().nullable(),
  eerKcal:   z.number().positive().optional(),
  ageMonths: z.number().int().min(0).optional(),
  ageGroup:  z.string().optional(),
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
  const existing = await prisma.planoAlimentar.findFirst({
    where: { id, professionalId: professional.id },
  })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  try {
    const updated = await prisma.planoAlimentar.update({
      where: { id },
      data: {
        ...(d.grupos    !== undefined && { grupos:    d.grupos    }),
        ...(d.refeicoes !== undefined && { refeicoes: d.refeicoes }),
        ...(d.condutaIa !== undefined && { condutaIa: d.condutaIa ?? null }),
        ...(d.notes     !== undefined && { notes:     d.notes     ?? null }),
        ...(d.eerKcal   !== undefined && { eerKcal:   d.eerKcal   }),
        ...(d.ageMonths !== undefined && { ageMonths: d.ageMonths }),
        ...(d.ageGroup  !== undefined && { ageGroup:  d.ageGroup  }),
      },
    })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[dri/planos PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar plano', detail: String(err) }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const professional = await getProfessional()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.planoAlimentar.findFirst({
    where: { id, professionalId: professional.id },
  })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await prisma.planoAlimentar.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
