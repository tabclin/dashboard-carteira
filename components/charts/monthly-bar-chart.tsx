'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { getMesLabel } from '@/lib/utils'
import type { AtendimentoMes } from '@/types'

interface MonthlyBarChartProps {
  data: AtendimentoMes[]
  mostrar?: 'faturamento' | 'quantidade'
}

function formatarValorY(valor: number): string {
  if (valor >= 100000) return `R$ ${(valor / 100000).toFixed(1)}k`
  if (valor >= 1000)   return `R$ ${(valor / 1000).toFixed(0)}k`
  return `R$ ${valor}`
}

export default function MonthlyBarChart({ data, mostrar = 'faturamento' }: MonthlyBarChartProps) {
  const chartData = data
    .slice()
    .reverse()
    .map(d => ({
      ...d,
      mesLabel: getMesLabel(d.mes),
    }))

  const isFaturamento = mostrar === 'faturamento'

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="mesLabel"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={isFaturamento ? formatarValorY : undefined}
          width={isFaturamento ? 60 : 30}
        />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
          formatter={(value: number) =>
            isFaturamento
              ? [`R$ ${(value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Faturamento']
              : [`${value} atendimentos`, 'Quantidade']
          }
        />
        <Bar
          dataKey={isFaturamento ? 'faturamento' : 'quantidade'}
          fill="#0ea5e9"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
