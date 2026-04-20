import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'

const createSchema = z.object({
  name:      z.string().min(2),
  birthDate: z.string().nullable().optional(),
  sex:       z.enum(['M', 'F']).nullable().optional(),
  email:     z.string().email().nullable().optional(),
  phone:     z.string().nullable().optional(),
  notes:     z.string().nullable().optional(),
})

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const professional = await prisma.professional.findUnique({ where: { authUserId: user.id } })
  if (!professional) return null
  return { user, professional, supabase }
}

export async function GET(request: Request) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''

  const patients = await prisma.patient.findMany({
    where: {
      professionalId: auth.professional.id,
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    },
    select: {
      id: true, name: true, birthDate: true, sex: true,
      email: true, phone: true, notes: true, clinikpiId: true, createdAt: true,
      _count: { select: { analyses: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(patients)
}

export async function POST(request: Request) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, birthDate, sex, email, phone, notes } = parsed.data

  // Verificar duplicata
  const all = await prisma.patient.findMany({
    where: { professionalId: auth.professional.id },
    select: { id: true, name: true },
  })
  const dup = all.find(p => normalize(p.name) === normalize(name))
  if (dup) return NextResponse.json({ error: 'duplicate', existingId: dup.id, existingName: dup.name }, { status: 409 })

  // Criar no Supabase (ClinKPI nativo)
  const { data: paciente, error: sbErr } = await auth.supabase
    .from('pacientes')
    .insert({ paciente: name, nascimento: birthDate || null, user_id: auth.user.id, ativo: true })
    .select('id')
    .single()

  if (sbErr || !paciente) {
    console.error('[pacientes POST] Supabase:', sbErr)
    return NextResponse.json({ error: 'Erro ao criar paciente' }, { status: 500 })
  }

  const parsedBirth = birthDate ? new Date(birthDate) : null
  const patient = await prisma.patient.upsert({
    where: { clinikpiId: paciente.id },
    update: { name, sex: sex ?? null, email: email ?? null, phone: phone ?? null, notes: notes ?? null },
    create: {
      id:             paciente.id,
      professionalId: auth.professional.id,
      name,
      birthDate:      parsedBirth && !isNaN(parsedBirth.getTime()) ? parsedBirth : null,
      sex:            sex    ?? null,
      email:          email  ?? null,
      phone:          phone  ?? null,
      notes:          notes  ?? null,
      clinikpiId:     paciente.id,
    },
  })

  return NextResponse.json(patient, { status: 201 })
}
