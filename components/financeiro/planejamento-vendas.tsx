'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Users, TrendingUp, Heart, CalendarCheck, UserX, Loader2, TrendingDown } from 'lucide-react'
import type { Servico, FinPlanejamentoVenda } from '@/types'
import PlanejamentoVendasModal from './planejamento-vendas-modal'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const CORES_SERVICO = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#f87171', '#a78bfa',
  '#34d399', '#fb923c', '#60a5fa', '#f472b6',
]

interface AgendamentoRaw {
  paciente_id: string | null
  servico_nome: string | null
  status: string
  data: string
  hora_inicio: string
  hora_fim: string
}

interface CarteiraRaw {
  recencia_dias: number | null
}

interface ConfigRetornoRaw {
  idade_min_dias: number
  idade_max_dias: number | null
  retorno_dias: number
}

interface AgendaConfigRaw {
  hora_inicio: string
  hora_fim: string
  dias_ativos: number[]
}

interface PlanoConsultaRaw {
  id: string
  servico_nome: string | null
  data_sugerida: string | null
}

interface SparkPoint { v: number }

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function getRetornoIdeal(diasVida: number, config: ConfigRetornoRaw[]): number {
  for (const c of config) {
    if (diasVida >= c.idade_min_dias && (c.idade_max_dias == null || diasVida < c.idade_max_dias)) {
      return c.retorno_dias
    }
  }
  return config[config.length - 1]?.retorno_dias ?? 180
}

function diasUteisNoMes(ano: number, mes: number, diasAtivos: number[]): number {
  const ultimo = new Date(ano, mes, 0).getDate()
  let count = 0
  for (let d = 1; d <= ultimo; d++) {
    if (diasAtivos.includes(new Date(ano, mes - 1, d).getDay())) count++
  }
  return count
}

// Retorna os últimos N meses como strings YYYY-MM (do mais antigo para o mais recente)
function ultimosMeses(n: number): string[] {
  const hoje = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - (n - 1 - i), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

function parseMesAno(m: string): { ano: number; mes: number } {
  const [a, me] = m.split('-').map(Number)
  return { ano: a, mes: me }
}

// ── Sparkline SVG com números ──────────────────────────────────────

function Sparkline({ data, stroke }: { data: SparkPoint[]; stroke: string }) {
  if (data.length < 2) return null
  const allZero = data.every(d => d.v === 0)
  if (allZero) return null

  const W = 120
  const H = 52
  const padX = 14
  const padYTop = 16   // espaço para o número acima do ponto
  const padYBot = 4

  const n = data.length
  const vals = data.map(d => d.v)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const range = maxV - minV || 1

  // Coordenadas dos pontos
  const pts = vals.map((v, i) => ({
    x: padX + (i / (n - 1)) * (W - padX * 2),
    y: padYTop + (1 - (v - minV) / range) * (H - padYTop - padYBot),
    v,
  }))

  // Polyline path
  const polyline = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  // Área preenchida (gradient)
  const area = `${polyline} L${pts[n-1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`

  const gradId = `sg-${stroke.replace('#', '')}`

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} overflow="visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Área */}
      <path d={area} fill={`url(#${gradId})`} />

      {/* Linha */}
      <path d={polyline} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Pontos + números */}
      {pts.map((p, i) => {
        const isLast = i === n - 1
        const isHighest = p.v === maxV
        return (
          <g key={i}>
            {/* Ponto */}
            <circle cx={p.x} cy={p.y} r={isLast ? 3 : 2} fill={stroke} opacity={isLast ? 1 : 0.55} />

            {/* Número acima */}
            <text
              x={p.x}
              y={p.y - 5}
              textAnchor="middle"
              fontSize={isLast || isHighest ? 9 : 8}
              fontWeight={isLast ? '700' : '500'}
              fill={isLast ? stroke : '#94a3b8'}
            >
              {p.v}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function TrendBadge({ data }: { data: SparkPoint[] }) {
  if (data.length < 2) return null
  const first = data[0].v
  const last  = data[data.length - 1].v
  if (first === 0 && last === 0) return null
  const up = last >= first
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up
        ? <TrendingUp className="w-3 h-3" />
        : <TrendingDown className="w-3 h-3" />}
      {first > 0 ? `${last > first ? '+' : ''}${Math.round(((last - first) / first) * 100)}%` : ''}
    </span>
  )
}

// ── KPI Card ───────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color?: string
  strokeColor?: string
  sparkData?: SparkPoint[]
}

function KpiCard({ icon, label, value, sub, color = 'text-brand-600', strokeColor = '#6366f1', sparkData }: KpiCardProps) {
  const hasSpark = sparkData && sparkData.length >= 2 && !sparkData.every(d => d.v === 0)
  return (
    <div className="card flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className={color}>{icon}</span>
        <p className="text-xs text-slate-500 font-medium leading-tight">{label}</p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
          {sub && <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{sub}</p>}
          {hasSpark && <div className="mt-1"><TrendBadge data={sparkData!} /></div>}
        </div>
        {hasSpark && (
          <div className="flex-shrink-0 opacity-80">
            <Sparkline data={sparkData!} stroke={strokeColor} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────

export default function PlanejamentoVendas() {
  const supabase = createClient()
  const hoje = new Date()
  const anoAtual = hoje.getFullYear()
  const mesAtual = hoje.getMonth() + 1

  const [loading, setLoading]             = useState(true)
  const [modalAberto, setModalAberto]     = useState(false)
  const [servicos, setServicos]           = useState<Servico[]>([])
  const [agendamentos, setAgendamentos]   = useState<AgendamentoRaw[]>([])
  const [planejadas, setPlanejadas]       = useState<PlanoConsultaRaw[]>([])
  const [carteira, setCarteira]           = useState<CarteiraRaw[]>([])
  const [configRetorno, setConfigRetorno] = useState<ConfigRetornoRaw[]>([])
  const [agendaConfig, setAgendaConfig]   = useState<AgendaConfigRaw | null>(null)
  const [planejamento, setPlanejamento]   = useState<FinPlanejamentoVenda[]>([])

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      const quatroAtras = new Date(hoje)
      quatroAtras.setMonth(quatroAtras.getMonth() - 11)
      quatroAtras.setDate(1)
      const inicio = quatroAtras.toISOString().slice(0, 10)

      const [
        { data: svcs },
        { data: ags },
        { data: plan },
        { data: cart },
        { data: cfgRet },
        { data: cfgAg },
        { data: planej },
      ] = await Promise.all([
        supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
        supabase.from('agendamentos')
          .select('paciente_id, servico_nome, status, data, hora_inicio, hora_fim')
          .gte('data', inicio),
        supabase.from('plano_consultas').select('id, servico_nome, data_sugerida').eq('realizada', false),
        supabase.from('carteira').select('recencia_dias').not('recencia_dias', 'is', null),
        supabase.from('carteira_config_retorno').select('*').order('idade_min_dias'),
        supabase.from('agenda_config').select('*').maybeSingle(),
        supabase.from('fin_planejamento_vendas').select('*').eq('ano', anoAtual),
      ])

      setServicos((svcs ?? []) as Servico[])
      setAgendamentos((ags ?? []) as AgendamentoRaw[])
      setPlanejadas((plan ?? []) as PlanoConsultaRaw[])
      setCarteira((cart ?? []) as CarteiraRaw[])
      setConfigRetorno((cfgRet ?? []) as ConfigRetornoRaw[])
      setAgendaConfig(cfgAg as AgendaConfigRaw | null)
      setPlanejamento((planej ?? []) as FinPlanejamentoVenda[])
      setLoading(false)
    }
    fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── KPIs do mês atual ────────────────────────────────────────────

  const kpis = useMemo(() => {
    const mesStr = `${anoAtual}-${String(mesAtual).padStart(2, '0')}`
    const ags_realizados = agendamentos.filter(a => a.status === 'realizado')
    const ags_mes        = agendamentos.filter(a => a.data.startsWith(mesStr))
    const realizados_mes = ags_mes.filter(a => a.status === 'realizado')
    const faltou_mes     = ags_mes.filter(a => a.status === 'faltou')

    const idsAnteriores = new Set(
      ags_realizados.filter(a => !a.data.startsWith(mesStr)).map(a => a.paciente_id).filter(Boolean)
    )
    const novosPacientes = realizados_mes.filter(a => a.paciente_id && !idsAnteriores.has(a.paciente_id)).length

    const diasAtivos   = agendaConfig?.dias_ativos ?? [1, 2, 3, 4, 5, 6]
    const horaInicioMin = timeToMin(agendaConfig?.hora_inicio ?? '07:00')
    const horaFimMin    = timeToMin(agendaConfig?.hora_fim    ?? '20:00')
    const slotsPerDia   = Math.floor((horaFimMin - horaInicioMin) / 30)
    const diasUteis     = diasUteisNoMes(anoAtual, mesAtual, diasAtivos)
    const capacidade    = diasUteis * slotsPerDia
    const ocupacao      = capacidade > 0 ? Math.round((realizados_mes.length / capacidade) * 100) : 0

    let fidelidadeOk = 0
    for (const p of carteira) {
      if (p.recencia_dias == null) continue
      const ideal = getRetornoIdeal(p.recencia_dias, configRetorno)
      if (p.recencia_dias <= ideal) fidelidadeOk++
    }
    const fidelidade = carteira.length > 0 ? Math.round((fidelidadeOk / carteira.length) * 100) : 0

    const totalMes       = realizados_mes.length + faltou_mes.length
    const noShow         = totalMes > 0 ? Math.round((faltou_mes.length / totalMes) * 100) : 0
    const totalRealizados = ags_realizados.filter(a => a.data.startsWith(mesStr)).length

    return { novosPacientes, ocupacao, fidelidade, consultasPlanejadas: planejadas.length, noShow, totalRealizados, capacidade }
  }, [agendamentos, carteira, configRetorno, agendaConfig, planejadas, anoAtual, mesAtual])

  // ── Sparklines: últimos 4 meses ──────────────────────────────────

  const sparklines = useMemo(() => {
    const meses4 = ultimosMeses(4) // ex: ['2025-01','2025-02','2025-03','2025-04']
    const diasAtivos    = agendaConfig?.dias_ativos ?? [1, 2, 3, 4, 5, 6]
    const horaInicioMin = timeToMin(agendaConfig?.hora_inicio ?? '07:00')
    const horaFimMin    = timeToMin(agendaConfig?.hora_fim    ?? '20:00')
    const slotsPerDia   = Math.floor((horaFimMin - horaInicioMin) / 30)

    const ags_realizados = agendamentos.filter(a => a.status === 'realizado')

    // Acumula pacientes vistos mês a mês para cálculo de "novos"
    const idsSeen = new Set<string>()
    // Precisamos ordenar os meses em ordem cronológica; os 4 meses já estão do mais antigo ao mais recente
    // Mas queremos incluir meses anteriores ao range para contar "já vistos"
    // Usamos todos os realizados antes do primeiro mês do range
    const [primMes] = meses4
    for (const a of ags_realizados) {
      if (a.data.slice(0, 7) < primMes && a.paciente_id) idsSeen.add(a.paciente_id)
    }

    const sparkNovos: SparkPoint[]   = []
    const sparkOcupacao: SparkPoint[] = []
    const sparkRetorno: SparkPoint[]  = []

    for (const mesISO of meses4) {
      const { ano, mes } = parseMesAno(mesISO)
      const realizadosMes = ags_realizados.filter(a => a.data.startsWith(mesISO))

      // Novos pacientes no mês
      let novos = 0
      for (const a of realizadosMes) {
        if (a.paciente_id && !idsSeen.has(a.paciente_id)) {
          novos++
          idsSeen.add(a.paciente_id)
        }
      }
      sparkNovos.push({ v: novos })

      // Taxa de ocupação no mês
      const diasUteis  = diasUteisNoMes(ano, mes, diasAtivos)
      const capacidade = diasUteis * slotsPerDia
      const ocupacao   = capacidade > 0 ? Math.round((realizadosMes.length / capacidade) * 100) : 0
      sparkOcupacao.push({ v: ocupacao })

      // Taxa de retorno mensal: pacientes únicos com consulta no mês / total já visto até então
      const uniquesMes = new Set(realizadosMes.map(a => a.paciente_id).filter(Boolean))
      const totalVisto = idsSeen.size
      const retorno = totalVisto > 0 ? Math.round((uniquesMes.size / totalVisto) * 100) : 0
      sparkRetorno.push({ v: retorno })
    }

    return { sparkNovos, sparkOcupacao, sparkRetorno }
  }, [agendamentos, agendaConfig])

  // ── Gráfico de barras: histórico 12 meses ────────────────────────

  const { chartData, nomesServicos } = useMemo(() => {
    const realizados = agendamentos.filter(a => a.status === 'realizado')
    const meses = ultimosMeses(12)

    const svcsSet = new Set<string>()
    for (const a of realizados) { if (a.servico_nome) svcsSet.add(a.servico_nome) }
    const nomesServicos = Array.from(svcsSet).sort()

    const map: Record<string, Record<string, number>> = {}
    for (const a of realizados) {
      const mes = a.data.slice(0, 7)
      if (!meses.includes(mes)) continue
      const svc = a.servico_nome ?? 'Sem serviço'
      if (!map[mes]) map[mes] = {}
      map[mes][svc] = (map[mes][svc] ?? 0) + 1
    }

    const chartData = meses.map(m => {
      const [ano, mes] = m.split('-')
      const label = `${MESES_ABREV[parseInt(mes) - 1]}/${ano.slice(2)}`
      const row: Record<string, string | number> = { mes: label }
      for (const s of nomesServicos) row[s] = map[m]?.[s] ?? 0
      return row
    })

    return { chartData, nomesServicos }
  }, [agendamentos])

  // ── Realizado por serviço/mês para o modal ───────────────────────

  const realizadoMap = useMemo(() => {
    const map: Record<string, Record<number, number>> = {}
    for (const a of agendamentos) {
      if (a.status !== 'realizado') continue
      const svc = a.servico_nome ?? ''
      const mes = parseInt(a.data.split('-')[1])
      if (!map[svc]) map[svc] = {}
      map[svc][mes] = (map[svc][mes] ?? 0) + 1
    }
    return map
  }, [agendamentos])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    )
  }

  const mesLabel = MESES_ABREV[mesAtual - 1]

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={<Users className="w-4 h-4" />}
          label="Novos pacientes"
          value={kpis.novosPacientes}
          sub={`em ${mesLabel}/${anoAtual}`}
          color="text-brand-600"
          strokeColor="#6366f1"
          sparkData={sparklines.sparkNovos}
        />
        <KpiCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Taxa de ocupação"
          value={`${kpis.ocupacao}%`}
          sub={`${kpis.totalRealizados} de ${kpis.capacidade} slots`}
          color="text-emerald-600"
          strokeColor="#10b981"
          sparkData={sparklines.sparkOcupacao}
        />
        <KpiCard
          icon={<Heart className="w-4 h-4" />}
          label="Índice de fidelidade"
          value={`${kpis.fidelidade}%`}
          sub="carteira dentro do prazo"
          color="text-pink-600"
          strokeColor="#ec4899"
          sparkData={sparklines.sparkRetorno}
        />
        <KpiCard
          icon={<CalendarCheck className="w-4 h-4" />}
          label="Consultas planejadas"
          value={kpis.consultasPlanejadas}
          sub="agendamentos futuros em planos"
          color="text-violet-600"
        />
        <KpiCard
          icon={<UserX className="w-4 h-4" />}
          label="Taxa de no-show"
          value={`${kpis.noShow}%`}
          sub={`em ${mesLabel}/${anoAtual}`}
          color="text-amber-600"
        />
      </div>

      {/* Gráfico + botão */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">
            Histórico de Atendimentos — últimos 12 meses
          </h3>
          <button onClick={() => setModalAberto(true)} className="btn-primary text-sm">
            Planejar Vendas
          </button>
        </div>

        {chartData.every(row => nomesServicos.every(s => !row[s])) ? (
          <div className="h-52 flex items-center justify-center text-slate-400 text-sm">
            Nenhum atendimento realizado nos últimos 12 meses
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              {nomesServicos.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {nomesServicos.map((s, i) => (
                <Bar
                  key={s}
                  dataKey={s}
                  stackId="a"
                  fill={CORES_SERVICO[i % CORES_SERVICO.length]}
                  radius={i === nomesServicos.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {modalAberto && (
        <PlanejamentoVendasModal
          servicos={servicos}
          planejamento={planejamento}
          realizadoMap={realizadoMap}
          anoInicial={anoAtual}
          onClose={() => setModalAberto(false)}
          onSaved={novosPlanej => setPlanejamento(novosPlanej)}
        />
      )}
    </div>
  )
}
