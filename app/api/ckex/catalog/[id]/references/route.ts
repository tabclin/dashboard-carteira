import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.professional.findUnique({ where: { authUserId: user.id } })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const professional = await requireAuth()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params

  const catalog = await prisma.examCatalog.findFirst({ where: { id, professionalId: professional.id } })
  if (!catalog) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const template = await prisma.examCatalogTemplate.findFirst({ where: { slug: catalog.slug } })
  if (!template) return NextResponse.json([], { status: 200 })

  const refs = await prisma.examReference.findMany({
    where: { catalogTemplateId: template.id },
    include: {
      overrides: {
        where: { professionalId: professional.id },
      },
    },
    orderBy: [{ unit: 'asc' }, { sex: 'asc' }],
  })

  return NextResponse.json(refs.map((r) => ({
    id: r.id,
    unit: r.unit,
    sex: r.sex,
    ageMinMonths: r.ageMinMonths,
    ageMaxMonths: r.ageMaxMonths,
    globalRefMin: r.refMin != null ? Number(r.refMin) : null,
    globalRefMax: r.refMax != null ? Number(r.refMax) : null,
    override: r.overrides[0]
      ? {
          id: r.overrides[0].id,
          refMin: r.overrides[0].refMin != null ? Number(r.overrides[0].refMin) : null,
          refMax: r.overrides[0].refMax != null ? Number(r.overrides[0].refMax) : null,
        }
      : null,
  })))
}

const postSchema = z.union([
  z.object({
    examReferenceId: z.string().min(1),
    refMin: z.number().nullable(),
    refMax: z.number().nullable(),
  }),
  z.object({
    unit: z.string().min(1),
    sex: z.enum(['M', 'F', 'U']),
    ageMinMonths: z.number().int().nullable().optional(),
    ageMaxMonths: z.number().int().nullable().optional(),
    refMin: z.number().nullable(),
    refMax: z.number().nullable(),
  }),
])

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const professional = await requireAuth()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params

  const catalog = await prisma.examCatalog.findFirst({ where: { id, professionalId: professional.id } })
  if (!catalog) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await req.json()
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const data = parsed.data
  let examReferenceId: string

  if ('examReferenceId' in data) {
    examReferenceId = data.examReferenceId
  } else {
    const template = await prisma.examCatalogTemplate.findFirst({ where: { slug: catalog.slug } })
    if (!template) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })

    const existing = await prisma.examReference.findFirst({
      where: {
        catalogTemplateId: template.id,
        unit: data.unit,
        sex: data.sex,
        ageMinMonths: data.ageMinMonths ?? null,
        ageMaxMonths: data.ageMaxMonths ?? null,
      },
    })

    if (existing) {
      examReferenceId = existing.id
    } else {
      const created = await prisma.examReference.create({
        data: {
          catalogTemplateId: template.id,
          unit: data.unit,
          sex: data.sex,
          ageMinMonths: data.ageMinMonths ?? null,
          ageMaxMonths: data.ageMaxMonths ?? null,
          refMin: null,
          refMax: null,
        },
      })
      examReferenceId = created.id
    }
  }

  const override = await prisma.examReferenceOverride.upsert({
    where: {
      professionalId_examReferenceId: {
        professionalId: professional.id,
        examReferenceId,
      },
    },
    create: { professionalId: professional.id, examReferenceId, refMin: data.refMin, refMax: data.refMax },
    update: { refMin: data.refMin, refMax: data.refMax },
  })

  return NextResponse.json({
    id: override.id,
    refMin: override.refMin != null ? Number(override.refMin) : null,
    refMax: override.refMax != null ? Number(override.refMax) : null,
  })
}
