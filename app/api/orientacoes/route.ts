import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'
import { concluirTarefas } from '@/lib/tarefas'

const secaoValorSchema = z.object({
  id:     z.string(),
  titulo: z.string(),
  tipo:   z.enum(['texto_curto', 'texto_longo', 'selecao_unica', 'imagem']),
  valor:  z.string(),
  opcoes: z.array(z.string()).optional(),
})

const saveSchema = z.object({
  patientId:       z.string().optional().nullable(),
  patientName:     z.string().optional().nullable(),
  templateId:      z.string().optional().nullable(),
  title:           z.string().min(1),
  secoes:          z.array(secaoValorSchema),
  orientacaoDate:  z.string().optional().nullable(),
})

async function getProf() {
  const user = await usuarioAtual()
  if (!user) return null
  return prisma.professional.findUnique({ where: { authUserId: user.id } })
}

export async function GET(req: Request) {
  const prof = await getProf()
  if (!prof) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')

  const orientacoes = await prisma.orientacao.findMany({
    where: {
      professionalId: prof.id,
      ...(patientId ? { patientId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { patient: { select: { id: true, name: true, sex: true } } },
  })

  return NextResponse.json(orientacoes)
}

export async function POST(req: Request) {
  const prof = await getProf()
  if (!prof) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { patientId: pedido, patientName, templateId, title, secoes, orientacaoDate } = parsed.data
  // só liga a um paciente do próprio login
  const patientId = pedido
    ? (await prisma.patient.findFirst({ where: { id: pedido, professionalId: prof.id }, select: { id: true } }))?.id ?? null
    : null

  const orientacao = await prisma.orientacao.create({
    data: {
      professionalId: prof.id,
      patientId,
      patientName:    patientName   ?? null,
      templateId:     templateId    ?? null,
      title,
      secoes,
      orientacaoDate: orientacaoDate ? new Date(orientacaoDate) : new Date(),
    },
    include: { patient: { select: { id: true, name: true, sex: true } } },
  })
  await concluirTarefas(prof.id, patientId, 'orientacao')

  return NextResponse.json(orientacao, { status: 201 })
}
