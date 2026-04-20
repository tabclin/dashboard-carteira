// DRI 2023 (NASEM) — Distribuição de Macronutrientes
// AMDR = Acceptable Macronutrient Distribution Ranges (% da energia total)
// RDA  = Recommended Dietary Allowance para proteína (g/kg/dia)

export interface MacroRange { min: number; max: number }

export interface AgeGroupMacro {
  label:    string
  carbs:    MacroRange  // % kcal total
  fat:      MacroRange  // % kcal total
  protein:  MacroRange  // % kcal total
  proteinRdaGPerKg: number  // g/kg/dia
}

// AMDR e RDA por faixa etária (DRI 2023 NASEM)
const MACRO_TABLE: Array<{ minMonths: number; maxMonths: number; data: AgeGroupMacro }> = [
  {
    minMonths: 0, maxMonths: 6,
    data: { label: '0–6 meses', carbs: { min: 45, max: 65 }, fat: { min: 40, max: 55 }, protein: { min: 5, max: 20 }, proteinRdaGPerKg: 1.52 },
  },
  {
    minMonths: 7, maxMonths: 11,
    data: { label: '7–12 meses', carbs: { min: 45, max: 65 }, fat: { min: 30, max: 40 }, protein: { min: 5, max: 20 }, proteinRdaGPerKg: 1.20 },
  },
  {
    minMonths: 12, maxMonths: 35,
    data: { label: '1–3 anos', carbs: { min: 45, max: 65 }, fat: { min: 30, max: 40 }, protein: { min: 5, max: 20 }, proteinRdaGPerKg: 1.05 },
  },
  {
    minMonths: 36, maxMonths: 107,
    data: { label: '3–8 anos', carbs: { min: 45, max: 65 }, fat: { min: 25, max: 35 }, protein: { min: 10, max: 30 }, proteinRdaGPerKg: 0.95 },
  },
  {
    minMonths: 108, maxMonths: 167,
    data: { label: '9–13 anos', carbs: { min: 45, max: 65 }, fat: { min: 25, max: 35 }, protein: { min: 10, max: 30 }, proteinRdaGPerKg: 0.95 },
  },
  {
    minMonths: 168, maxMonths: 227,
    data: { label: '14–18 anos', carbs: { min: 45, max: 65 }, fat: { min: 25, max: 35 }, protein: { min: 10, max: 30 }, proteinRdaGPerKg: 0.85 },
  },
]

export function getMacroGroup(totalMonths: number): AgeGroupMacro {
  const found = MACRO_TABLE.find(r => totalMonths >= r.minMonths && totalMonths <= r.maxMonths)
  return found?.data ?? MACRO_TABLE[MACRO_TABLE.length - 1].data
}

// ─── Cálculo de distribuição de macros a partir do EER ───────────────────────

export interface MacroResult {
  label:         string           // faixa etária
  eerKcal:       number
  weightKg:      number
  carbs:         { minG: number; maxG: number; minKcal: number; maxKcal: number; minPct: number; maxPct: number }
  fat:           { minG: number; maxG: number; minKcal: number; maxKcal: number; minPct: number; maxPct: number }
  protein:       { minG: number; maxG: number; minKcal: number; maxKcal: number; minPct: number; maxPct: number; rdaG: number }
}

function r1(n: number) { return Math.round(n * 10) / 10 }

export function calcMacros(eerKcal: number, weightKg: number, totalMonths: number): MacroResult {
  const group = getMacroGroup(totalMonths)

  const carbsMinG    = r1((eerKcal * group.carbs.min   / 100) / 4)
  const carbsMaxG    = r1((eerKcal * group.carbs.max   / 100) / 4)
  const fatMinG      = r1((eerKcal * group.fat.min     / 100) / 9)
  const fatMaxG      = r1((eerKcal * group.fat.max     / 100) / 9)
  const protMinG     = r1((eerKcal * group.protein.min / 100) / 4)
  const protMaxG     = r1((eerKcal * group.protein.max / 100) / 4)
  const protRdaG     = r1(group.proteinRdaGPerKg * weightKg)

  return {
    label:    group.label,
    eerKcal,
    weightKg,
    carbs: {
      minG: carbsMinG, maxG: carbsMaxG,
      minKcal: r1(carbsMinG * 4), maxKcal: r1(carbsMaxG * 4),
      minPct: group.carbs.min,    maxPct: group.carbs.max,
    },
    fat: {
      minG: fatMinG, maxG: fatMaxG,
      minKcal: r1(fatMinG * 9), maxKcal: r1(fatMaxG * 9),
      minPct: group.fat.min,    maxPct: group.fat.max,
    },
    protein: {
      minG: protMinG, maxG: protMaxG,
      minKcal: r1(protMinG * 4), maxKcal: r1(protMaxG * 4),
      minPct: group.protein.min,  maxPct: group.protein.max,
      rdaG: protRdaG,
    },
  }
}
