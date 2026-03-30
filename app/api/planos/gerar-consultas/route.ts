import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

interface PacienteInput {
  tempId: string
  nome: string
  nascimento: string
  observacao: string
}

interface ServicoInput {
  id: string
  nome: string
  descricao: string | null
  valor_cheio: number
  valor_recorrente: number | null
}

interface GerarConsultasRequest {
  responsavel_nome: string
  data_inicio: string
  data_fim: string
  observacao: string
  pacientes: PacienteInput[]
  servicos: ServicoInput[]
  instrucoes_adicionais?: string
}

function calcularIdade(nascimento: string): string {
  if (!nascimento) return 'idade não informada'
  const hoje = new Date()
  const nasc = new Date(nascimento)
  const mesesTotal =
    (hoje.getFullYear() - nasc.getFullYear()) * 12 +
    (hoje.getMonth() - nasc.getMonth())
  if (mesesTotal < 12) return `${mesesTotal} meses`
  const anos = Math.floor(mesesTotal / 12)
  const meses = mesesTotal % 12
  return meses > 0 ? `${anos} anos e ${meses} meses` : `${anos} anos`
}

function centavosParaReais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })
  }

  const body: GerarConsultasRequest = await req.json()

  const dataInicio = body.data_inicio ? `${body.data_inicio}-01` : null
  const dataFim = body.data_fim ? `${body.data_fim}-01` : null

  const pacientesTexto = body.pacientes
    .map((p, i) =>
      [
        `${i + 1}. ${p.nome}`,
        `   Idade: ${calcularIdade(p.nascimento)}`,
        p.observacao ? `   Observações: ${p.observacao}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n\n')

  const servicosTexto = body.servicos
    .map(s => {
      const valorCentavos = s.valor_recorrente ?? s.valor_cheio
      const linhas = [`- ID: "${s.id}" | ${s.nome} | ${centavosParaReais(valorCentavos)}`]
      if (s.descricao) linhas.push(`  O que inclui: ${s.descricao}`)
      return linhas.join('\n')
    })
    .join('\n')

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [
      {
        name: 'gerar_plano_consultas',
        description: 'Gera o plano de consultas estruturado para cada paciente',
        input_schema: {
          type: 'object' as const,
          properties: {
            pacientes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  tempId: { type: 'string', description: 'Mesmo tempId recebido no input' },
                  consultas: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        servico_id:   { type: 'string', description: 'ID exato do serviço da lista' },
                        servico_nome: { type: 'string' },
                        data_sugerida: { type: 'string', description: 'YYYY-MM-DD, dentro do período do plano' },
                        valor_cheio:  { type: 'number', description: 'valor em centavos conforme o serviço' },
                        observacao:   { type: 'string', description: 'Nota clínica clara para o responsável' },
                      },
                      required: ['servico_id', 'servico_nome', 'data_sugerida', 'valor_cheio', 'observacao'],
                    },
                  },
                },
                required: ['tempId', 'consultas'],
              },
            },
          },
          required: ['pacientes'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'gerar_plano_consultas' },
    messages: [
      {
        role: 'user',
        content: `Você é uma assistente especialista em gestão de planos clínicos pediátricos. Crie um plano de acompanhamento personalizado.

PLANO
- Responsável: ${body.responsavel_nome}
- Período: ${dataInicio ?? 'não definido'} a ${dataFim ?? 'não definido'}
- Observações gerais: ${body.observacao || 'nenhuma'}

PACIENTES
${pacientesTexto}

SERVIÇOS DISPONÍVEIS (use SOMENTE estes, com os IDs exatos)
${servicosTexto}
${body.instrucoes_adicionais ? `\nINSTRUÇÕES ADICIONAIS: ${body.instrucoes_adicionais}\n` : ''}
REGRAS:
- Use APENAS serviços da lista acima, com os IDs exatos
- Todas as datas devem estar entre ${dataInicio} e ${dataFim} no formato YYYY-MM-DD
- Adapte quantidade e intervalos à idade de cada paciente e às observações
- Escreva observações clínicas informativas e persuasivas, acessíveis ao responsável (sem termos excessivamente técnicos)
- Retorne os pacientes na MESMA ORDEM recebida no input`,
      },
    ],
  })

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'IA não retornou resultado estruturado' }, { status: 500 })
  }

  const resultado = toolUse.input as {
    pacientes: {
      tempId: string
      consultas: {
        servico_id: string
        servico_nome: string
        data_sugerida: string
        valor_cheio: number
        observacao: string
      }[]
    }[]
  }

  // Garantir que datas estejam dentro do período
  if (dataInicio && dataFim) {
    for (const p of resultado.pacientes) {
      for (const c of p.consultas) {
        if (c.data_sugerida < dataInicio) c.data_sugerida = dataInicio
        if (c.data_sugerida > dataFim) c.data_sugerida = dataFim
      }
    }
  }

  return NextResponse.json(resultado)
}
