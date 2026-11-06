import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { usuarioAtual } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { OrientacaoDocument } from '@/lib/pdf/orientacao'
import { aparenciaComPadrao } from '@/lib/pdf/aparencia'
import type { SecaoValor } from '@/lib/orientacoes/types'

export const runtime = 'nodejs'

// Só dados fictícios: serve para ver a aparência salva, nunca lê paciente.
const SECOES: SecaoValor[] = [
  {
    id: 'exemplo-1', titulo: 'Alimentação', tipo: 'texto_longo',
    valor: '<h2>Rotina da Maria</h2><p>Ofereça <strong>frutas</strong> no lanche e <span style="color: #dc2626">evite sucos</span> antes das refeições.</p>'
      + '<h3>Dicas</h3><ul><li><p>Água ao longo do dia</p></li><li><p>Refeições em família, sem telas</p></li></ul>',
  },
  { id: 'exemplo-2', titulo: 'Retorno', tipo: 'texto_curto', valor: 'Em 30 dias, com os exames.' },
]

export async function GET() {
  const user = await usuarioAtual()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const professional = await prisma.professional.findUnique({ where: { authUserId: user.id }, include: { aparenciaPdf: true } })
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(OrientacaoDocument, {
    aparencia: aparenciaComPadrao(professional.aparenciaPdf, professional),
    paciente:  { nome: 'Maria Exemplo', idade: '3 anos e 2 meses' },
    title:     'Orientação de exemplo',
    secoes:    SECOES,
    data:      new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
  }) as any)

  return new Response(new Uint8Array(buffer), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="orientacao-exemplo.pdf"' },
  })
}
