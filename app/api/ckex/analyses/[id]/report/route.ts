import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { findMatchedRefsForResults } from '@/lib/exam/normalize'
import { ReportDocument } from '@/lib/pdf/report'
import type { ReportData } from '@/lib/pdf/report'

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

  const analysis = await prisma.analysis.findFirst({
    where: { id, professionalId: professional.id },
    include: {
      patient: true,
      results: {
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
        include: {
          catalog: {
            select: {
              description: true,
              refMinMale: true, refMaxMale: true,
              refMinFemale: true, refMaxFemale: true,
            },
          },
        },
      },
    },
  })
  if (!analysis) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const refMap = await findMatchedRefsForResults(
    analysis.results.map((r) => ({ examSlug: r.examSlug, unit: r.unit })),
    analysis.patient.sex,
    analysis.patient.birthDate,
    professional.id,
  )

  const patientSex = analysis.patient.sex
  const isFemale = patientSex === 'F' || patientSex?.toLowerCase() === 'feminino' || patientSex?.toLowerCase() === 'female'

  const reportData: ReportData = {
    professional: {
      name: professional.name,
      crm: professional.crm,
      specialty: professional.specialty,
    },
    patient: {
      name: analysis.patient.name,
      sex: patientSex,
      birthDate: analysis.patient.birthDate,
    },
    analysis: {
      collectedAt: analysis.collectedAt,
      labName: analysis.labName,
      notes: analysis.notes,
      showDescription: (analysis as any).showDescription ?? true,
    },
    results: analysis.results.map((r) => {
      const matched = refMap.get(`${r.examSlug}::${r.unit ?? ''}`)

      // Fallback to catalog sex-specific refs (same logic as screen)
      let catalogRefMin: number | null = null
      let catalogRefMax: number | null = null
      if (r.catalog) {
        const c = r.catalog
        if (isFemale) {
          catalogRefMin = c.refMinFemale != null ? Number(c.refMinFemale) : (c.refMinMale != null ? Number(c.refMinMale) : null)
          catalogRefMax = c.refMaxFemale != null ? Number(c.refMaxFemale) : (c.refMaxMale != null ? Number(c.refMaxMale) : null)
        } else {
          catalogRefMin = c.refMinMale != null ? Number(c.refMinMale) : (c.refMinFemale != null ? Number(c.refMinFemale) : null)
          catalogRefMax = c.refMaxMale != null ? Number(c.refMaxMale) : (c.refMaxFemale != null ? Number(c.refMaxFemale) : null)
        }
      }

      return {
        examName: r.examName,
        value: r.value,
        unit: r.unit,
        refMin: matched?.refMin ?? catalogRefMin ?? (r.refMin != null ? Number(r.refMin) : null),
        refMax: matched?.refMax ?? catalogRefMax ?? (r.refMax != null ? Number(r.refMax) : null),
        status: r.status,
        professionalNote: r.professionalNote,
        description: r.catalog?.description ?? null,
        category: r.category,
      }
    }),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(ReportDocument, { data: reportData }) as any)

  const patientSlug = analysis.patient.name.toLowerCase().replace(/\s+/g, '-')
  const filename = `relatorio-${patientSlug}-${analysis.collectedAt.toISOString().split('T')[0]}.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
