import { slugify } from '@/lib/utils'

export interface ExtractedResult {
  examName: string
  examSlug: string
  catalogId?: string      // preenchido após normalização
  extractedName?: string  // nome original extraído pela IA (antes da normalização)
  category: string
  value: string
  valueNumeric: number | null
  unit: string
  refMin: number | null
  refMax: number | null
  refText: string
  matchedRef?: { refMin: number | null; refMax: number | null; unit: string } | null
}

// ─── Mapa de categorias ───────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: [string[], string][] = [
  [['hemoglobina', 'hematocrito', 'eritrocito', 'leucocito', 'plaqueta', 'vcm', 'hcm', 'chcm', 'rdw', 'neutrofil', 'linfocit', 'monocit', 'eosinofil', 'basofil', 'hemograma', 'serie vermelha', 'serie branca'], 'Hemograma'],
  [['glicose', 'glicemia', 'glicada', 'hba1c', 'insulina', 'homa'], 'Glicemia'],
  [['colesterol', 'ldl', 'hdl', 'vldl', 'triglicerid'], 'Lipídios'],
  [['tsh', 't3', 't4', 'tireoide', 'anti tpo', 'anti tg'], 'Tireoide'],
  [['creatinina', 'ureia', 'acido urico', 'acido úrico', 'tfg', 'microalbumin'], 'Renal'],
  [['tgo', 'tgp', 'ast', 'alt', 'transaminase', 'ggt', 'fosfatase', 'bilirrubina', 'albumina', 'hepatic'], 'Hepático'],
  [['ferritina', 'ferro', 'transferrina', 'satur'], 'Ferro / Anemia'],
  [['vitamina b', 'vitamina d', 'folato', 'acido folico', 'ácido fólico'], 'Vitaminas'],
  [['pcr', 'proteina c reativa', 'proteína c reativa', 'vhs', 'velocidade'], 'Inflamação'],
  [['sodio', 'sódio', 'potassio', 'potássio', 'calcio', 'cálcio', 'magnesio', 'magnésio', 'fosforo', 'fósforo', 'cloro'], 'Eletrólitos'],
  [['psa', 'testosterona', 'estradiol', 'progesterona', 'prolactina', 'cortisol', 'dhea', 'lh', 'fsh', 'igf'], 'Hormônios'],
  [['ck', 'cpk', 'ldh', 'troponina', 'mioglobina'], 'Muscular'],
  [['tp ', 'ttpa', 'inr', 'fibrinogenio', 'fibrinogênio', 'd dimero', 'd-dímero'], 'Coagulação'],
  [['urinalise', 'urina', 'urina i'], 'Urina'],
]

function getCategory(name: string): string {
  const lower = name.toLowerCase()
  for (const [keywords, category] of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return category
  }
  return 'Outros'
}

// ─── Parse de número ─────────────────────────────────────────────────────────

function parseNum(s: string): number | null {
  if (!s) return null
  const n = parseFloat(s.replace(',', '.').replace(/[^\d.]/g, ''))
  return isNaN(n) ? null : n
}

// ─── Parse da referência ─────────────────────────────────────────────────────

function parseRef(refRaw: string): { min: number | null; max: number | null; text: string } {
  const ref = refRaw.trim()

  // "3,5 a 8,5" ou "3,5 - 8,5" ou "3.5 a 8.5"
  const range = ref.match(/(\d+[,.]?\d*)\s*(?:a|A|-|–)\s*(\d+[,.]?\d*)/)
  if (range) {
    return { min: parseNum(range[1]), max: parseNum(range[2]), text: ref }
  }

  // "INFERIOR A 50" ou "< 50" ou "Até 50"
  const maxOnly = ref.match(/(?:inferior\s+a|ate|até|<|menor)\s+(\d+[,.]?\d*)/i)
  if (maxOnly) {
    return { min: null, max: parseNum(maxOnly[1]), text: ref }
  }

  // "SUPERIOR A 40" ou "> 40"
  const minOnly = ref.match(/(?:superior\s+a|acima|>|maior)\s+(\d+[,.]?\d*)/i)
  if (minOnly) {
    return { min: parseNum(minOnly[1]), max: null, text: ref }
  }

  return { min: null, max: null, text: ref }
}

// ─── Normaliza texto extraído do PDF ─────────────────────────────────────────
// pdfjs extrai com espaços extras entre letras — ex: "A  C  I  D  O" → "ACIDO"

function normalizeSpaces(text: string): string {
  return text
    .replace(/([A-ZÁÉÍÓÚÃÕÂÊÔÇÜ])\s{1,3}(?=[A-ZÁÉÍÓÚÃÕÂÊÔÇÜ])/g, '$1') // junta letras maiúsculas separadas por 1-3 espaços
    .replace(/\s{2,}/g, ' ') // reduz múltiplos espaços para um
    .trim()
}

// ─── Parser principal ────────────────────────────────────────────────────────

export function parsePdfText(rawText: string): ExtractedResult[] {
  const results: ExtractedResult[] = []
  const seen = new Set<string>()

  // Normaliza o texto
  const text = normalizeSpaces(rawText)

  // ── Estratégia 1: Formato "RESULTADO: valor unidade Valor de Referência: ref"
  // Cobre labs como Unimed, labs de Química Seca (Vitros/Johnson)
  const strategy1 = /([A-ZÁÉÍÓÚÃÕÂÊÔÇÜ][A-ZÁÉÍÓÚÃÕÂÊÔÇÜa-záéíóúãõâêôçü\s\-\/()]{2,60}?)\s+RESULTADO:\s*([\d,]+)\s*([a-zA-Z/%µ]+(?:\/[a-zA-Z]+)?)\s+Valor\s+de\s+Referência:\s*([^_\n]+?)(?=\s+Fonte:|$|\s+Material:|_{5})/gi

  let m: RegExpExecArray | null
  while ((m = strategy1.exec(text)) !== null) {
    const examName = m[1].trim().replace(/\s+/g, ' ')
    const value = m[2].trim()
    const unit = m[3].trim()
    const refRaw = m[4].trim()

    // Filtra linhas que são metadados, não exames
    if (/paciente|solicitante|convênio|medico|médico|data|hora|método|material|fonte/i.test(examName)) continue
    if (examName.length < 3 || examName.length > 80) continue

    const slug = slugify(examName)
    if (seen.has(slug)) continue
    seen.add(slug)

    const { min, max, text: refText } = parseRef(refRaw)

    results.push({
      examName,
      examSlug: slug,
      category: getCategory(examName),
      value,
      valueNumeric: parseNum(value),
      unit,
      refMin: min,
      refMax: max,
      refText,
    })
  }

  // ── Estratégia 2: Formato tabela "Nome    Resultado    Unidade    Referência"
  // Cobre Fleury, DASA, Sabin — PDFs com layout de tabela
  if (results.length === 0) {
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 3)

    for (const line of lines) {
      // Ignora cabeçalhos e metadados
      if (/^(data|paciente|médico|medico|lab|exame|resultado|unidade|referência|método|material|coleta|convenio|nome|cpf|rg|idade|sexo|solicitante|fonte|liberação|assinatura)/i.test(line)) continue
      if (/^\d{2}\/\d{2}\/\d{4}/.test(line)) continue
      if (/^[_\-=]{5,}/.test(line)) continue

      // Padrão tabela: "Nome   14,2   g/dL   12,0 - 16,0"
      const tabMatch = line.match(/^(.+?)\s{2,}(\d[\d,.]*)\s{1,}([a-zA-Z%µ/]+)\s{2,}(.+)$/)
      if (!tabMatch) continue

      const [, rawName, rawValue, rawUnit, rawRef] = tabMatch
      const examName = rawName.trim()
      if (examName.length < 3 || examName.length > 80) continue

      const slug = slugify(examName)
      if (seen.has(slug)) continue

      const valueNum = parseNum(rawValue)
      if (!valueNum) continue

      seen.add(slug)
      const { min, max, text: refText } = parseRef(rawRef)

      results.push({
        examName,
        examSlug: slug,
        category: getCategory(examName),
        value: rawValue.trim(),
        valueNumeric: valueNum,
        unit: rawUnit.trim(),
        refMin: min,
        refMax: max,
        refText,
      })
    }
  }

  return results.sort((a, b) => a.category.localeCompare(b.category))
}
