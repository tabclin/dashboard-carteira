import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { texto, pdfBase64, categorias } = await req.json()

    if (!texto?.trim() && !pdfBase64) {
      return NextResponse.json({ error: 'Nenhum conteúdo fornecido.' }, { status: 400 })
    }

    const catList = (categorias ?? [])
      .map((c: { id: string; nome: string; tipo: string }) => `- ID: ${c.id} | ${c.nome} (${c.tipo})`)
      .join('\n')

    const promptText = `Você é um especialista em finanças de clínica médica. Analise o extrato bancário abaixo e extraia todas as transações.

CATEGORIAS DISPONÍVEIS:
${catList || '(nenhuma categoria cadastrada — retorne categoria_id_sugerida vazia)'}

INSTRUÇÕES:
- Identifique cada transação individual
- Datas: converta para YYYY-MM-DD (se o extrato usar DD/MM/AAAA)
- Valores: sempre em centavos, sempre positivos
- tipo "entrada" = crédito/depósito/PIX recebido
- tipo "saida" = débito/pagamento/PIX enviado/transferência enviada
- Sugira a categoria mais adequada com base no nome da transação e nas categorias disponíveis
- Ignore saldos totais, apenas extraia movimentações individuais`

    // Conteúdo da mensagem: PDF ou texto puro
    const userContent = pdfBase64
      ? [
          {
            type: 'document' as const,
            source: {
              type: 'base64' as const,
              media_type: 'application/pdf' as const,
              data: pdfBase64,
            },
          },
          { type: 'text' as const, text: promptText },
        ]
      : promptText + `\n\nEXTRATO:\n${texto}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: [
        {
          name: 'extrair_transacoes',
          description: 'Extrai as transações financeiras de um extrato bancário e retorna no formato estruturado.',
          input_schema: {
            type: 'object',
            properties: {
              transacoes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    data: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
                    descricao: { type: 'string', description: 'Descrição limpa da transação' },
                    valor_centavos: { type: 'integer', description: 'Valor em centavos (sempre positivo)' },
                    tipo: { type: 'string', enum: ['entrada', 'saida'], description: 'Se é crédito (entrada) ou débito (saída)' },
                    categoria_id_sugerida: { type: 'string', description: 'ID da categoria mais adequada da lista, ou vazio se nenhuma se encaixar' },
                    confianca: { type: 'string', enum: ['alta', 'media', 'baixa'], description: 'Confiança na categorização' },
                  },
                  required: ['data', 'descricao', 'valor_centavos', 'tipo', 'categoria_id_sugerida', 'confianca'],
                },
              },
            },
            required: ['transacoes'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'extrair_transacoes' },
      messages: [
        {
          role: 'user',
          content: userContent,
        },
      ],
    })

    const toolUse = response.content.find(b => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json({ error: 'IA não retornou resultado estruturado.' }, { status: 500 })
    }

    const { transacoes } = toolUse.input as { transacoes: unknown[] }
    return NextResponse.json({ transacoes })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
