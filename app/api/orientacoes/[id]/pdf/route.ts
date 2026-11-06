import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { usuarioAtual } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { OrientacaoDocument } from '@/lib/pdf/orientacao'
import { aparenciaComPadrao } from '@/lib/pdf/aparencia'
import { dataBR, idadeTexto } from '@/lib/idade'
import type { SecaoValor } from '@/lib/orientacoes/types'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const user = await usuarioAtual()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const professional = await prisma.professional.findUnique({ where: { authUserId: user.id }, include: { aparenciaPdf: true } })
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orientacao = await prisma.orientacao.findFirst({
    where: { id, professionalId: professional.id },
    include: { patient: { select: { id: true, name: true, birthDate: true } } },
  })
  if (!orientacao) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  // idade na data da orientação (a data é um dia, sem fuso); sem data, no dia em que foi criada
  const nomePaciente = orientacao.patientName ?? orientacao.patient?.name ?? null
  const dia = orientacao.orientacaoDate
    ? dataBR(orientacao.orientacaoDate)!
    : orientacao.createdAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const [d, m, a] = dia.split('/').map(Number)
  const idade = idadeTexto(orientacao.patient?.birthDate ?? null, new Date(a, m - 1, d, 12))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(OrientacaoDocument, {
    aparencia: aparenciaComPadrao(professional.aparenciaPdf, professional),
    paciente:  nomePaciente ? { nome: nomePaciente, idade } : null,
    title:     orientacao.title,
    secoes:    orientacao.secoes as unknown as SecaoValor[],
    data:      dia,
  }) as any)

  const patientSlug = (nomePaciente ?? 'paciente')
    .toLowerCase().replace(/\s+/g, '-')
  const filename = `orientacao-${patientSlug}-${orientacao.createdAt.toISOString().split('T')[0]}.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
