'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Power } from 'lucide-react'
import PagamentoForm from './pagamento-form'
import type { PlanoPagamento, PlanoPagamentoTipo } from '@/types'

const TIPO_LABELS: Record<PlanoPagamentoTipo, { label: string; color: string }> = {
  desconto_fixo: { label: 'Desconto Fixo',  color: 'bg-blue-50 text-blue-700'     },
  cashback:      { label: 'Cashback',        color: 'bg-purple-50 text-purple-700' },
  personalizado: { label: 'Personalizado',   color: 'bg-slate-100 text-slate-600'  },
}

interface PagamentoListProps {
  planos: PlanoPagamento[]
}

export default function PagamentoList({ planos: initial }: PagamentoListProps) {
  const supabase = createClient()
  const [planos, setPlanos] = useState(initial)
  const [form, setForm] = useState<{ open: boolean; plano: PlanoPagamento | null }>({ open: false, plano: null })

  async function reload() {
    const { data } = await supabase.from('planos_pagamento').select('*').order('nome')
    if (data) setPlanos(data as PlanoPagamento[])
    setForm({ open: false, plano: null })
  }

  async function toggleAtivo(p: PlanoPagamento) {
    await supabase.from('planos_pagamento').update({ ativo: !p.ativo }).eq('id', p.id)
    setPlanos(prev => prev.map(x => x.id === p.id ? { ...x, ativo: !p.ativo } : x))
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Planos de Pagamento</h2>
          <p className="text-sm text-slate-500 mt-0.5">Defina as regras financeiras disponíveis para os planos</p>
        </div>
        <button className="btn-primary" onClick={() => setForm({ open: true, plano: null })}>
          <Plus className="w-4 h-4" /> Novo Plano
        </button>
      </div>

      {planos.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-sm">Nenhum plano de pagamento cadastrado ainda.</p>
          <p className="text-xs mt-1">Clique em "Novo Plano" para começar.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Nome</th>
                <th className="table-th">Tipo</th>
                <th className="table-th">Percentual</th>
                <th className="table-th">Descrição</th>
                <th className="table-th">Status</th>
                <th className="table-th text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {planos.map(p => {
                const tipo = TIPO_LABELS[p.tipo]
                return (
                  <tr key={p.id} className={!p.ativo ? 'opacity-50' : ''}>
                    <td className="table-td font-medium text-slate-800">{p.nome}</td>
                    <td className="table-td">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tipo.color}`}>
                        {tipo.label}
                      </span>
                    </td>
                    <td className="table-td text-slate-600">
                      {p.percentual != null ? `${p.percentual}%` : '—'}
                    </td>
                    <td className="table-td text-slate-500 max-w-xs truncate">
                      {p.descricao ?? '—'}
                    </td>
                    <td className="table-td">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        p.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setForm({ open: true, plano: p })}
                          className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleAtivo(p)}
                          className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                          title={p.ativo ? 'Desativar' : 'Ativar'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {form.open && (
        <PagamentoForm
          plano={form.plano}
          onClose={() => setForm({ open: false, plano: null })}
          onSaved={reload}
        />
      )}
    </div>
  )
}
