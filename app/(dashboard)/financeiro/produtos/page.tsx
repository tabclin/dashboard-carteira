import { createClient } from '@/lib/supabase/server'
import ProdutosList from '@/components/financeiro/produtos-list'
import type { Servico, FinAlocacao, FinCategoria } from '@/types'

export const revalidate = 0

export interface ProdutoFinanceiro {
  servico: Servico
  alocacoes: FinAlocacao[]
  receitaHistorica: number
  qtdAtendimentos: number
  custoAlocado: number
  margem: number | null
}

export default async function ProdutosPage() {
  const supabase = createClient()

  // Período: mês atual
  const hoje = new Date()
  const mesKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const mesInicio = `${mesKey}-01`
  const mesFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]

  const [
    { data: servicos },
    { data: categorias },
    { data: alocacoes },
    { data: atendimentos },
    { data: movimentacoes },
  ] = await Promise.all([
    supabase.from('servicos').select('*').order('nome'),
    supabase.from('fin_categorias').select('*').order('nome'),
    supabase
      .from('fin_alocacoes')
      .select('*, categoria:fin_categorias(*)')
      .eq('ativo', true),
    supabase
      .from('atendimentos')
      .select('servico, valor')
      .gte('data_atendimento', mesInicio)
      .lte('data_atendimento', mesFim),
    supabase
      .from('fin_movimentacoes')
      .select('categoria_id, valor, tipo')
      .gte('data_caixa', mesInicio)
      .lte('data_caixa', mesFim)
      .not('data_caixa', 'is', null),
  ])

  const servsList = (servicos ?? []) as Servico[]
  const catsList = (categorias ?? []) as FinCategoria[]
  const alocList = (alocacoes ?? []) as FinAlocacao[]

  // Separa movimentacoes por tipo
  const custosPorCategoria = new Map<string, number>()
  const receitaFinPorCategoria = new Map<string, number>()
  for (const m of movimentacoes ?? []) {
    if (!m.categoria_id) continue
    if (m.tipo === 'saida') {
      custosPorCategoria.set(m.categoria_id, (custosPorCategoria.get(m.categoria_id) ?? 0) + m.valor)
    } else {
      receitaFinPorCategoria.set(m.categoria_id, (receitaFinPorCategoria.get(m.categoria_id) ?? 0) + m.valor)
    }
  }

  // Mapa: servico_id → categoria_id (para entradas de fin_movimentacoes vinculadas ao serviço)
  const catPorServico = new Map<string, string>()
  for (const c of catsList) {
    if (c.tipo === 'entrada' && c.servico_id) {
      catPorServico.set(c.servico_id, c.id)
    }
  }

  // Receita e qtd de atendimentos por serviço (tabela legada atendimentos)
  const receitaAtendPorServico = new Map<string, number>()
  const qtdPorServico = new Map<string, number>()
  for (const at of atendimentos ?? []) {
    const nome = (at.servico ?? '').toLowerCase()
    receitaAtendPorServico.set(nome, (receitaAtendPorServico.get(nome) ?? 0) + (at.valor ?? 0))
    qtdPorServico.set(nome, (qtdPorServico.get(nome) ?? 0) + 1)
  }

  // Montar produtos financeiros
  const produtos: ProdutoFinanceiro[] = servsList.map(s => {
    const sAlocacoes = alocList.filter(a => a.servico_id === s.id)
    const nomeKey = s.nome.toLowerCase()
    // Receita: atendimentos legados + movimentações financeiras vinculadas à categoria do serviço
    const catId = catPorServico.get(s.id)
    const receitaFin = catId ? (receitaFinPorCategoria.get(catId) ?? 0) : 0
    const receita = (receitaAtendPorServico.get(nomeKey) ?? 0) + receitaFin
    const qtd = qtdPorServico.get(nomeKey) ?? 0

    let custo = 0
    for (const al of sAlocacoes) {
      if (al.tipo_alocacao === 'percentual_custo') {
        const custoCat = custosPorCategoria.get(al.categoria_id) ?? 0
        custo += Math.round((custoCat * al.valor) / 100)
      } else if (al.tipo_alocacao === 'percentual_receita') {
        custo += Math.round((receita * al.valor) / 100)
      } else if (al.tipo_alocacao === 'valor_fixo_unidade') {
        custo += al.valor * qtd
      }
    }

    const margem = receita > 0 ? ((receita - custo) / receita) * 100 : null

    return { servico: s, alocacoes: sAlocacoes, receitaHistorica: receita, qtdAtendimentos: qtd, custoAlocado: custo, margem }
  })

  return (
    <ProdutosList
      produtos={produtos}
      categorias={catsList}
      alocacoes={alocList}
      mesLabel={`${hoje.toLocaleString('pt-BR', { month: 'long' })} ${hoje.getFullYear()}`}
    />
  )
}
