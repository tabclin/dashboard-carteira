'use client'

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface StatusPieChartProps {
  ok: number
  atencao: number
  perigo: number
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444']
const RADIAN = Math.PI / 180

function renderCustomizedLabel({
  cx, cy, midAngle, innerRadius, outerRadius, percent,
}: any) {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  if (percent < 0.05) return null

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
          className="text-xs font-semibold" style={{ fontSize: 12, fontWeight: 600 }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function StatusPieChart({ ok, atencao, perigo }: StatusPieChartProps) {
  const data = [
    { name: 'Ok',      value: ok      },
    { name: 'Atenção', value: atencao },
    { name: 'Perigo',  value: perigo  },
  ].filter(d => d.value > 0)

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomizedLabel}
          outerRadius={100}
          innerRadius={40}
          dataKey="value"
          strokeWidth={2}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [`${value} pacientes`, '']}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            fontSize: 12,
          }}
        />
        <Legend
          formatter={(value) => <span style={{ fontSize: 12, color: '#475569' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
