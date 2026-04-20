// Plano Alimentar baseado em grupos alimentares — CFN Resolução 600/2018
// e Manual de Alimentação da SBP 2018

export interface FoodGroupDef {
  key:        string
  label:      string
  kcalPorcao: number
  flexivel:   boolean  // escala com o EER; se false = porção fixa pela recomendação
  porcaoDesc: string
  cor:        string   // tailwind color key (sem prefixo)
}

export const FOOD_GROUPS: FoodGroupDef[] = [
  {
    key: 'cereais',
    label: 'Cereais, pães, massas e tubérculos',
    kcalPorcao: 150,
    flexivel: true,
    porcaoDesc: '4 col sopa arroz / 1 fatia de pão / 1 batata média',
    cor: 'amber',
  },
  {
    key: 'hortalicas',
    label: 'Hortaliças',
    kcalPorcao: 15,
    flexivel: false,
    porcaoDesc: '1 xíc chá folhosas / ½ xíc cozidas / ½ xíc refogadas',
    cor: 'green',
  },
  {
    key: 'frutas',
    label: 'Frutas',
    kcalPorcao: 70,
    flexivel: false,
    porcaoDesc: '1 fruta pequena / ½ fruta grande / 1 fatia melancia',
    cor: 'pink',
  },
  {
    key: 'leite',
    label: 'Leite e derivados',
    kcalPorcao: 120,
    flexivel: false,
    porcaoDesc: '200 mL leite integral / 1 pote iogurte / 1 fatia queijo',
    cor: 'blue',
  },
  {
    key: 'carnes',
    label: 'Carnes e ovos',
    kcalPorcao: 190,
    flexivel: false,
    porcaoDesc: '90 g carne bovina / 1 filé frango / 2 ovos inteiros',
    cor: 'red',
  },
  {
    key: 'leguminosas',
    label: 'Leguminosas',
    kcalPorcao: 55,
    flexivel: false,
    porcaoDesc: '1 concha feijão / lentilha / grão-de-bico cozido',
    cor: 'orange',
  },
  {
    key: 'gorduras',
    label: 'Gorduras e óleos',
    kcalPorcao: 73,
    flexivel: true,
    porcaoDesc: '1 col sopa azeite / óleo vegetal / ¼ abacate médio',
    cor: 'yellow',
  },
  {
    key: 'acucares',
    label: 'Açúcares e doces',
    kcalPorcao: 110,
    flexivel: true,
    porcaoDesc: '1 col sopa açúcar / 1 sachê mel / 1 col chá geleia',
    cor: 'purple',
  },
]

interface AgeGroupRef {
  label:     string
  minMonths: number
  maxMonths: number
  eerRef:    number               // kcal de referência desta faixa
  porcoes:   Record<string, number>
}

// Distribuição de referência por faixa etária (CFN Resolução 600/2018 / SBP 2018)
const AGE_REFS: AgeGroupRef[] = [
  {
    label: '1–3 anos', minMonths: 12, maxMonths: 47, eerRef: 1300,
    porcoes: { cereais: 4, hortalicas: 3, frutas: 3, leite: 2, carnes: 0.5, leguminosas: 0.5, gorduras: 1,   acucares: 0   },
  },
  {
    label: '4–6 anos', minMonths: 48, maxMonths: 83, eerRef: 1600,
    porcoes: { cereais: 5, hortalicas: 3, frutas: 3, leite: 2, carnes: 1,   leguminosas: 0.5, gorduras: 1,   acucares: 0.5 },
  },
  {
    label: '7–9 anos', minMonths: 84, maxMonths: 119, eerRef: 1800,
    porcoes: { cereais: 6, hortalicas: 4, frutas: 4, leite: 2, carnes: 1,   leguminosas: 1,   gorduras: 1,   acucares: 0.5 },
  },
  {
    label: '10–13 anos', minMonths: 120, maxMonths: 167, eerRef: 2100,
    porcoes: { cereais: 7, hortalicas: 4, frutas: 4, leite: 3, carnes: 1.5, leguminosas: 1,   gorduras: 1,   acucares: 1   },
  },
  {
    label: '14–18 anos', minMonths: 168, maxMonths: 227, eerRef: 2500,
    porcoes: { cereais: 8, hortalicas: 5, frutas: 5, leite: 3, carnes: 2,   leguminosas: 1,   gorduras: 2,   acucares: 1   },
  },
]

export function getAgeGroupRef(ageMonths: number): AgeGroupRef {
  return AGE_REFS.find(r => ageMonths >= r.minMonths && ageMonths <= r.maxMonths)
    ?? AGE_REFS[AGE_REFS.length - 1]
}

export interface GrupoResult {
  key:        string
  label:      string
  porcoes:    number
  kcalTotal:  number
  kcalPorcao: number
  pct:        number   // % do total de kcal do plano
  flexivel:   boolean
  porcaoDesc: string
  cor:        string
}

// Distribuição por refeição: % do EER e grupos alimentares presentes
export const REFEICOES_CONFIG: { nome: string; pct: number; keys: string[] }[] = [
  { nome: 'Café da manhã',   pct: 0.25, keys: ['cereais', 'leite',        'frutas',        'gorduras']             },
  { nome: 'Lanche da manhã', pct: 0.10, keys: ['frutas',  'cereais',      'leite']                                 },
  { nome: 'Almoço',          pct: 0.30, keys: ['cereais', 'leguminosas',   'carnes', 'hortalicas', 'gorduras']      },
  { nome: 'Lanche da tarde', pct: 0.15, keys: ['leite',   'frutas',       'cereais']                               },
  { nome: 'Jantar',          pct: 0.20, keys: ['cereais', 'leguminosas',   'carnes', 'hortalicas']                  },
]

export interface RefeicaoResult {
  nome:   string
  pct:    number   // ex: 25 = 25%
  kcal:   number
  grupos: string[] // labels dos grupos alimentares associados
}

export interface PlanoResult {
  ageGroup:  string
  eerKcal:   number
  grupos:    GrupoResult[]
  refeicoes: RefeicaoResult[]
  totalKcal: number
}

function r1(n: number) { return Math.round(n * 10) / 10 }

export function calcPlano(eerKcal: number, ageMonths: number): PlanoResult {
  const ageRef = getAgeGroupRef(ageMonths)

  // Soma kcal dos grupos fixos na referência
  const fixedKcal = FOOD_GROUPS
    .filter(g => !g.flexivel)
    .reduce((s, g) => s + (ageRef.porcoes[g.key] ?? 0) * g.kcalPorcao, 0)

  // Escala os grupos flexíveis para absorver o restante do EER alvo
  const flexRefKcal = FOOD_GROUPS
    .filter(g => g.flexivel)
    .reduce((s, g) => s + (ageRef.porcoes[g.key] ?? 0) * g.kcalPorcao, 0)

  const flexTarget = eerKcal - fixedKcal
  const flexScale  = flexRefKcal > 0 ? flexTarget / flexRefKcal : 1

  const gruposMap: Record<string, GrupoResult> = {}
  for (const g of FOOD_GROUPS) {
    const refPorcoes = ageRef.porcoes[g.key] ?? 0
    const porcoes    = g.flexivel ? r1(refPorcoes * flexScale) : refPorcoes
    const kcalTotal  = r1(porcoes * g.kcalPorcao)
    gruposMap[g.key] = {
      key: g.key, label: g.label,
      porcoes, kcalTotal, kcalPorcao: g.kcalPorcao,
      pct: 0, flexivel: g.flexivel, porcaoDesc: g.porcaoDesc, cor: g.cor,
    }
  }

  const totalKcal = Object.values(gruposMap).reduce((s, g) => s + g.kcalTotal, 0)
  for (const g of Object.values(gruposMap)) {
    g.pct = r1((g.kcalTotal / (totalKcal || 1)) * 100)
  }

  const grupos    = FOOD_GROUPS.map(g => gruposMap[g.key])
  const refeicoes = REFEICOES_CONFIG.map(m => ({
    nome:   m.nome,
    pct:    Math.round(m.pct * 100),
    kcal:   r1(eerKcal * m.pct),
    grupos: m.keys.map(k => gruposMap[k]?.label ?? k),
  }))

  return { ageGroup: ageRef.label, eerKcal, grupos, refeicoes, totalKcal }
}
