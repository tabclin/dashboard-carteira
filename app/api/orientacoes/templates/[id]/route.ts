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

const secaoSchema = z.object({
  id:     z.string(),
  titulo: z.string(),
  tipo:   z.enum(['texto_curto', 'texto_longo', 'selecao_unica', 'imagem']),
  valor:  z.string(),
  opcoes: z.array(z.string()).optional(),
})

const patchSchema = z.object({
  title:  z.string().min(1).optional(),
  secoes: z.array(secaoSchema).optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const prof = await getProf()
  if (!prof) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const existing = await prisma.orientacaoTemplate.findFirst({ where: { id, professionalId: prof.id } })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updated = await prisma.orientacaoTemplate.update({ where: { id }, data: parsed.data })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const prof = await getProf()
  if (!prof) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const existing = await prisma.orientacaoTemplate.findFirst({ where: { id, professionalId: prof.id } })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await prisma.orientacaoTemplate.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
