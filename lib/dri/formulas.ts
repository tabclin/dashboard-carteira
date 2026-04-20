// DRI 2023 (NASEM) — Estimated Energy Requirements (EER)
// Fórmula: EER = C1 + C2 × Idade(anos) + C3 × Estatura(cm) + C4 × Peso(kg) + C5

export type Sex           = 'M' | 'F'
export type SexSelection  = 'M' | 'F' | 'both'
export type ActivityLevel = 'sedentary' | 'low_active' | 'active' | 'very_active'

interface Coeff { c1: number; c2: number; c3: number; c4: number; c5: number }

// ─── Coeficientes DRI 2023 (fonte: planilha NASEM 2023) ───────────────────────
const C = {
  '0_3m': {
    M: { c1: -716.45, c2:  -1,    c3: 17.82, c4: 15.06, c5: 200 },
    F: { c1:  -69.15, c2:  80,    c3:  2.65, c4: 56.15, c5: 180 },
  },
  '3_6m': {
    M: { c1: -716.45, c2:  -1,    c3: 17.82, c4: 15.06, c5:  50 },
    F: { c1:  -69.15, c2:  80,    c3:  2.65, c4: 54.15, c5:  60 },
  },
  '6m_3y': {
    M: { c1: -716.45, c2:  -1,    c3: 17.82, c4: 15.06, c5:  20 },  // fixo
    F: { c1:  -69.15, c2:  80,    c3:  2.65, c4: 54.15, c5:   1 },  // variável
  },
  '3_14y': {
    M: {
      sedentary:   { c1: -447.51, c2: 3.68, c3: 13.01, c4: 13.15, c5: 1 },  // variável
      low_active:  { c1:   19.12, c2: 3.68, c3:  8.62, c4: 20.28, c5: 1 },
      active:      { c1: -388.19, c2: 3.68, c3: 12.66, c4: 20.46, c5: 1 },
      very_active: { c1: -671.75, c2: 3.68, c3: 15.38, c4: 23.25, c5: 1 },
    },
    F: {
      sedentary:   { c1:   55.59, c2: 22.25, c3:  8.43, c4: 17.07, c5: 1 },  // variável
      low_active:  { c1: -297.54, c2: 22.25, c3: 12.77, c4: 14.73, c5: 1 },
      active:      { c1: -189.55, c2: 22.25, c3: 11.74, c4: 18.34, c5: 1 },
      very_active: { c1: -709.59, c2: 22.25, c3: 18.22, c4: 14.25, c5: 1 },
    },
  },
  '14_19y': {
    M: {
      sedentary:   { c1: -447.51, c2: 3.68, c3: 13.01, c4: 13.15, c5: 20 },  // fixo
      low_active:  { c1:   19.12, c2: 3.68, c3:  8.62, c4: 20.28, c5: 20 },
      active:      { c1: -388.19, c2: 3.68, c3: 12.66, c4: 20.46, c5: 20 },
      very_active: { c1: -671.75, c2: 3.68, c3: 15.38, c4: 23.25, c5: 20 },
    },
    F: {
      sedentary:   { c1:   55.59, c2: 22.25, c3:  8.43, c4: 17.07, c5: 20 },
      low_active:  { c1: -297.54, c2: 22.25, c3: 12.77, c4: 14.73, c5: 20 },
      active:      { c1: -189.55, c2: 22.25, c3: 11.74, c4: 18.34, c5: 20 },
      very_active: { c1: -709.59, c2: 22.25, c3: 18.22, c4: 14.25, c5: 20 },
    },
  },
} as const

// ─── Fator de Crescimento (C5): fixo vs variável ──────────────────────────────
// Variável: 6m-3y Fem e 3-14y (ambos sexos)
// Fixo: 0-6m todos, 6m-3y Masc, 14-19y todos
export function isGFVariable(sex: Sex, totalMonths: number): boolean {
  if (totalMonths < 6) return false                          // 0-6m: sempre fixo
  if (sex === 'M' && totalMonths < 36) return false          // 6m-3y Masc: fixo (C5=20)
  if (totalMonths / 12 >= 14) return false                   // 14-19y: fixo (C5=20)
  return true                                                // 6m-3y Fem e 3-14y todos
}

// Valor sugerido conforme tabela de referência DRI 2023
export function suggestGF(sex: Sex, ageYears: number, ageMonths: number): number {
  const totalMonths = ageYears * 12 + ageMonths
  if (!isGFVariable(sex, totalMonths)) return 0  // não aplicável
  if (sex === 'M') {
    if (ageYears <= 3) return 20
    if (ageYears <= 8) return 15
    return 25  // 9-13 anos
  } else {
    if (ageYears < 9) return 15  // inclui 6m-3y Fem
    return 30  // 9-13 anos
  }
}

// ─── Tabelas de referência para exibição ─────────────────────────────────────
export const GROWTH_FACTOR_TABLE = {
  girls: [
    { range: '6m a <9 anos',  kcal: 15 },
    { range: '9 a 13 anos',   kcal: 30 },
  ],
  boys: [
    { range: '3 anos',        kcal: 20 },
    { range: '4 a 8 anos',    kcal: 15 },
    { range: '9 a 13 anos',   kcal: 25 },
  ],
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary:   'Sedentário',
  low_active:  'Pouco Ativo',
  active:      'Ativo',
  very_active: 'Muito Ativo',
}

export const ACTIVITY_DESCRIPTIONS: Record<ActivityLevel, string> = {
  sedentary:   'Atividades do cotidiano',
  low_active:  'Atividade leve 30–60 min/dia',
  active:      'Atividade moderada ≥60 min/dia',
  very_active: 'Atividade intensa ≥60 min/dia',
}

// ─── Tipos públicos ───────────────────────────────────────────────────────────
export interface EERInput {
  sex:            SexSelection
  ageYears:       number
  ageMonths:      number
  weightKg:       number
  heightCm:       number
  activityLevel:  ActivityLevel
  growthFactorM?: number  // override C5 quando variável (Masc)
  growthFactorF?: number  // override C5 quando variável (Fem)
}

export interface EERResult {
  sex:           Sex
  ageCategory:   string
  kcal:          number
  kcalPerKg:     number
  formulaDetail: string
  usedC5:        number   // C5 efetivo utilizado no cálculo
  gfVariable:    boolean  // indica se C5 foi inputado pelo usuário
}

// ─── Auxiliares ───────────────────────────────────────────────────────────────
function r2(n: number) { return Math.round(n * 100)    / 100 }
function r5(n: number) { return Math.round(n * 100000) / 100000 }

function fmtN(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildDetail(coeff: Coeff, effectiveC5: number, age: number, height: number, weight: number): string {
  const s = (v: number) => v < 0 ? `(${fmtN(v)})` : fmtN(v)
  return `${s(coeff.c1)} + ${s(coeff.c2)} × ${fmtN(age)} + ${s(coeff.c3)} × ${fmtN(height)} + ${s(coeff.c4)} × ${fmtN(weight)} + ${fmtN(effectiveC5)}`
}

// ─── Cálculo principal ────────────────────────────────────────────────────────
function calcForSex(
  sex:           Sex,
  ageYears:      number,
  ageMonths:     number,
  weightKg:      number,
  heightCm:      number,
  activityLevel: ActivityLevel,
  userGF?:       number,
): EERResult {
  const totalMonths = ageYears * 12 + ageMonths
  const ageDecimal  = ageYears + ageMonths / 12
  const variable    = isGFVariable(sex, totalMonths)

  let coeff: Coeff
  let label: string

  if (totalMonths < 3) {
    coeff = C['0_3m'][sex]; label = '0 a <3 meses'
  } else if (totalMonths < 6) {
    coeff = C['3_6m'][sex]; label = '3 a <6 meses'
  } else if (totalMonths < 36) {
    coeff = C['6m_3y'][sex]; label = '6m a <3 anos'
  } else if (ageYears < 14) {
    coeff = C['3_14y'][sex][activityLevel] as Coeff; label = '3 a <14 anos'
  } else {
    coeff = C['14_19y'][sex][activityLevel] as Coeff; label = '14 a <19 anos'
  }

  // C5 efetivo: para linhas variáveis, usa o valor do usuário (se informado); caso contrário usa o padrão do CSV
  const effectiveC5 = variable && userGF !== undefined ? userGF : coeff.c5
  const kcal        = coeff.c1 + coeff.c2 * ageDecimal + coeff.c3 * heightCm + coeff.c4 * weightKg + effectiveC5

  return {
    sex,
    ageCategory:   label,
    kcal:          r2(kcal),
    kcalPerKg:     r5(kcal / weightKg),
    formulaDetail: buildDetail(coeff, effectiveC5, ageDecimal, heightCm, weightKg),
    usedC5:        effectiveC5,
    gfVariable:    variable,
  }
}

export function calculateEER(input: EERInput): EERResult[] {
  const { sex, ageYears, ageMonths, weightKg, heightCm, activityLevel, growthFactorM, growthFactorF } = input
  const results: EERResult[] = []
  if (sex === 'M' || sex === 'both') results.push(calcForSex('M', ageYears, ageMonths, weightKg, heightCm, activityLevel, growthFactorM))
  if (sex === 'F' || sex === 'both') results.push(calcForSex('F', ageYears, ageMonths, weightKg, heightCm, activityLevel, growthFactorF))
  return results
}
