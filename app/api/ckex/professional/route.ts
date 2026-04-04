import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'

const updateProfessionalSchema = z.object({
  name: z.string().min(2),
  crm: z.string().optional().nullable(),
  specialty: z.string().optional().nullable(),
})

// GET /api/ckex/professional — retorna o profissional logado (ou null)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(null)

  const professional = await prisma.professional.findUnique({ where: { authUserId: user.id } })
  return NextResponse.json(professional)
}

// POST /api/ckex/professional — cria profissional + organização no onboarding
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Verifica se já existe
  const existing = await prisma.professional.findUnique({ where: { authUserId: user.id } })
  if (existing) return NextResponse.json(existing)

  const body = await request.json()

  const org = await prisma.organization.create({
    data: {
      id: `org_${user.id}`,
      name: body.name ?? user.email ?? 'Organização',
    },
  })

  const professional = await prisma.professional.create({
    data: {
      orgId: org.id,
      authUserId: user.id,
      name: body.name ?? '',
      email: user.email ?? '',
      crm: body.crm ?? null,
      specialty: body.specialty ?? null,
    },
  })

  return NextResponse.json(professional, { status: 201 })
}

// PATCH /api/ckex/professional — atualiza perfil do profissional logado
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const professional = await prisma.professional.findUnique({ where: { authUserId: user.id } })
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const result = updateProfessionalSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
  }

  const { name, crm, specialty } = result.data

  const updated = await prisma.professional.update({
    where: { id: professional.id },
    data: {
      name,
      crm: crm || null,
      specialty: specialty || null,
    },
  })

  return NextResponse.json(updated)
}
