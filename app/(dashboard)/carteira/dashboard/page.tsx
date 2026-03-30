import { createClient } from '@/lib/supabase/server'
import KpiCard from '@/components/kpi-card'
import StatusPieChart from '@/components/charts/status-pie-chart'
import MonthlyBarChart from '@/components/charts/monthly-bar-chart'
import AgeRangeChart from '@/components/charts/age-range-chart'
import type { AtendimentoMes, FaixaEtaria } from '@/types'
import { Users, CheckCircle, AlertTriangle, AlertOctagon, TrendingUp, Activity } from 'lucide-react'

export const revalidate = 60

async function getDashboardData() {
  const supabase = createClient()

  // KPIs de status da carteira
  const { data: statusData } = await supabase
    .from('carteira')
    .select('status')

  const total = statusData?.length ?? 0
  const ok      = statusData?.filter(r => r.status === 'Ok').length      ?? 0
  const atencao = statusData?.filter(r => r.status === 'Atenção').length ?? 0
  const perigo  = statusData?.filter(r => r.status === 'Perigo').length  ?? 0

  // Faturamento por mês (últimos 12 meses)
  const { data: atendData } = await supabase
    .from('atendimentos')
    .select('data_atendimento, valor')
    .not('valor', 'is', null)

  // Agrupar por mês manualmente
  const porMes: Record<string, { faturamento: number; quantidade: number }> = {}
  for (const row of atendData ?? []) {
    if (!row.data_atendimento || !row.valor) continue
    const parts = String(row.data_atendimento).split('/')
    if (parts.length !== 3) continue
    const [day, month, year] = parts
    const mes = `${year}-${month}`
    if (!porMes[mes]) porMes[mes] = { faturamento: 0, quantidade: 0 }
    porMes[mes].faturamento += Number(row.valor)
    porMes[mes].quantidade += 1
  }

  const atendimentosPorMes: AtendimentoMes[] = Object.entries(porMes)
    .map(([mes, v]) => ({
      mes,
      faturamento: v.faturamento,
      quantidade: v.quantidade,
      ticket_medio: v.quantidade > 0 ? Math.round(v.faturamento / v.quantidade) : 0,
    }))
    .sort((a, b) => b.mes.localeCompare(a.mes))
    .slice(0, 12)

  const faturamentoMesAtual = atendimentosPorMes[0]?.faturamento ?? 0
  const ticketMedio = atendimentosPorMes[0]?.ticket_medio ?? 0

  // Faixas etárias
  const { data: carteiraData } = await supabase
    .from('carteira')
    .select('idade_dias')
    .not('idade_dias', 'is', null)

  const faixasMap: Record<string, number> = {
    '< 1 ano': 0, '1-2 anos': 0, '2-5 anos': 0, '5-12 anos': 0, '> 12 anos': 0,
  }
  for (const row of carteiraData ?? []) {
    const d = Number(row.idade_dias)
    if (d < 365)        faixasMap['< 1 ano']++
    else if (d < 730)   faixasMap['1-2 anos']++
    else if (d < 1825)  faixasMap['2-5 anos']++
    else if (d < 4380)  faixasMap['5-12 anos']++
    else                faixasMap['> 12 anos']++
  }
  const faixasEtarias: FaixaEtaria[] = Object.entries(faixasMap)
    .map(([faixa, total]) => ({ faixa, total }))
    .filter(f => f.total > 0)

  return {
    total, ok, atencao, perigo,
    faturamentoMesAtual,
    ticketMedio,
    atendimentosPorMes,
    faixasEtarias,
  }
}

export default async function DashboardPage() {
  const {
    total, ok, atencao, perigo,
    faturamentoMesAtual, ticketMedio,
    atendimentosPorMes, faixasEtarias,
  } = await getDashboardData()

  function formatMoeda(v: number) {
    return `R$ ${(v / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards — linha 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          titulo="Total de Pacientes"
          valor={total}
          subtitulo="na carteira ativa"
          icon={Users}
          cor="blue"
        />
        <KpiCard
          titulo="Status Ok"
          valor={ok}
          subtitulo={`${total > 0 ? Math.round((ok / total) * 100) : 0}% da carteira`}
          icon={CheckCircle}
          cor="green"
        />
        <KpiCard
          titulo="Em Atenção"
          valor={atencao}
          subtitulo="requerem acompanhamento"
          icon={AlertTriangle}
          cor="yellow"
        />
        <KpiCard
          titulo="Em Perigo"
          valor={perigo}
          subtitulo="risco de perda"
          icon={AlertOctagon}
          cor="red"
        />
      </div>

      {/* KPI Cards — linha 2 */}
      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          titulo="Faturamento do Mês"
          valor={formatMoeda(faturamentoMesAtual)}
          subtitulo="mês atual"
          icon={TrendingUp}
          cor="indigo"
        />
        <KpiCard
          titulo="Ticket Médio"
          valor={formatMoeda(ticketMedio)}
          subtitulo="por atendimento"
          icon={Activity}
          cor="blue"
        />
      </div>

      {/* Gráficos — linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Distribuição por Status</h2>
          <p className="text-xs text-slate-400 mb-4">Proporção da carteira por classificação</p>
          <StatusPieChart ok={ok} atencao={atencao} perigo={perigo} />
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Faturamento Mensal</h2>
          <p className="text-xs text-slate-400 mb-4">Últimos 12 meses</p>
          <MonthlyBarChart data={atendimentosPorMes} mostrar="faturamento" />
        </div>
      </div>

      {/* Gráficos — linha 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Atendimentos por Mês</h2>
          <p className="text-xs text-slate-400 mb-4">Quantidade de atendimentos</p>
          <MonthlyBarChart data={atendimentosPorMes} mostrar="quantidade" />
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Faixa Etária dos Pacientes</h2>
          <p className="text-xs text-slate-400 mb-4">Distribuição por idade</p>
          <AgeRangeChart data={faixasEtarias} />
        </div>
      </div>
    </div>
  )
}
