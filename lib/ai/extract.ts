import Anthropic from '@anthropic-ai/sdk'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import { slugify } from '@/lib/utils'
import type { ExtractedResult } from '@/lib/pdf/parser'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Haiku 4.5 tem 200K de contexto — PDFs grandes ficam dentro do limite
const CHUNK_SIZE = 40_000   // chars por chunk
const MAX_TOKENS = 8192     // suficiente para ~100 exames em JSON

const SYSTEM_PROMPT = `Você é um especialista em laudos laboratoriais brasileiros.
Extraia TODOS os exames do texto fornecido e retorne um JSON array.

Cada item deve ter exatamente estes campos:
- examName: string (nome do exame, em português, sem abreviações desnecessárias)
- category: string (uma destas: Hemograma, Glicemia, Lipídios, Tireoide, Renal, Hepático, Ferro / Anemia, Vitaminas, Inflamação, Eletrólitos, Hormônios, Muscular, Coagulação, Urina, Outros)
- value: string (valor numérico como string, ex: "14,2" ou "5.6")
- valueNumeric: number | null (valor como número, ex: 14.2)
- unit: string (unidade de medida, ex: "g/dL", "mg/dL", "%")
- refMin: number | null (mínimo do valor de referência, null se não houver)
- refMax: number | null (máximo do valor de referência, null se não houver)
- refText: string (referência original como texto, ex: "12,0 - 16,0" ou "< 200")

Regras:
- Ignore metadados (nome do paciente, médico, data, convênio, etc.)
- Ignore resultados não numéricos (ex: "Negativo", "Ausente")
- Para referências do tipo "< 200", use refMin: null, refMax: 200
- Para referências do tipo "> 40", use refMin: 40, refMax: null
- Para referências do tipo "12,0 - 16,0", use refMin: 12, refMax: 16
- Use vírgula como separador decimal nos valores brasileiros, convertendo para número
- Retorne APENAS o JSON array, sem markdown, sem explicações`

async function extractChunk(chunk: string): Promise<ExtractedResult[]> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Extraia os exames deste laudo laboratorial:\n\n${chunk}`,
      },
    ],
  })

  const text = message.content.find((b) => b.type === 'text')?.text ?? ''

  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  const raw = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>

  return raw
    .filter((item) => item.examName && item.value)
    .map((item) => ({
      examName: String(item.examName ?? ''),
      examSlug: slugify(String(item.examName ?? '')),
      category: String(item.category ?? 'Outros'),
      value: String(item.value ?? ''),
      valueNumeric: typeof item.valueNumeric === 'number' ? item.valueNumeric : null,
      unit: String(item.unit ?? ''),
      refMin: typeof item.refMin === 'number' ? item.refMin : null,
      refMax: typeof item.refMax === 'number' ? item.refMax : null,
      refText: String(item.refText ?? ''),
    }))
}

/**
 * Envia o PDF diretamente ao Claude como documento (vision).
 * Usado quando pdfjs-dist não consegue extrair texto (fonte especial, codificação proprietária).
 */
export async function extractWithClaudePDF(pdfBuffer: Buffer): Promise<ExtractedResult[]> {
  const base64 = pdfBuffer.toString('base64')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',   // Sonnet suporta leitura nativa de PDF
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          } as ContentBlockParam,
          {
            type: 'text',
            text: `${SYSTEM_PROMPT}\n\nExtraia TODOS os exames deste laudo laboratorial. Retorne apenas o JSON array.`,
          } as ContentBlockParam,
        ],
      },
    ],
  })

  const text = message.content.find((b) => b.type === 'text')?.text ?? ''
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  const raw = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>
  return raw
    .filter((item) => item.examName && item.value)
    .map((item) => ({
      examName: String(item.examName ?? ''),
      examSlug: slugify(String(item.examName ?? '')),
      category: String(item.category ?? 'Outros'),
      value: String(item.value ?? ''),
      valueNumeric: typeof item.valueNumeric === 'number' ? item.valueNumeric : null,
      unit: String(item.unit ?? ''),
      refMin: typeof item.refMin === 'number' ? item.refMin : null,
      refMax: typeof item.refMax === 'number' ? item.refMax : null,
      refText: String(item.refText ?? ''),
    }))
}

export async function extractWithClaude(rawText: string): Promise<ExtractedResult[]> {
  // Divide em chunks se o texto for maior que CHUNK_SIZE
  const chunks: string[] = []
  for (let i = 0; i < rawText.length; i += CHUNK_SIZE) {
    chunks.push(rawText.slice(i, i + CHUNK_SIZE))
  }

  // Processa todos os chunks em paralelo
  const chunkResults = await Promise.all(chunks.map(extractChunk))

  // Mescla resultados, removendo duplicatas pelo examSlug
  const seen = new Set<string>()
  const merged: ExtractedResult[] = []

  for (const results of chunkResults) {
    for (const result of results) {
      if (!seen.has(result.examSlug)) {
        seen.add(result.examSlug)
        merged.push(result)
      }
    }
  }

  return merged.sort((a, b) => a.category.localeCompare(b.category))
}
