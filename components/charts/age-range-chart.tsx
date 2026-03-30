'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { FaixaEtaria } from '@/types'

interface AgeRangeChartProps {
  data: FaixaEtaria[]
}

const CORES = ['#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6']

export default function AgeRangeChart({ data }: AgeRangeChartProps) {
  // Ordenar faixas etárias
  const ordem = ['< 1 ano', '1-2 anos', '2-5 anos', '5-12 anos', '> 12 anos']
  const sortedData = [...data].sort((a, b) => {
    const ia = ordem.indexOf(a.faixa)
    const ib = ordem.indexOf(b.faixa)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={sortedData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="faixa"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={30}
        />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
          formatter={(value: number) => [`${value} pacientes`, 'Total']}
        />
        <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={50}>
          {sortedData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={CORES[index % CORES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
