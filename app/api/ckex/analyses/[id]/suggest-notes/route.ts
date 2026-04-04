import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const STATUS_LABEL: Record<string, string> = {
  NORMAL: 'normal',
  ATTENTION: 'atenção',
  DANGER: 'risco',
  NOT_EVALUATED: 'não avaliado',
}

function calcAge(birthDate: Date | null): string {
  if (!birthDate) return 'idade desconhecida'
  const months = Math.floor(
    (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  )
  if (months < 24) return `${months} meses`
  return `${Math.floor(months / 12)} anos`
}

function sexLabel(sex: string | null): string {
  if (sex === 'M') return 'masculino'
  if (sex === 'F') return 'feminino'
  return 'sexo não informado'
}

function refRangeText(refMin: number | null, refMax: number | null): string {
  if (refMin != null && refMax != null) return `${refMin}–${refMax}`
  if (refMin != null) return `≥ ${refMin}`
  if (refMax != null) return `≤ ${refMax}`
  return 'sem referência'
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const professional = await prisma.professional.findUnique({ where: { authUserId: user.id } })
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const analysis = await prisma.analysis.findFirst({
    where: { id, professionalId: professional.id },
    include: {
      patient: { select: { name: true, sex: true, birthDate: true } },
      results: {
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
        select: {
          examName: true,
          value: true,
          unit: true,
          status: true,
          refMin: true,
          refMax: true,
          category: true,
          professionalNote: true,
        },
      },
    },
  })

  if (!analysis) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  const grouped = new Map<string, typeof analysis.results>()
  for (const r of analysis.results) {
    const cat = r.category ?? 'Outros'
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(r)
  }

  const resultsBlock = Array.from(grouped.entries())
    .map(([cat, items]) => {
      const lines = items.map((r) => {
        const ref = refRangeText(
          r.refMin != null ? Number(r.refMin) : null,
          r.refMax != null ? Number(r.refMax) : null,
        )
        const note = r.professionalNote ? ` [nota: ${r.professionalNote}]` : ''
        return `  - ${r.examName}: ${r.value ?? '—'} ${r.unit ?? ''} (ref: ${ref}) — ${STATUS_LABEL[r.status] ?? r.status}${note}`
      })
      return `${cat}\n${lines.join('\n')}`
    })
    .join('\n\n')

  const collectedAt = analysis.collectedAt.toLocaleDateString('pt-BR')
  const labName = analysis.labName ?? 'laboratório não informado'
  const patientAge = calcAge(analysis.patient.birthDate)
  const patientSex = sexLabel(analysis.patient.sex)

  const userMessage = `Escreva uma observação clínica resumida para o seguinte laudo laboratorial:

Paciente: ${analysis.patient.name}, ${patientSex}, ${patientAge}
Coleta: ${collectedAt} · Lab: ${labName}

Resultados:
${resultsBlock || 'Nenhum resultado disponível.'}

Inclua: principais achados alterados, padrão geral dos exames normais, e sugestão de acompanhamento se aplicável. Máximo 5 linhas.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system:
      'Você é um assistente clínico ajudando profissionais de saúde brasileiros a escrever observações clínicas concisas em português. Seja objetivo, técnico e neutro. Não faça diagnósticos definitivos.',
    messages: [{ role: 'user', content: userMessage }],
  })

  const suggestion = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')

  return NextResponse.json({ suggestion })
}
