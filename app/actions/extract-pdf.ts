'use server'

import { parsePdfText } from '@/lib/pdf/parser'
import { extractWithClaude, extractWithClaudePDF } from '@/lib/ai/extract'
import { normalizeBatch } from '@/lib/exam/normalize'
import { usuarioAtual } from '@/lib/supabase/server'
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
    const user = await usuarioAtual()
    if (!user) return null
    const professional = await prisma.professional.findUnique({ where: { authUserId: user.id } })
    return professional?.id ?? null
  } catch {
    return null
  }
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // No servidor não há Web Worker: com o worker carregado em globalThis.pdfjsWorker o pdfjs roda na mesma thread.
  // (com workerSrc = '' ele falhava sempre e todo PDF ia direto para a IA por imagem)
  const g = globalThis as { pdfjsWorker?: unknown }
  if (!g.pdfjsWorker) g.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
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

function motivoSemExames(hasAI: boolean, aiError: unknown): string {
  const fim = ' Nenhuma análise foi criada.'
  if (!hasAI) return 'A leitura por IA não está configurada e o leitor automático não encontrou exames neste PDF.' + fim
  if (aiError) {
    const msg = aiError instanceof Error ? aiError.message : String(aiError)
    if (/credit balance/i.test(msg)) return 'Os créditos da IA que lê os exames acabaram. Avise o suporte da TabClin para recarregar.' + fim
    return 'A IA não conseguiu ler este PDF agora. Tente de novo em alguns minutos.' + fim
  }
  return 'Nenhum exame foi encontrado neste PDF.' + fim
}

export async function extractPdfAction(formData: FormData): Promise<ExtractPdfResult> {
  try {
    const signedUrl = formData.get('signedUrl') as string | null
    const file = formData.get('file') as File | null

    let buffer: Buffer

    if (signedUrl) {
      const response = await fetch(signedUrl)
      if (!response.ok) throw new Error(`Erro ao baixar PDF do storage: ${response.status}`)
      buffer = Buffer.from(await response.arrayBuffer())
    } else {
      if (!file) return { results: [], rawText: '', usedAI: false, error: 'Nenhum arquivo enviado' }
      if (file.type !== 'application/pdf') return { results: [], rawText: '', usedAI: false, error: 'Apenas arquivos PDF são aceitos' }
      buffer = Buffer.from(await file.arrayBuffer())
    }

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
    let aiError: unknown = null

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
        aiError = aiErr
      }
    }

    // Sem nenhum exame não há o que salvar: avisa o motivo em vez de criar uma análise vazia
    if (results.length === 0) {
      return { results: [], rawText: text.slice(0, 1500), usedAI: false, error: motivoSemExames(hasAI, aiError) }
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
