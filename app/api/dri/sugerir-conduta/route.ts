import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const bodySchema = z.object({
  patientName:   z.string().optional().nullable(),
  ageMonths:     z.number().int().min(0),
  weightKg:      z.number().positive(),
  heightCm:      z.number().positive(),
  sexInput:      z.enum(['M', 'F', 'both']),
  activityLevel: z.string().min(1),
  eerMasc:       z.number().nullable().optional(),
  eerFem:        z.number().nullable().optional(),
  kcalPerKgMasc: z.number().nullable().optional(),
  kcalPerKgFem:  z.number().nullable().optional(),
  intakeKcal:    z.number().nullable().optional(),
  ageCategory:   z.string().min(1),
  notes:         z.string().optional().nullable(),
})

function sexLabel(sex: string): string {
  if (sex === 'M') return 'masculino'
  if (sex === 'F') return 'feminino'
  return 'masculino e feminino'
}

function activityLabel(level: string): string {
  const map: Record<string, string> = {
    sedentary:   'Sedentário',
    low_active:  'Pouco ativo',
    active:      'Ativo',
    very_active: 'Muito ativo',
  }
  return map[level] ?? level
}

function ageText(totalMonths: number): string {
  if (totalMonths < 12) return `${totalMonths} meses`
  const years  = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (months === 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`
  return `${years} ${years === 1 ? 'ano' : 'anos'} e ${months} ${months === 1 ? 'mês' : 'meses'}`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const professional = await prisma.professional.findUnique({ where: { authUserId: user.id } })
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data

  const eerBlock = [
    d.eerMasc != null ? `EER masculino: ${d.eerMasc.toFixed(1)} kcal/dia (${d.kcalPerKgMasc?.toFixed(2) ?? '—'} kcal/kg/dia)` : null,
    d.eerFem  != null ? `EER feminino: ${d.eerFem.toFixed(1)} kcal/dia (${d.kcalPerKgFem?.toFixed(2) ?? '—'} kcal/kg/dia)` : null,
  ].filter(Boolean).join('\n')

  const adequacyBlock = d.intakeKcal != null && (d.eerMasc != null || d.eerFem != null)
    ? (() => {
        const ref = d.eerMasc ?? d.eerFem!
        const pct = (d.intakeKcal / ref * 100).toFixed(1)
        const gap = (ref - d.intakeKcal).toFixed(0)
        return `Ingestão estimada atual: ${d.intakeKcal.toFixed(0)} kcal/dia (${pct}% do EER — faltam ${gap} kcal/dia)`
      })()
    : null

  const userMessage = `Escreva uma conduta nutricional clínica resumida para o seguinte caso pediátrico:

Paciente: ${d.patientName ?? 'não informado'}
Idade: ${ageText(d.ageMonths)} | Sexo: ${sexLabel(d.sexInput)} | Faixa etária DRI: ${d.ageCategory}
Peso: ${d.weightKg} kg | Estatura: ${d.heightCm} cm | Nível de atividade: ${activityLabel(d.activityLevel)}

${eerBlock}
${adequacyBlock ? adequacyBlock + '\n' : ''}${d.notes ? `Observações: ${d.notes}\n` : ''}
Inclua: interpretação do EER em relação ao peso/faixa etária${d.intakeKcal != null ? ', avaliação da adequação alimentar' : ''}, e sugestões de conduta nutricional. Máximo 5 linhas. Linguagem técnica, em português, sem diagnósticos definitivos.`

  const message = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system:
      'Você é um assistente clínico especializado em nutrição pediátrica, auxiliando profissionais de saúde brasileiros a escrever condutas nutricionais clínicas concisas em português. Seja objetivo, técnico e neutro. Não faça diagnósticos definitivos. Use terminologia clínica adequada.',
    messages: [{ role: 'user', content: userMessage }],
  })

  const suggestion = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')

  return NextResponse.json({ suggestion })
}
