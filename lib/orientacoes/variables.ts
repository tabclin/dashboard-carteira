export type Sexo = 'M' | 'F' | null

export interface VariableContext {
  nome?:          string  // first name only
  nome_completo?: string  // full name
  data?:          string  // formatted date
  sexo?:          Sexo    // sem sexo: as variáveis de gênero ficam neutras ("o/a")
}

/** 'M', 'F', 'masculino', 'feminino' (qualquer caixa) -> 'M' | 'F'; o resto -> null */
export function normalizarSexo(s: string | null | undefined): Sexo {
  const v = s?.trim().toLowerCase()
  if (v === 'm' || v === 'masculino') return 'M'
  if (v === 'f' || v === 'feminino') return 'F'
  return null
}

export function buildContext(patient: { name: string; sex?: string | null } | null, date: Date): VariableContext {
  const nome_completo = patient?.name ?? ''
  const nome          = nome_completo.split(' ')[0] ?? nome_completo
  return {
    nome,
    nome_completo,
    data: date.toLocaleDateString('pt-BR'),
    sexo: normalizarSexo(patient?.sex),
  }
}

// Formas de gênero: [masculino, feminino]. A mais longa vem antes (dele/dela contém ele/ela).
const GENERO: Record<string, [string, string]> = {
  'dele/dela': ['dele', 'dela'],
  'ele/ela':   ['ele', 'ela'],
  'do/da':     ['do', 'da'],
  'o/a':       ['o', 'a'],
}
const FORMAS     = 'dele\\/dela|ele\\/ela|do\\/da|o\\/a'
const VAR_GENERO = new RegExp(`#(${FORMAS})(?!\\p{L})`, 'giu')
const NEUTRA     = new RegExp(`(?<![\\p{L}#])(${FORMAS})(?!\\p{L})`, 'giu')

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Forma do sexo (ou a neutra "o/a"), com inicial maiúscula se foi escrita assim. */
function formaGenero(escrita: string, sexo: Sexo): string {
  const [m, f] = GENERO[escrita.toLowerCase()]
  const cap    = escrita.charAt(0) !== escrita.charAt(0).toLowerCase()
  const ajusta = (s: string) => (cap ? maiuscula(s) : s)
  if (sexo === 'M') return ajusta(m)
  if (sexo === 'F') return ajusta(f)
  return `${ajusta(m)}/${ajusta(f)}`
}

// Replace #nome_completo before #nome to avoid partial replacement
export function applyVariables(text: string, ctx: VariableContext): string {
  const hoje = ctx.data ?? new Date().toLocaleDateString('pt-BR')
  return text
    .replace(/#nome_completo/g, ctx.nome_completo ?? '#nome_completo')
    .replace(/#nome/g,          ctx.nome          ?? '#nome')
    .replace(/#data/g,          hoje)
    .replace(VAR_GENERO, (_, forma: string) => formaGenero(forma, ctx.sexo ?? null))
}

/** Troca no texto já resolvido as formas neutras ("o/a", "Ele/Ela"...) pela do sexo, sem mexer no resto. */
export function trocarNeutras(text: string, sexo: 'M' | 'F'): string {
  return text.replace(NEUTRA, (_, forma: string) => formaGenero(forma, sexo))
}

export const VARIABLES = [
  { key: '#nome',          label: 'Primeiro nome do paciente'  },
  { key: '#nome_completo', label: 'Nome completo do paciente'  },
  { key: '#data',          label: 'Data da orientação'          },
  { key: '#o/a',           label: 'o/a conforme o sexo'         },
  { key: '#ele/ela',       label: 'ele/ela conforme o sexo'     },
  { key: '#do/da',         label: 'do/da conforme o sexo'       },
  { key: '#dele/dela',     label: 'dele/dela conforme o sexo'   },
]
