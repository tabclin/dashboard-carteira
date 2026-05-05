import { NextResponse } from 'next/server'
import { parsePdfText } from '@/lib/pdf/parser'
import { extractWithClaude, extractWithClaudePDF } from '@/lib/ai/extract'
import { normalizeBatch } from '@/lib/exam/normalize'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

export const runtime = 'nodejs'
export const maxDuration = 60

async function getProfessionalId(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const professional = await prisma.professional.findUnique({ where: { authUserId: user.id } })
    return professional?.id ?? null
  } catch {
    return null
  }
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // Disable web worker — mandatory for Node.js/serverless environments (Vercel)
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
  const pdf = await loadingTask.promise

  const textParts: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    textParts.push(pageText)
  }

  return textParts.join('\n')
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Apenas arquivos PDF são aceitos' }, { status: 400 })
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande (máximo 20MB)' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const text = await extractTextFromPdf(buffer)

    const hasAI = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your-anthropic-api-key-here')
    const textIsEmpty = text.trim().length < 200

    let results = parsePdfText(text)
    let usedAI = false

    if (hasAI) {
      try {
        const aiResults = textIsEmpty
          ? await extractWithClaudePDF(buffer)
          : await extractWithClaude(text)

        if (aiResults.length > results.length) {
          results = aiResults
          usedAI = true
        }
      } catch (aiErr) {
        console.error('[PDF Extract] Claude failed, usando parser determinístico:', aiErr)
      }
    }

    const patientSex = formData.get('patientSex') as string | null
    const patientBirthDateRaw = formData.get('patientBirthDate') as string | null
    const patientBirthDate = patientBirthDateRaw ? new Date(patientBirthDateRaw) : null
    const professionalId = await getProfessionalId()
    try {
      if (!professionalId) throw new Error('Profissional não autenticado')
      const nameMap = await normalizeBatch(
        results.map((r) => ({ name: r.examName, unit: r.unit ?? undefined })),
        professionalId,
        patientSex,
        patientBirthDate,
      )
      results = results.map((r) => {
        const match = nameMap.get(r.examName)
        if (!match) return r
        return {
          ...r,
          extractedName: r.examName,
          catalogId: match.id,
          examName: match.displayName,
          examSlug: match.slug,
          category: r.category || match.category || r.category,
          unit: r.unit || match.unit || r.unit,
          matchedRef: match.matchedRef ?? null,
        }
      })
    } catch (normErr) {
      console.warn('[PDF Extract] Normalização falhou:', normErr)
    }

    return NextResponse.json({ results, rawText: text.slice(0, 1500), usedAI })
  } catch (err) {
    console.error('[PDF Extract]', err)
    return NextResponse.json(
      { error: 'Erro ao processar PDF. Tente novamente.' },
      { status: 500 }
    )
  }
}
