import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'

async function getProf() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.professional.findUnique({ where: { authUserId: user.id } })
}

const patchSchema = z.object({
  title:  z.string().min(1).optional(),
  secoes: z.array(z.object({
    id:     z.string(),
    titulo: z.string(),
    tipo:   z.enum(['texto_curto', 'texto_longo', 'selecao_unica', 'imagem']),
    valor:  z.string(),
    opcoes: z.array(z.string()).optional(),
  })).optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const prof = await getProf()
  if (!prof) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orientacao = await prisma.orientacao.findFirst({
    where: { id, professionalId: prof.id },
    include: { patient: { select: { id: true, name: true } } },
  })
  if (!orientacao) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json(orientacao)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const prof = await getProf()
  if (!prof) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const existing = await prisma.orientacao.findFirst({ where: { id, professionalId: prof.id } })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updated = await prisma.orientacao.update({
    where: { id },
    data: parsed.data,
    include: { patient: { select: { id: true, name: true } } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const prof = await getProf()
  if (!prof) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const existing = await prisma.orientacao.findFirst({ where: { id, professionalId: prof.id } })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await prisma.orientacao.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
