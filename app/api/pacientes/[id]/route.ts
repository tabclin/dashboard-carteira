import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'

const updateSchema = z.object({
  name:      z.string().min(2).optional(),
  birthDate: z.string().nullable().optional(),
  sex:       z.enum(['M', 'F']).nullable().optional(),
  email:     z.string().email().nullable().optional(),
  phone:     z.string().nullable().optional(),
  notes:     z.string().nullable().optional(),
})

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const professional = await prisma.professional.findUnique({ where: { authUserId: user.id } })
  if (!professional) return null
  return { user, professional, supabase }
}

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.patient.findFirst({
    where: { id, professionalId: auth.professional.id },
  })
  if (!existing) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data

  // Verificar duplicata de nome (se nome foi alterado)
  if (d.name && normalize(d.name) !== normalize(existing.name)) {
    const all = await prisma.patient.findMany({
      where: { professionalId: auth.professional.id, NOT: { id } },
      select: { id: true, name: true },
    })
    const dup = all.find(p => normalize(p.name) === normalize(d.name!))
    if (dup) return NextResponse.json({ error: 'duplicate', existingId: dup.id, existingName: dup.name }, { status: 409 })
  }

  const parsedBirth = d.birthDate !== undefined
    ? (d.birthDate ? new Date(d.birthDate) : null)
    : undefined

  const patient = await prisma.patient.update({
    where: { id },
    data: {
      ...(d.name      !== undefined ? { name:      d.name }                                        : {}),
      ...(parsedBirth !== undefined ? { birthDate: parsedBirth }                                   : {}),
      ...(d.sex       !== undefined ? { sex:       d.sex ?? null }                                : {}),
      ...(d.email     !== undefined ? { email:     d.email ?? null }                              : {}),
      ...(d.phone     !== undefined ? { phone:     d.phone ?? null }                              : {}),
      ...(d.notes     !== undefined ? { notes:     d.notes ?? null }                              : {}),
    },
  })

  // Sincronizar nome e data com Supabase se tiver clinikpiId
  if (existing.clinikpiId && (d.name !== undefined || d.birthDate !== undefined)) {
    await auth.supabase
      .from('pacientes')
      .update({
        ...(d.name      !== undefined ? { paciente:    d.name }          : {}),
        ...(d.birthDate !== undefined ? { nascimento:  d.birthDate ?? null } : {}),
      })
      .eq('id', existing.clinikpiId)
  }

  return NextResponse.json(patient)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.patient.findFirst({
    where: { id, professionalId: auth.professional.id },
    include: { _count: { select: { analyses: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  if (existing._count.analyses > 0) {
    return NextResponse.json(
      { error: 'has_analyses', count: existing._count.analyses },
      { status: 409 }
    )
  }

  await prisma.patient.delete({ where: { id } })

  if (existing.clinikpiId) {
    await auth.supabase
      .from('pacientes')
      .update({ ativo: false })
      .eq('id', existing.clinikpiId)
  }

  return NextResponse.json({ ok: true })
}
