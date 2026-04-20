import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'

const secaoSchema = z.object({
  id:     z.string(),
  titulo: z.string(),
  tipo:   z.enum(['texto_curto', 'texto_longo', 'selecao_unica', 'imagem']),
  valor:  z.string(),
  opcoes: z.array(z.string()).optional(),
})

const saveSchema = z.object({
  title:  z.string().min(1),
  secoes: z.array(secaoSchema),
})

async function getProf() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.professional.findUnique({ where: { authUserId: user.id } })
}

export async function GET() {
  const prof = await getProf()
  if (!prof) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const templates = await prisma.orientacaoTemplate.findMany({
      where: { professionalId: prof.id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(templates)
  } catch (err) {
    console.error('[GET /api/orientacoes/templates]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const prof = await getProf()
  if (!prof) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const template = await prisma.orientacaoTemplate.create({
      data: {
        professionalId: prof.id,
        title:          parsed.data.title,
        secoes:         parsed.data.secoes,
      },
    })
    return NextResponse.json(template, { status: 201 })
  } catch (err) {
    console.error('[POST /api/orientacoes/templates]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
