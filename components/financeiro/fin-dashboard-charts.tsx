'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { formatarMoeda } from '@/lib/utils'
import type { FinChartMes, FinCategoriaPie } from '@/types'

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f87171', '#a78bfa']

interface FinDashboardChartsProps {
  chartMeses: FinChartMes[]
  chartCategorias: FinCategoriaPie[]
}

function moedaAbrev(v: number) {
  if (Math.abs(v) >= 100000) return `R$ ${(v / 100000).toFixed(0)}k`
  if (Math.abs(v) >= 1000) return `R$ ${(v / 100000).toFixed(1)}k`
  return formatarMoeda(v)
}

export default function FinDashboardCharts({ chartMeses, chartCategorias }: FinDashboardChartsProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Receita vs Despesa — últimos 6 meses */}
      <div className="card lg:col-span-2">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Receita vs Despesa — últimos 6 meses</h3>
        {chartMeses.every(m => m.receita === 0 && m.despesa === 0) ? (
          <div className="h-52 flex items-center justify-center text-slate-400 text-sm">
            Nenhum dado registrado ainda.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartMeses} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v / 100).toFixed(0)}`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number, name: string) => [formatarMoeda(v), name]}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="receita" name="Receita" fill="#4ade80" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="despesa" name="Despesa" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Despesas por categoria — mês atual */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Despesas por categoria</h3>
        {chartCategorias.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-slate-400 text-sm text-center">
            Sem despesas no mês atual.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={chartCategorias}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  dataKey="valor"
                  nameKey="nome"
                >
                  {chartCategorias.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [formatarMoeda(v)]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {chartCategorias.slice(0, 5).map((c, i) => (
                <div key={c.nome} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="flex-1 truncate text-slate-600">{c.nome}</span>
                  <span className="font-medium text-slate-700">{formatarMoeda(c.valor)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
