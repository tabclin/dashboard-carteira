import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'
import { slugify } from '@/lib/utils'
import { ensureTrgm } from '@/lib/exam/normalize'

const createSchema = z.object({
  displayName: z.string().min(1),
  category: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  refMinMale: z.number().nullable().optional(),
  refMaxMale: z.number().nullable().optional(),
  refMinFemale: z.number().nullable().optional(),
  refMaxFemale: z.number().nullable().optional(),
})

function serializeCatalogItem<T extends {
  refMinMale: { toNumber(): number } | null
  refMaxMale: { toNumber(): number } | null
  refMinFemale: { toNumber(): number } | null
  refMaxFemale: { toNumber(): number } | null
}>(item: T) {
  return {
    ...item,
    refMinMale:   item.refMinMale   != null ? item.refMinMale.toNumber()   : null,
    refMaxMale:   item.refMaxMale   != null ? item.refMaxMale.toNumber()   : null,
    refMinFemale: item.refMinFemale != null ? item.refMinFemale.toNumber() : null,
    refMaxFemale: item.refMaxFemale != null ? item.refMaxFemale.toNumber() : null,
  }
}

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.professional.findUnique({ where: { authUserId: user.id } })
}

export async function GET(req: Request) {
  const professional = await requireAuth()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()

  const items = await prisma.examCatalog.findMany({
    where: {
      professionalId: professional.id,
      ...(q ? {
        OR: [
          { displayName: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
        ],
      } : {}),
    },
    orderBy: [{ category: 'asc' }, { displayName: 'asc' }],
    select: {
      id: true,
      slug: true,
      displayName: true,
      category: true,
      unit: true,
      aliases: true,
      refMinMale: true,
      refMaxMale: true,
      refMinFemale: true,
      refMaxFemale: true,
      description: true,
      createdAt: true,
    },
  })

  return NextResponse.json(items.map(serializeCatalogItem))
}

export async function POST(req: Request) {
  const professional = await requireAuth()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { displayName, category, description, unit, aliases, refMinMale, refMaxMale, refMinFemale, refMaxFemale } = parsed.data

  let slug = slugify(displayName)
  const existing = await prisma.examCatalog.findFirst({
    where: { slug, professionalId: professional.id },
  })
  if (existing) slug = `${slug}-${Date.now()}`

  await ensureTrgm()

  const item = await prisma.examCatalog.create({
    data: {
      slug,
      professionalId: professional.id,
      displayName,
      category: category || null,
      description: description || null,
      unit: unit || null,
      aliases: aliases ?? [],
      refMinMale: refMinMale ?? null,
      refMaxMale: refMaxMale ?? null,
      refMinFemale: refMinFemale ?? null,
      refMaxFemale: refMaxFemale ?? null,
    },
  })

  return NextResponse.json(serializeCatalogItem(item), { status: 201 })
}
