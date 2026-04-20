export interface VariableContext {
  nome?:          string  // first name only
  nome_completo?: string  // full name
  data?:          string  // formatted date
}

export function buildContext(patient: { name: string } | null, date: Date): VariableContext {
  const nome_completo = patient?.name ?? ''
  const nome          = nome_completo.split(' ')[0] ?? nome_completo
  return {
    nome,
    nome_completo,
    data: date.toLocaleDateString('pt-BR'),
  }
}

// Replace #nome_completo before #nome to avoid partial replacement
export function applyVariables(text: string, ctx: VariableContext): string {
  const hoje = ctx.data ?? new Date().toLocaleDateString('pt-BR')
  return text
    .replace(/#nome_completo/g, ctx.nome_completo ?? '#nome_completo')
    .replace(/#nome/g,          ctx.nome          ?? '#nome')
    .replace(/#data/g,          hoje)
}

export const VARIABLES = [
  { key: '#nome',          label: 'Primeiro nome do paciente'  },
  { key: '#nome_completo', label: 'Nome completo do paciente'  },
  { key: '#data',          label: 'Data da orientação'          },
]
