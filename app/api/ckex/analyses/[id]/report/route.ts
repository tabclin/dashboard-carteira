import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { findMatchedRefsForResults } from '@/lib/exam/normalize'
import type { MatchedRef } from '@/lib/exam/normalize'
import { ReportDocument } from '@/lib/pdf/report'
import type { ReportData } from '@/lib/pdf/report'

// Mirrors matchedRefText from result-row.tsx
function matchedRefText(ref: MatchedRef): string {
  const { refMin, refMax, unit } = ref
  const u = unit ? ` ${unit}` : ''
  if (refMin != null && refMax != null) return `${refMin} a ${refMax}${u}`
  if (refMin != null) return `≥ ${refMin}${u}`
  if (refMax != null) return `≤ ${refMax}${u}`
  return '—'
}

type CatalogRefs = {
  refMinMale: { toNumber(): number } | null
  refMaxMale: { toNumber(): number } | null
  refMinFemale: { toNumber(): number } | null
  refMaxFemale: { toNumber(): number } | null
  unit: string | null
}

// Mirrors catalogRefText from result-row.tsx
function catalogRefText(cat: CatalogRefs, isFemale: boolean): string | null {
  let min: number | null
  let max: number | null
  if (isFemale) {
    min = cat.refMinFemale != null ? cat.refMinFemale.toNumber() : (cat.refMinMale != null ? cat.refMinMale.toNumber() : null)
    max = cat.refMaxFemale != null ? cat.refMaxFemale.toNumber() : (cat.refMaxMale != null ? cat.refMaxMale.toNumber() : null)
  } else {
    min = cat.refMinMale != null ? cat.refMinMale.toNumber() : (cat.refMinFemale != null ? cat.refMinFemale.toNumber() : null)
    max = cat.refMaxMale != null ? cat.refMaxMale.toNumber() : (cat.refMaxFemale != null ? cat.refMaxFemale.toNumber() : null)
  }
  const u = cat.unit ? ` ${cat.unit}` : ''
  if (min != null && max != null) return `${min} a ${max}${u}`
  if (min != null) return `≥ ${min}${u}`
  if (max != null) return `≤ ${max}${u}`
  return null
}

function computeRefDisplay(
  matched: MatchedRef | null | undefined,
  catalog: CatalogRefs | null,
  isFemale: boolean,
  refText: string | null,
): string {
  // Priority 1: exam_reference (most specific: unit + sex + age)
  if (matched != null) return matchedRefText(matched)
  // Priority 2: catalog sex-specific refs (user-registered)
  if (catalog) return catalogRefText(catalog, isFemale) ?? '—'
  // Priority 3: raw AI-extracted text from lab PDF
  return refText ?? '—'
}

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
              unit: true,
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
      return {
        examName: r.examName,
        value: r.value,
        unit: r.unit,
        refDisplay: computeRefDisplay(matched, r.catalog, isFemale, (r as any).refText ?? null),
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
