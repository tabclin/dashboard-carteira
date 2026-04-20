import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { PlanoAlimentarDocument } from '@/lib/pdf/plano-alimentar'
import type { PlanoAlimentarPdfData } from '@/lib/pdf/plano-alimentar'
import type { GrupoResult } from '@/lib/dri/plano-alimentar'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const professional = await prisma.professional.findUnique({ where: { authUserId: user.id } })
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const plano = await prisma.planoAlimentar.findFirst({
    where: { id, professionalId: professional.id },
    include: { avaliacao: true },
  })
  if (!plano) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const av = plano.avaliacao

  const data: PlanoAlimentarPdfData = {
    professional: {
      name:      professional.name,
      crm:       professional.crm,
      specialty: professional.specialty,
    },
    patient: {
      name:      plano.patientName,
      ageMonths: plano.ageMonths,
      ageGroup:  plano.ageGroup,
    },
    avaliacao: {
      data:          av?.data        ?? plano.createdAt,
      eerMasc:       av?.eerMasc     != null ? Number(av.eerMasc)  : null,
      eerFem:        av?.eerFem      != null ? Number(av.eerFem)   : null,
      weightKg:      av?.weightKg    != null ? Number(av.weightKg) : 0,
      heightCm:      av?.heightCm    != null ? Number(av.heightCm) : 0,
      activityLevel: av?.activityLevel ?? '',
    },
    plano: {
      eerKcal:   Number(plano.eerKcal),
      totalKcal: (plano.grupos as unknown as GrupoResult[]).reduce((s, g) => s + g.kcalTotal, 0),
      grupos:    plano.grupos as unknown as GrupoResult[],
      refeicoes: plano.refeicoes as unknown as PlanoAlimentarPdfData['plano']['refeicoes'],
      condutaIa: plano.condutaIa,
      notes:     plano.notes,
      createdAt: plano.createdAt,
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(PlanoAlimentarDocument, { data }) as any)

  const patientSlug = (plano.patientName ?? 'paciente').toLowerCase().replace(/\s+/g, '-')
  const filename    = `plano-alimentar-${patientSlug}-${plano.createdAt.toISOString().split('T')[0]}.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
