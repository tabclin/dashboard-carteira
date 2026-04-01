import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Você é um especialista em análise de extratos bancários brasileiros.
Sua única função é extrair movimentações financeiras de qualquer tipo de extrato: bancário, cartão de crédito, PIX, boleto, planilha CSV, etc.

Você SEMPRE deve usar a tool "extrair_transacoes" para retornar o resultado, mesmo que o array esteja vazio.

REGRAS DE EXTRAÇÃO:
- Extraia TODA linha que represente uma movimentação de dinheiro
- Tipos válidos de lançamento: PIX recebido/enviado, TED, DOC, débito, crédito, depósito, saque, tarifa, pagamento, transferência, compra, estorno, reembolso, mensalidade, aluguel, salário, etc.
- NÃO extraia: saldos (saldo anterior, saldo atual, saldo disponível), cabeçalhos, totais
- Datas: converta QUALQUER formato para YYYY-MM-DD (ex: "01/03/2026" → "2026-03-01")
- Valores: converta para centavos inteiros, SEMPRE positivos (ex: "R$ 1.500,00" ou "1500.00" → 150000)
- tipo "entrada": crédito, depósito, PIX recebido, transferência recebida, estorno, reembolso
- tipo "saida": débito, pagamento, PIX enviado, transferência enviada, saque, tarifa, compra
- Se o sinal não for claro pelo tipo, use o contexto da descrição
- confianca: "alta" = certeza; "media" = provável; "baixa" = incerto`

export async function POST(req: NextRequest) {
  try {
    const { texto, pdfBase64, categorias } = await req.json()

    if (!texto?.trim() && !pdfBase64) {
      return NextResponse.json({ error: 'Nenhum conteúdo fornecido.' }, { status: 400 })
    }

    const catList = (categorias ?? [])
      .map((c: { id: string; nome: string; tipo: string }) => `${c.id} → ${c.nome} (${c.tipo})`)
      .join('\n')

    const categoriasTexto = catList
      ? `\nCATEGORIAS DISPONÍVEIS PARA SUGESTÃO:\n${catList}\nUse o ID exato ou string vazia se nenhuma combinar.\n`
      : '\nNenhuma categoria cadastrada — use string vazia em categoria_id_sugerida.\n'

    // Para texto: separar instruções do conteúdo em mensagens distintas
    const messages: Anthropic.MessageParam[] = pdfBase64
      ? [
          {
            role: 'user',
            content: [
              {
                type: 'document' as const,
                source: {
                  type: 'base64' as const,
                  media_type: 'application/pdf' as const,
                  data: pdfBase64,
                },
              },
              {
                type: 'text' as const,
                text: `Extraia todas as movimentações financeiras deste PDF de extrato bancário.${categoriasTexto}Use a tool extrair_transacoes para retornar o resultado.`,
              },
            ],
          },
        ]
      : [
          {
            role: 'user',
            content: `Extraia todas as movimentações financeiras do extrato abaixo.${categoriasTexto}Use a tool extrair_transacoes para retornar o resultado.\n\n--- INÍCIO DO EXTRATO ---\n${texto.trim()}\n--- FIM DO EXTRATO ---`,
          },
        ]

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'extrair_transacoes',
          description: 'Retorna todas as movimentações financeiras identificadas no extrato.',
          input_schema: {
            type: 'object' as const,
            properties: {
              transacoes: {
                type: 'array',
                description: 'Lista de movimentações. Array vazio se nenhuma for encontrada.',
                items: {
                  type: 'object',
                  properties: {
                    data:                  { type: 'string',  description: 'Data no formato YYYY-MM-DD' },
                    descricao:             { type: 'string',  description: 'Descrição limpa da transação' },
                    valor_centavos:        { type: 'integer', description: 'Valor em centavos, sempre positivo' },
                    tipo:                  { type: 'string',  enum: ['entrada', 'saida'] },
                    categoria_id_sugerida: { type: 'string',  description: 'ID da categoria ou string vazia' },
                    confianca:             { type: 'string',  enum: ['alta', 'media', 'baixa'] },
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
      messages,
    })

    // Extrair bloco tool_use
    const toolUse = response.content.find(b => b.type === 'tool_use')

    if (!toolUse || toolUse.type !== 'tool_use') {
      // Log para diagnóstico
      console.error('[importar-extrato] Nenhum tool_use na resposta. stop_reason:', response.stop_reason)
      console.error('[importar-extrato] content blocks:', JSON.stringify(response.content.map(b => b.type)))
      return NextResponse.json(
        { error: `IA não retornou resultado estruturado. stop_reason: ${response.stop_reason}` },
        { status: 500 }
      )
    }

    const input = toolUse.input as { transacoes?: unknown[] }
    const transacoes = Array.isArray(input.transacoes) ? input.transacoes : []

    console.log(`[importar-extrato] ${transacoes.length} transações extraídas. stop_reason: ${response.stop_reason}`)

    if (transacoes.length === 0) {
      const dica = pdfBase64
        ? 'O PDF pode ser baseado em imagem (escaneado). Tente copiar e colar o texto do extrato na área de texto abaixo.'
        : 'O texto não contém movimentações identificáveis. Certifique-se de que o extrato tem datas, descrições e valores.'
      return NextResponse.json({ error: dica }, { status: 422 })
    }

    return NextResponse.json({ transacoes })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[importar-extrato] erro:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
