'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatarMoeda } from '@/lib/utils'
import { Plus, Pencil, Power } from 'lucide-react'
import ServicoForm from './servico-form'
import type { Servico } from '@/types'

interface ServicosListProps {
  servicos: Servico[]
  somenteLeitura?: boolean
}

export default function ServicosList({ servicos: initial, somenteLeitura }: ServicosListProps) {
  const supabase = createClient()
  const [servicos, setServicos] = useState(initial)
  const [form, setForm] = useState<{ open: boolean; servico: Servico | null }>({ open: false, servico: null })

  async function reload() {
    const { data } = await supabase
      .from('servicos')
      .select('*')
      .order('nome')
    if (data) setServicos(data as Servico[])
    setForm({ open: false, servico: null })
  }

  async function toggleAtivo(s: Servico) {
    await supabase.from('servicos').update({ ativo: !s.ativo }).eq('id', s.id)
    setServicos(prev => prev.map(x => x.id === s.id ? { ...x, ativo: !s.ativo } : x))
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Catálogo de Serviços</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {somenteLeitura
              ? 'Para criar novos serviços, acesse Financeiro > Produtos.'
              : 'Defina os serviços disponíveis para compor os planos'}
          </p>
        </div>
        {!somenteLeitura && (
          <button className="btn-primary" onClick={() => setForm({ open: true, servico: null })}>
            <Plus className="w-4 h-4" /> Novo Serviço
          </button>
        )}
      </div>

      {servicos.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-sm">Nenhum serviço cadastrado ainda.</p>
          <p className="text-xs mt-1">Clique em "Novo Serviço" para começar.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Serviço</th>
                <th className="table-th">Valor Cheio</th>
                <th className="table-th">Valor Recorrente</th>
                <th className="table-th">Antecedência</th>
                <th className="table-th">Status</th>
                <th className="table-th text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {servicos.map(s => (
                <tr key={s.id} className={!s.ativo ? 'opacity-50' : ''}>
                  <td className="table-td">
                    <p className="font-medium text-slate-800">{s.nome}</p>
                    {s.descricao && <p className="text-xs text-slate-400 mt-0.5">{s.descricao}</p>}
                  </td>
                  <td className="table-td font-medium text-slate-800">
                    {formatarMoeda(s.valor_cheio)}
                  </td>
                  <td className="table-td text-slate-500">
                    {s.valor_recorrente != null ? formatarMoeda(s.valor_recorrente) : '—'}
                  </td>
                  <td className="table-td text-slate-500">
                    {s.antecedencia_dias} dias
                  </td>
                  <td className="table-td">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      s.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {s.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="table-td">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setForm({ open: true, servico: s })}
                        className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleAtivo(s)}
                        className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                        title={s.ativo ? 'Desativar' : 'Ativar'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form.open && (
        <ServicoForm
          servico={form.servico}
          onClose={() => setForm({ open: false, servico: null })}
          onSaved={reload}
        />
      )}
    </div>
  )
}
