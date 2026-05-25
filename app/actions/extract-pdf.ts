'use server'

import { parsePdfText } from '@/lib/pdf/parser'
import { extractWithClaude, extractWithClaudePDF } from '@/lib/ai/extract'
import { normalizeBatch } from '@/lib/exam/normalize'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import type { ExtractedResult } from '@/lib/pdf/parser'

export interface ExtractPdfResult {
  results: ExtractedResult[]
  rawText: string
  usedAI: boolean
  error?: string
}

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

export async function extractPdfAction(formData: FormData): Promise<ExtractPdfResult> {
  try {
    const file = formData.get('file') as File | null
    if (!file) return { results: [], rawText: '', usedAI: false, error: 'Nenhum arquivo enviado' }
    if (file.type !== 'application/pdf') return { results: [], rawText: '', usedAI: false, error: 'Apenas arquivos PDF são aceitos' }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // pdfjs can hang indefinitely in serverless — cap at 5s then fall through to Claude
    let text = ''
    try {
      text = await Promise.race([
        extractTextFromPdf(buffer),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('pdfjs timeout')), 5000)
        ),
      ])
    } catch {
      // falls through to Claude PDF vision
    }

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
        console.error('[extractPdfAction] Claude falhou:', aiErr)
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
      console.warn('[extractPdfAction] Normalização falhou:', normErr)
    }

    return { results, rawText: text.slice(0, 1500), usedAI }
  } catch (err) {
    console.error('[extractPdfAction]', err)
    return { results: [], rawText: '', usedAI: false, error: 'Erro ao processar PDF. Tente novamente.' }
  }
}
