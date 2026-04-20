import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import Anthropic from '@anthropic-ai/sdk'
import type { SecaoValor } from '@/lib/orientacoes/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const professional = await prisma.professional.findUnique({ where: { authUserId: user.id } })
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { title, secoes, patientName } = await req.json() as {
    title: string
    secoes: SecaoValor[]
    patientName?: string
  }

  if (!secoes?.length) return NextResponse.json({ error: 'Seções obrigatórias' }, { status: 400 })

  const longSections = secoes.filter(s => s.tipo === 'texto_longo' && s.valor.trim())
  if (!longSections.length) return NextResponse.json({ error: 'Nenhuma seção de texto longo para melhorar' }, { status: 400 })

  const patientCtx = patientName ? `\nPaciente: ${patientName}` : ''

  // Use delimiter format instead of JSON-with-HTML to avoid encoding issues
  const sectionsBlock = longSections
    .map(s => `===INICIO:${s.id}===\n${s.valor}\n===FIM:${s.id}===`)
    .join('\n\n')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: 'Você é um assistente clínico especializado em revisão de textos médicos em português brasileiro. Corrija sempre os erros e melhore o texto conforme solicitado.',
    messages: [
      {
        role: 'user',
        content: `Revise e reescreva cada seção abaixo aplicando TODAS as melhorias necessárias:
• Corrija TODOS os erros de ortografia, gramática e pontuação (ex: "flour" → "flúor", "consultas" → "consulta", etc.)
• Melhore a clareza, coesão e fluidez do texto
• Use linguagem clínica clara, empática e objetiva
• Preserve as tags HTML exatamente como estão (<p>, <ul>, <li>, <strong>, etc.)
• Reescreva o conteúdo de texto dentro das tags — nunca retorne o conteúdo original sem nenhuma correção

Título: ${title}${patientCtx}

Retorne cada seção com os MESMOS delimitadores, sem nenhum texto extra antes ou depois:

${sectionsBlock}`,
      },
    ],
  })

  try {
    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse delimiter-based response
    const improvedMap: Record<string, string> = {}
    const regex = /===INICIO:([a-z0-9]+)===\n([\s\S]*?)\n===FIM:\1===/g
    let match
    while ((match = regex.exec(raw)) !== null) {
      improvedMap[match[1]] = match[2].trim()
    }

    if (Object.keys(improvedMap).length === 0) {
      console.error('[/api/orientacoes/melhorar] no sections parsed from response:', raw.slice(0, 500))
      return NextResponse.json({ error: 'Erro ao processar resposta da IA' }, { status: 500 })
    }

    const improved: SecaoValor[] = secoes.map(s => {
      const improvedValor = improvedMap[s.id]
      return improvedValor ? { ...s, valor: improvedValor } : s
    })

    return NextResponse.json({ secoes: improved })
  } catch (err) {
    console.error('[/api/orientacoes/melhorar] error:', err)
    return NextResponse.json({ error: 'Erro ao processar resposta da IA' }, { status: 500 })
  }
}
