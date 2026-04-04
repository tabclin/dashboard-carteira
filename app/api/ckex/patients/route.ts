import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'

function normalizeStr(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

const createSchema = z.object({
  name: z.string().min(2),
  birthDate: z.string().nullable().optional(),
  sex: z.enum(['M', 'F']).nullable().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const professional = await prisma.professional.findUnique({ where: { authUserId: user.id } })
  if (!professional) return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 })

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, birthDate, sex } = parsed.data
  const normalized = normalizeStr(name)

  // Verificar duplicidade
  const existingPatients = await prisma.patient.findMany({
    where: { professionalId: professional.id },
    select: { id: true, name: true },
  })
  const duplicate = existingPatients.find((p) => normalizeStr(p.name) === normalized)
  if (duplicate) {
    return NextResponse.json(
      { error: 'duplicate', existingId: duplicate.id, existingName: duplicate.name },
      { status: 409 }
    )
  }

  // Inserir na tabela nativa do ClinKPI
  const { data: paciente, error: pacienteError } = await supabase
    .from('pacientes')
    .insert({ paciente: name, nascimento: birthDate || null, user_id: user.id, ativo: true })
    .select('id')
    .single()

  if (pacienteError || !paciente) {
    return NextResponse.json({ error: 'Erro ao criar paciente' }, { status: 500 })
  }

  // Upsert na tabela patients (Prisma/CkEx)
  const parsedBirth = birthDate ? new Date(birthDate) : null
  const patient = await prisma.patient.upsert({
    where: { clinikpiId: paciente.id },
    update: { name, sex: sex ?? null },
    create: {
      id: paciente.id,
      professionalId: professional.id,
      name,
      birthDate: parsedBirth && !isNaN(parsedBirth.getTime()) ? parsedBirth : null,
      sex: sex ?? null,
      clinikpiId: paciente.id,
    },
  })

  return NextResponse.json(patient, { status: 201 })
}
