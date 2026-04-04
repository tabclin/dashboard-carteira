import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma/client'

export interface MatchedRef {
  refMin: number | null
  refMax: number | null
  unit: string
}

export interface CatalogMatch {
  id: string
  displayName: string
  slug: string
  category: string | null
  unit: string | null
  refMinMale: number | null
  refMaxMale: number | null
  refMinFemale: number | null
  refMaxFemale: number | null
  description: string | null
  aliases: string[]
  matchedRef: MatchedRef | null
}

/**
 * Garante que a extensão pg_trgm está ativada (idempotente).
 */
export async function ensureTrgm() {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
}

type Row = {
  id: string
  display_name: string
  slug: string
  category: string | null
  unit: string | null
  ref_min_male: number | null
  ref_max_male: number | null
  ref_min_female: number | null
  ref_max_female: number | null
  description: string | null
  aliases: string[]
}

function rowToMatch(r: Row, matchedRef: MatchedRef | null = null): CatalogMatch {
  return {
    id: r.id,
    displayName: r.display_name,
    slug: r.slug,
    category: r.category,
    unit: r.unit,
    refMinMale: r.ref_min_male !== null ? Number(r.ref_min_male) : null,
    refMaxMale: r.ref_max_male !== null ? Number(r.ref_max_male) : null,
    refMinFemale: r.ref_min_female !== null ? Number(r.ref_min_female) : null,
    refMaxFemale: r.ref_max_female !== null ? Number(r.ref_max_female) : null,
    description: r.description,
    aliases: r.aliases,
    matchedRef,
  }
}

/**
 * Resolve uma unidade extraída do PDF para a forma canônica via tabela unit_alias.
 */
export async function resolveUnit(raw: string): Promise<string> {
  if (!raw) return raw
  const rows = await prisma.$queryRaw<{ canonical: string }[]>`
    SELECT canonical FROM unit_alias
    WHERE LOWER(alias) = LOWER(${raw.trim()})
    LIMIT 1
  `
  return rows.length > 0 ? rows[0].canonical : raw.trim()
}

/**
 * Calcula a idade do paciente em meses completos a partir da data de nascimento.
 */
function calcAgeMonths(birthDate: Date | null | undefined): number | null {
  if (!birthDate) return null
  const now = new Date()
  return (now.getFullYear() - birthDate.getFullYear()) * 12
    + (now.getMonth() - birthDate.getMonth())
}

/**
 * Busca a referência em exam_reference para o exame (pelo slug do template),
 * unidade canônica, sexo e idade do paciente.
 */
export async function findReference(
  examSlug: string,
  canonicalUnit: string,
  patientSex: string | null | undefined,
  professionalId: string,
  patientBirthDate?: Date | null,
): Promise<MatchedRef | null> {
  const sex = patientSex === 'M' || patientSex === 'F' ? patientSex : null
  const ageMonths = calcAgeMonths(patientBirthDate)

  const ageFilter = ageMonths !== null
    ? Prisma.sql`
        AND (
          (er.age_min_months IS NULL AND er.age_max_months IS NULL)
          OR (
            (er.age_min_months IS NULL OR er.age_min_months <= ${ageMonths})
            AND (er.age_max_months IS NULL OR er.age_max_months >= ${ageMonths})
          )
        )`
    : Prisma.empty

  const ageOrder = ageMonths !== null
    ? Prisma.sql`
        CASE WHEN er.age_min_months IS NULL AND er.age_max_months IS NULL THEN 1 ELSE 0 END,
        (COALESCE(er.age_max_months, 32767) - COALESCE(er.age_min_months, 0)),`
    : Prisma.empty

  const rows = await prisma.$queryRaw<{ ref_min: number | null; ref_max: number | null }[]>`
    SELECT
      COALESCE(ero.ref_min, er.ref_min) AS ref_min,
      COALESCE(ero.ref_max, er.ref_max) AS ref_max
    FROM exam_reference er
    JOIN exam_catalog_template ect ON ect.id = er.catalog_template_id
    LEFT JOIN exam_reference_override ero
      ON ero.exam_reference_id = er.id
      AND ero.professional_id = ${professionalId}
    WHERE ect.slug = ${examSlug}
      AND LOWER(er.unit) = LOWER(${canonicalUnit})
      AND (er.sex = ${sex ?? 'U'} OR er.sex = 'U')
      ${ageFilter}
      AND (
        ero.ref_min IS NOT NULL OR ero.ref_max IS NOT NULL
        OR (ero.id IS NULL AND (er.ref_min IS NOT NULL OR er.ref_max IS NOT NULL))
      )
    ORDER BY
      CASE er.sex WHEN ${sex ?? 'U'} THEN 0 ELSE 1 END,
      ${ageOrder}
      CASE WHEN ero.id IS NOT NULL THEN 0 ELSE 1 END,
      1
    LIMIT 1
  `

  if (rows.length === 0) return null

  return {
    refMin: rows[0].ref_min !== null ? Number(rows[0].ref_min) : null,
    refMax: rows[0].ref_max !== null ? Number(rows[0].ref_max) : null,
    unit: canonicalUnit,
  }
}

// Campos SELECT reutilizados nas queries
const FIELDS = Prisma.raw(`
  id, display_name, slug, category, unit,
  ref_min_male, ref_max_male, ref_min_female, ref_max_female,
  description, aliases
`)

/**
 * Busca o exame do catálogo do profissional correspondente ao nome extraído.
 */
export async function findCatalogMatch(
  extractedName: string,
  professionalId: string,
  extractedUnit?: string,
  patientSex?: string | null,
  threshold = 0.4,
  patientBirthDate?: Date | null,
): Promise<CatalogMatch | null> {
  // ── Nível 0: Abreviatura entre parênteses ──────────────────────────────────
  const abbrevMatch = extractedName.match(/\(([A-Za-z0-9.]+)\)\s*$/)
  if (abbrevMatch) {
    const abbrev = abbrevMatch[1]

    const abbrevExactRows = await prisma.$queryRaw<Row[]>`
      SELECT ${FIELDS}
      FROM exam_catalog
      WHERE professional_id = ${professionalId}
        AND (
          LOWER(display_name) = LOWER(${abbrev})
          OR LOWER(${abbrev}) = ANY(
            SELECT LOWER(a) FROM unnest(aliases) a
          )
        )
      LIMIT 1
    `
    if (abbrevExactRows.length > 0) return resolveMatchedRef(abbrevExactRows[0], extractedUnit, patientSex, professionalId, patientBirthDate)

    const abbrevNorm = abbrev.toLowerCase().replace(/[.\s\-]/g, '')
    if (abbrevNorm.length >= 2) {
      const abbrevNormRows = await prisma.$queryRaw<Row[]>`
        SELECT ${FIELDS}
        FROM exam_catalog
        WHERE professional_id = ${professionalId}
          AND (
            LOWER(REGEXP_REPLACE(display_name, '[. ]', '', 'g')) = ${abbrevNorm}
            OR EXISTS (
              SELECT 1 FROM unnest(aliases) a
              WHERE LOWER(REGEXP_REPLACE(a, '[. ]', '', 'g')) = ${abbrevNorm}
            )
          )
        LIMIT 1
      `
      if (abbrevNormRows.length > 0) return resolveMatchedRef(abbrevNormRows[0], extractedUnit, patientSex, professionalId, patientBirthDate)
    }
  }

  // ── Nível 1: Correspondência exata ────────────────────────────────────────
  const exactRows = await prisma.$queryRaw<Row[]>`
    SELECT ${FIELDS}
    FROM exam_catalog
    WHERE professional_id = ${professionalId}
      AND (
        LOWER(display_name) = LOWER(${extractedName})
        OR LOWER(${extractedName}) = ANY(
          SELECT LOWER(a) FROM unnest(aliases) a
        )
      )
    LIMIT 1
  `
  if (exactRows.length > 0) return resolveMatchedRef(exactRows[0], extractedUnit, patientSex, professionalId, patientBirthDate)

  // ── Nível 2: Correspondência normalizada ──────────────────────────────────
  const normalizedName = extractedName.toLowerCase().replace(/[.\s\-]/g, '')

  if (normalizedName.length >= 2) {
    const normalizedRows = await prisma.$queryRaw<Row[]>`
      SELECT ${FIELDS}
      FROM exam_catalog
      WHERE professional_id = ${professionalId}
        AND (
          LOWER(REGEXP_REPLACE(display_name, '[. ]', '', 'g')) = ${normalizedName}
          OR EXISTS (
            SELECT 1 FROM unnest(aliases) a
            WHERE LOWER(REGEXP_REPLACE(a, '[. ]', '', 'g')) = ${normalizedName}
          )
        )
      LIMIT 1
    `
    if (normalizedRows.length > 0) return resolveMatchedRef(normalizedRows[0], extractedUnit, patientSex, professionalId, patientBirthDate)
  }

  // ── Nível 3: Similaridade pg_trgm ────────────────────────────────────────
  const unitParam = extractedUnit ?? ''
  const fuzzyRows = await prisma.$queryRaw<Row[]>`
    SELECT ${FIELDS},
      GREATEST(
        similarity(display_name, ${extractedName}),
        COALESCE(
          (SELECT MAX(similarity(a, ${extractedName})) FROM unnest(aliases) AS a),
          0
        )
      ) AS score
    FROM exam_catalog
    WHERE professional_id = ${professionalId}
      AND (
        similarity(display_name, ${extractedName}) > ${threshold}
        OR EXISTS (
          SELECT 1 FROM unnest(aliases) AS a
          WHERE similarity(a, ${extractedName}) > 0.3
        )
      )
    ORDER BY
      score DESC,
      CASE WHEN ${unitParam} <> '' AND unit = ${unitParam} THEN 0 ELSE 1 END
    LIMIT 1
  `
  if (fuzzyRows.length > 0) return resolveMatchedRef(fuzzyRows[0], extractedUnit, patientSex, professionalId, patientBirthDate)

  return null
}

async function resolveMatchedRef(
  row: Row,
  extractedUnit: string | undefined,
  patientSex: string | null | undefined,
  professionalId: string,
  patientBirthDate?: Date | null,
): Promise<CatalogMatch> {
  let matchedRef: MatchedRef | null = null
  if (extractedUnit) {
    const canonicalUnit = await resolveUnit(extractedUnit)
    matchedRef = await findReference(row.slug, canonicalUnit, patientSex, professionalId, patientBirthDate)
  }
  return rowToMatch(row, matchedRef)
}

/**
 * Normaliza um lote de exames contra o catálogo do profissional.
 */
export async function normalizeBatch(
  inputs: { name: string; unit?: string }[],
  professionalId: string,
  patientSex?: string | null,
  patientBirthDate?: Date | null,
): Promise<Map<string, CatalogMatch | null>> {
  await ensureTrgm()
  const map = new Map<string, CatalogMatch | null>()

  const seen = new Set<string>()
  const unique: { name: string; unit?: string }[] = []
  for (const input of inputs) {
    if (!seen.has(input.name)) {
      seen.add(input.name)
      unique.push(input)
    }
  }

  await Promise.all(
    unique.map(async ({ name, unit }) => {
      map.set(name, await findCatalogMatch(name, professionalId, unit, patientSex, 0.4, patientBirthDate))
    }),
  )
  return map
}

/**
 * Busca referências em lote para uma lista de resultados já salvos no banco.
 */
export async function findMatchedRefsForResults(
  items: { examSlug: string; unit: string | null }[],
  patientSex: string | null | undefined,
  patientBirthDate: Date | null | undefined,
  professionalId: string,
): Promise<Map<string, MatchedRef | null>> {
  const map = new Map<string, MatchedRef | null>()

  const seen = new Set<string>()
  const unique: { examSlug: string; unit: string | null }[] = []
  for (const item of items) {
    const key = `${item.examSlug}::${item.unit ?? ''}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(item)
    }
  }

  await Promise.all(
    unique.map(async ({ examSlug, unit }) => {
      const key = `${examSlug}::${unit ?? ''}`
      if (!unit) {
        map.set(key, null)
        return
      }
      const canonicalUnit = await resolveUnit(unit)
      map.set(key, await findReference(examSlug, canonicalUnit, patientSex, professionalId, patientBirthDate))
    }),
  )
  return map
}
