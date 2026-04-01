'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatarData, cn } from '@/lib/utils'
import { UserCheck, Loader2, UserX } from 'lucide-react'

interface PacienteInativo {
  paciente: string
  nascimento: string | null
  ultimo_atendimento?: string | null
  qtd_at?: number | null
}

function calcularIdade(nascimento: string | null): string {
  if (!nascimento) return ''
  const nasc = new Date(nascimento + 'T12:00:00')
  const hoje = new Date()
  const mesesTotal =
    (hoje.getFullYear() - nasc.getFullYear()) * 12 +
    (hoje.getMonth() - nasc.getMonth())
  if (mesesTotal < 0) return ''
  if (mesesTotal < 24) return `${mesesTotal} ${mesesTotal === 1 ? 'mês' : 'meses'}`
  const anos = Math.floor(mesesTotal / 12)
  const meses = mesesTotal % 12
  if (meses === 0) return `${anos} ${anos === 1 ? 'ano' : 'anos'}`
  return `${anos}a ${meses}m`
}

export default function DesativadosPage() {
  const [pacientes, setPacientes]   = useState<PacienteInativo[]>([])
  const [loading, setLoading]       = useState(true)
  const [reativando, setReativando] = useState<string | null>(null)
  const [erro, setErro]             = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    const supabase = createClient()

    // Busca inativos da tabela pacientes
    const { data: inativos, error } = await supabase
      .from('pacientes')
      .select('paciente, nascimento')
      .eq('ativo', false)
      .order('paciente')

    if (error) { setErro('Erro ao carregar pacientes desativados.'); setLoading(false); return }

    if (!inativos || inativos.length === 0) { setPacientes([]); setLoading(false); return }

    // Enriquecer com dados da carteira (último atendimento, qtd)
    const nomes = inativos.map((p: any) => p.paciente)
    const { data: carteiraData } = await supabase
      .from('carteira')
      .select('paciente, nascimento, ultimo_atendimento, qtd_at')
      .in('paciente', nomes)

    const carteiraMap = new Map<string, any>()
    for (const c of (carteiraData ?? [])) {
      carteiraMap.set(`${c.paciente}|${c.nascimento ?? ''}`, c)
    }

    const lista: PacienteInativo[] = inativos.map((p: any) => {
      const extra = carteiraMap.get(`${p.paciente}|${p.nascimento ?? ''}`)
      return {
        paciente:            p.paciente,
        nascimento:          p.nascimento,
        ultimo_atendimento:  extra?.ultimo_atendimento ?? null,
        qtd_at:              extra?.qtd_at ?? null,
      }
    })

    setPacientes(lista)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function reativar(p: PacienteInativo) {
    const key = `${p.paciente}|${p.nascimento ?? ''}`
    setReativando(key)
    const supabase = createClient()
    let query = (supabase.from('pacientes') as any).update({ ativo: true }).eq('paciente', p.paciente)
    if (p.nascimento) query = query.eq('nascimento', p.nascimento)
    else              query = query.is('nascimento', null)

    const { error } = await query
    setReativando(null)
    if (error) { setErro('Erro ao reativar paciente.'); return }
    setPacientes(prev => prev.filter(x => !(x.paciente === p.paciente && x.nascimento === p.nascimento)))
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">

      {erro && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {erro}
        </div>
      )}

      {pacientes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
          <UserX className="w-10 h-10 opacity-30" />
          <p className="text-sm">Nenhum paciente desativado.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500">{pacientes.length} {pacientes.length === 1 ? 'paciente desativado' : 'pacientes desativados'}</p>

          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="table-th">Paciente</th>
                  <th className="table-th">Último Atend.</th>
                  <th className="table-th">Consultas</th>
                  <th className="table-th" />
                </tr>
              </thead>
              <tbody>
                {pacientes.map((p, i) => {
                  const key = `${p.paciente}|${p.nascimento ?? ''}`
                  const isReativando = reativando === key

                  return (
                    <tr key={key} className={cn('border-t border-slate-100 hover:bg-slate-50/70 transition-colors opacity-60 hover:opacity-100')}>
                      <td className="table-td">
                        <p className="font-medium text-slate-700">{p.paciente}</p>
                        {p.nascimento && (
                          <p className="text-xs text-slate-400 mt-0.5 leading-none">{calcularIdade(p.nascimento)}</p>
                        )}
                      </td>

                      <td className="table-td text-slate-500">
                        {formatarData(p.ultimo_atendimento) || '—'}
                      </td>

                      <td className="table-td">
                        {p.qtd_at != null ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
                            {p.qtd_at}
                          </span>
                        ) : '—'}
                      </td>

                      <td className="table-td text-right">
                        <button
                          onClick={() => reativar(p)}
                          disabled={isReativando}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium hover:bg-emerald-100 transition-colors disabled:opacity-60"
                        >
                          {isReativando
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <UserCheck className="w-3.5 h-3.5" />}
                          Reativar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
