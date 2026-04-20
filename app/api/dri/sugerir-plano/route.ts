import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const bodySchema = z.object({
  patientName: z.string().optional().nullable(),
  ageMonths:   z.number().int().min(0),
  eerKcal:     z.number().positive(),
  ageGroup:    z.string().min(1),
  grupos:      z.array(z.object({
    label:      z.string(),
    porcoes:    z.number(),
    kcalTotal:  z.number(),
    kcalPorcao: z.number(),
  })),
  refeicoes:   z.array(z.object({
    nome:  z.string(),
    pct:   z.number(),
    kcal:  z.number(),
    grupos: z.array(z.string()),
  })),
  observacoes: z.string().optional().nullable(),
})

function ageText(totalMonths: number): string {
  if (totalMonths < 12) return `${totalMonths} meses`
  const years  = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (months === 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`
  return `${years}a ${months}m`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const professional = await prisma.professional.findUnique({ where: { authUserId: user.id } })
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data

  const gruposBlock = d.grupos
    .filter(g => g.porcoes > 0)
    .map(g => `• ${g.label}: ${g.porcoes.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} porção(ões) = ${g.kcalTotal.toFixed(0)} kcal`)
    .join('\n')

  const refeicoesBlock = d.refeicoes
    .map(r => `• ${r.nome} (${r.pct}% / ${r.kcal.toFixed(0)} kcal): ${r.grupos.join(', ')}`)
    .join('\n')

  const userMessage = `Elabore um texto de orientação para plano alimentar pediátrico com base nos dados abaixo:

Paciente: ${d.patientName ?? 'não identificado'} | Idade: ${ageText(d.ageMonths)} | Faixa etária: ${d.ageGroup}
Necessidade Calórica (EER): ${d.eerKcal.toFixed(0)} kcal/dia

DISTRIBUIÇÃO DIÁRIA POR GRUPOS ALIMENTARES:
${gruposBlock}

DISTRIBUIÇÃO POR REFEIÇÃO:
${refeicoesBlock}

OBSERVAÇÕES DO PROFISSIONAL:
${d.observacoes?.trim() || 'Nenhuma observação adicional.'}

Escreva um texto em 3 parágrafos:
1. Apresente o plano com a meta calórica, faixa etária e principais orientações clínicas
2. Descreva os grupos alimentares e distribuição por refeição de forma prática
3. Incorporate as observações do profissional com orientações específicas

Linguagem clínica e acessível ao profissional de saúde. Português. Máximo 8 linhas por parágrafo. Sem subtítulos.`

  const message = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 900,
    system:     'Você é um nutricionista pediátrico especializado auxiliando profissionais de saúde brasileiros. Elabore textos de orientação de plano alimentar em linguagem clínica, objetiva e prática. Português. Sem diagnósticos definitivos.',
    messages:   [{ role: 'user', content: userMessage }],
  })

  const suggestion = message.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')

  return NextResponse.json({ suggestion })
}
