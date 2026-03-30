import { createClient } from '@/lib/supabase/server'
import { formatarMoeda } from '@/lib/utils'
import { cn } from '@/lib/utils'
import FinDashboardCharts from '@/components/financeiro/fin-dashboard-charts'
import { TrendingUp, TrendingDown, DollarSign, BarChart2, Minus, AlertTriangle } from 'lucide-react'
import type { FinMovimentacao, FinKpis, FinChartMes, FinCategoriaPie } from '@/types'

export const revalidate = 0

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function computarKpis(movs: FinMovimentacao[]): FinKpis {
  const realizadas = movs.filter(m => m.data_caixa !== null)
  const receita = realizadas.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0)
  const despesa = realizadas.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0)
  const fixos = realizadas.filter(m => m.tipo === 'saida' && m.categoria?.classificacao === 'fixo').reduce((s, m) => s + m.valor, 0)
  const variaveis = realizadas.filter(m => m.tipo === 'saida' && m.categoria?.classificacao === 'variavel').reduce((s, m) => s + m.valor, 0)
  const lucro = receita - despesa
  const margem = receita > 0 ? (lucro / receita) * 100 : 0
  const mc = receita > 0 ? (receita - variaveis) / receita : 0
  const pe = mc > 0 ? Math.round(fixos / mc) : 0

  return {
    receita_total: receita,
    despesa_total: despesa,
    lucro_liquido: lucro,
    margem_liquida: margem,
    custos_fixos: fixos,
    custos_variaveis: variaveis,
    ponto_equilibrio_receita: pe,
    total_entradas: realizadas.filter(m => m.tipo === 'entrada').length,
    total_saidas: realizadas.filter(m => m.tipo === 'saida').length,
  }
}

export default async function FinanceiroDashboard() {
  const supabase = createClient()

  // Últimos 6 meses
  const hoje = new Date()
  const mesesInfo: { ano: number; mes: number; label: string; key: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const ano = d.getFullYear()
    const mes = d.getMonth() + 1
    mesesInfo.push({
      ano, mes,
      label: MESES_PT[d.getMonth()],
      key: `${ano}-${String(mes).padStart(2, '0')}`,
    })
  }

  const dataInicio = `${mesesInfo[0].key}-01`

  const { data: todasMovs } = await supabase
    .from('fin_movimentacoes')
    .select('*, categoria:fin_categorias(nome, tipo, classificacao)')
    .gte('data_competencia', dataInicio)
    .order('data_competencia', { ascending: false })

  const movs = (todasMovs ?? []) as FinMovimentacao[]

  // KPIs do mês atual (regime caixa)
  const mesAtualKey = mesesInfo[5].key
  const movsDoMes = movs.filter(m => m.data_caixa?.startsWith(mesAtualKey))
  const kpis = computarKpis(movsDoMes)

  // Dados do mês anterior para comparação
  const mesAnteriorKey = mesesInfo[4].key
  const movsAnterior = movs.filter(m => m.data_caixa?.startsWith(mesAnteriorKey))
  const kpisAnterior = computarKpis(movsAnterior)

  // Chart: 6 meses
  const chartMeses: FinChartMes[] = mesesInfo.map(({ key, label }) => {
    const mMovs = movs.filter(m => m.data_caixa?.startsWith(key))
    const receita = mMovs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0)
    const despesa = mMovs.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0)
    return { mes: label, receita, despesa, lucro: receita - despesa }
  })

  // Chart: Categorias do mês atual
  const despesasDoMes = movsDoMes.filter(m => m.tipo === 'saida' && m.data_caixa)
  const catMap = new Map<string, number>()
  for (const m of despesasDoMes) {
    const nome = m.categoria?.nome ?? 'Sem categoria'
    catMap.set(nome, (catMap.get(nome) ?? 0) + m.valor)
  }
  const chartCategorias: FinCategoriaPie[] = Array.from(catMap.entries())
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor)

  // Movimentações recentes (últimas 5)
  const recentes = movs.slice(0, 5)

  function delta(atual: number, anterior: number) {
    if (anterior === 0) return null
    return ((atual - anterior) / anterior) * 100
  }

  function KpiCard({
    label, valor, sub, delta: d, cor, icon: Icon
  }: {
    label: string
    valor: string
    sub?: string
    delta?: number | null
    cor: string
    icon: React.ElementType
  }) {
    return (
      <div className="card">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', cor)}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <p className="text-xl font-bold text-slate-800">{valor}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        {d != null && (
          <p className={cn('text-xs mt-1 font-medium', d >= 0 ? 'text-emerald-600' : 'text-red-500')}>
            {d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}% vs mês anterior
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Receita (mês)"
          valor={formatarMoeda(kpis.receita_total)}
          delta={delta(kpis.receita_total, kpisAnterior.receita_total)}
          cor="bg-emerald-100 text-emerald-600"
          icon={TrendingUp}
        />
        <KpiCard
          label="Despesas (mês)"
          valor={formatarMoeda(kpis.despesa_total)}
          delta={delta(kpis.despesa_total, kpisAnterior.despesa_total)}
          cor="bg-red-100 text-red-600"
          icon={TrendingDown}
        />
        <KpiCard
          label="Lucro Líquido"
          valor={formatarMoeda(kpis.lucro_liquido)}
          sub={`Margem: ${kpis.margem_liquida.toFixed(1)}%`}
          cor={kpis.lucro_liquido >= 0 ? 'bg-brand-100 text-brand-600' : 'bg-red-100 text-red-600'}
          icon={DollarSign}
        />
        <KpiCard
          label="Ponto de Equilíbrio"
          valor={kpis.ponto_equilibrio_receita > 0 ? formatarMoeda(kpis.ponto_equilibrio_receita) : '—'}
          sub={kpis.ponto_equilibrio_receita > 0 && kpis.receita_total > 0
            ? kpis.receita_total >= kpis.ponto_equilibrio_receita
              ? '✓ Superado'
              : `Faltam ${formatarMoeda(kpis.ponto_equilibrio_receita - kpis.receita_total)}`
            : 'Cadastre categorias'}
          cor="bg-amber-100 text-amber-600"
          icon={BarChart2}
        />
      </div>

      {/* Detalhes financeiros */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Custos Fixos', valor: formatarMoeda(kpis.custos_fixos), cor: 'text-slate-700' },
          { label: 'Custos Variáveis', valor: formatarMoeda(kpis.custos_variaveis), cor: 'text-slate-700' },
          { label: 'Entradas', valor: `${kpis.total_entradas} lançamentos`, cor: 'text-emerald-700' },
          { label: 'Saídas', valor: `${kpis.total_saidas} lançamentos`, cor: 'text-red-700' },
        ].map(item => (
          <div key={item.label} className="card py-3">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className={cn('text-sm font-semibold mt-0.5', item.cor)}>{item.valor}</p>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <FinDashboardCharts chartMeses={chartMeses} chartCategorias={chartCategorias} />

      {/* Movimentações recentes */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Lançamentos Recentes</h3>
        {recentes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">
            Nenhum lançamento ainda. Acesse <strong>Movimentações</strong> para começar.
          </p>
        ) : (
          <div className="space-y-2">
            {recentes.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold',
                  m.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                )}>
                  {m.tipo === 'entrada' ? '↑' : '↓'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{m.descricao}</p>
                  <p className="text-xs text-slate-400">{m.categoria?.nome ?? 'Sem categoria'} · {m.data_competencia}</p>
                </div>
                <span className={cn('text-sm font-semibold', m.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600')}>
                  {m.tipo === 'entrada' ? '+' : '-'}{formatarMoeda(m.valor)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
