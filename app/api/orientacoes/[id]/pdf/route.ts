import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { OrientacaoDocument } from '@/lib/pdf/orientacao'
import type { SecaoValor } from '@/lib/orientacoes/types'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const professional = await prisma.professional.findUnique({ where: { authUserId: user.id } })
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orientacao = await prisma.orientacao.findFirst({
    where: { id, professionalId: professional.id },
    include: { patient: { select: { id: true, name: true } } },
  })
  if (!orientacao) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(OrientacaoDocument, {
    professional: {
      name:      professional.name,
      crm:       professional.crm,
      specialty: professional.specialty,
    },
    patientName: orientacao.patientName ?? orientacao.patient?.name ?? null,
    title:       orientacao.title,
    secoes:      orientacao.secoes as unknown as SecaoValor[],
    createdAt:   orientacao.createdAt,
  }) as any)

  const patientSlug = (orientacao.patientName ?? orientacao.patient?.name ?? 'paciente')
    .toLowerCase().replace(/\s+/g, '-')
  const filename = `orientacao-${patientSlug}-${orientacao.createdAt.toISOString().split('T')[0]}.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
