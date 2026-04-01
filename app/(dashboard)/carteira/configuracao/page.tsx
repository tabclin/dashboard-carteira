'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ConfigRetornoFaixa } from '@/types'
import { calcStatus } from '@/lib/carteira-config'
import { Pencil, Trash2, Plus, RotateCcw, Check, X, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── helpers ────────────────────────────────────────────────────────────────

function diasParaLabel(dias: number | null): string {
  if (dias == null) return '∞'
  const meses = Math.round(dias / 30.44)
  if (meses < 24) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`
  const anos = Math.floor(meses / 12)
  const m = meses % 12
  if (m === 0) return `${anos} ${anos === 1 ? 'ano' : 'anos'}`
  return `${anos}a ${m}m`
}

function mesesParaDias(meses: number): number {
  return Math.round(meses * 30.44)
}

interface FormState {
  idade_min_meses: string
  idade_max_meses: string   // empty string = sem limite
  retorno_dias: string
}

const FORM_VAZIO: FormState = { idade_min_meses: '', idade_max_meses: '', retorno_dias: '' }

const FAIXAS_PADRAO = [
  { idade_min_dias: 0,   idade_max_dias: 365,  retorno_dias: 30,  ordem: 1 },
  { idade_min_dias: 365, idade_max_dias: 730,  retorno_dias: 60,  ordem: 2 },
  { idade_min_dias: 730, idade_max_dias: null, retorno_dias: 180, ordem: 3 },
]

// ─── componente principal ────────────────────────────────────────────────────

export default function ConfiguracaoPage() {
  const supabase = createClient()

  const [faixas, setFaixas]         = useState<ConfigRetornoFaixa[]>([])
  const [loading, setLoading]       = useState(true)
  const [erro, setErro]             = useState<string | null>(null)
  const [sucesso, setSucesso]       = useState<string | null>(null)

  // form nova faixa
  const [mostrarForm, setMostrarForm] = useState(false)
  const [formNovo, setFormNovo]       = useState<FormState>(FORM_VAZIO)
  const [formErro, setFormErro]       = useState<string | null>(null)

  // edição inline
  const [editandoId, setEditandoId]   = useState<string | null>(null)
  const [formEdit, setFormEdit]       = useState<FormState>(FORM_VAZIO)
  const [editErro, setEditErro]       = useState<string | null>(null)

  // confirmação de exclusão
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  // confirmação restaurar padrão
  const [confirmandoRestore, setConfirmandoRestore] = useState(false)

  // ── fetch ────────────────────────────────────────────────────────────────

  const carregarFaixas = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('carteira_config_retorno')
      .select('*')
      .order('idade_min_dias')
    if (error) {
      setErro('Erro ao carregar configurações.')
    } else {
      setFaixas((data ?? []) as ConfigRetornoFaixa[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { carregarFaixas() }, [carregarFaixas])

  // ── validação ────────────────────────────────────────────────────────────

  function validarForm(
    form: FormState,
    ignorarId?: string
  ): string | null {
    const min_m = Number(form.idade_min_meses)
    const max_m = form.idade_max_meses !== '' ? Number(form.idade_max_meses) : null
    const ret   = Number(form.retorno_dias)

    if (!form.idade_min_meses || isNaN(min_m) || min_m < 0)
      return 'Idade mínima inválida.'
    if (max_m !== null && (isNaN(max_m) || max_m <= min_m))
      return 'Idade máxima deve ser maior que a mínima.'
    if (!form.retorno_dias || isNaN(ret) || ret < 1)
      return 'Intervalo de retorno deve ser ≥ 1 dia.'

    const min_d = mesesParaDias(min_m)
    const max_d = max_m !== null ? mesesParaDias(max_m) : null

    const sobreposicao = faixas
      .filter(f => f.id !== ignorarId)
      .find(f => {
        // f: [f.idade_min_dias, f.idade_max_dias)
        // novo: [min_d, max_d)
        const fMax = f.idade_max_dias ?? Infinity
        const nMax = max_d ?? Infinity
        return min_d < fMax && nMax > f.idade_min_dias
      })

    if (sobreposicao)
      return `Sobreposição com faixa existente: ${diasParaLabel(sobreposicao.idade_min_dias)} – ${diasParaLabel(sobreposicao.idade_max_dias)}.`

    return null
  }

  // ── adicionar ────────────────────────────────────────────────────────────

  async function adicionarFaixa() {
    setFormErro(null)
    const err = validarForm(formNovo)
    if (err) { setFormErro(err); return }

    const min_d = mesesParaDias(Number(formNovo.idade_min_meses))
    const max_d = formNovo.idade_max_meses !== ''
      ? mesesParaDias(Number(formNovo.idade_max_meses))
      : null

    const { error } = await supabase
      .from('carteira_config_retorno')
      .insert({
        idade_min_dias: min_d,
        idade_max_dias: max_d,
        retorno_dias:   Number(formNovo.retorno_dias),
        ordem:          faixas.length + 1,
      })

    if (error) {
      setFormErro(error.message.includes('unique')
        ? 'Já existe uma faixa com essa idade mínima.'
        : 'Erro ao salvar.')
    } else {
      setFormNovo(FORM_VAZIO)
      setMostrarForm(false)
      mostrarSucesso('Faixa adicionada com sucesso.')
      await carregarFaixas()
    }
  }

  // ── editar ───────────────────────────────────────────────────────────────

  function iniciarEdicao(f: ConfigRetornoFaixa) {
    setEditandoId(f.id)
    setEditErro(null)
    const min_m = Math.round(f.idade_min_dias / 30.44)
    const max_m = f.idade_max_dias != null ? Math.round(f.idade_max_dias / 30.44) : ''
    setFormEdit({
      idade_min_meses: String(min_m),
      idade_max_meses: String(max_m),
      retorno_dias:    String(f.retorno_dias),
    })
  }

  async function salvarEdicao(id: string) {
    setEditErro(null)
    const err = validarForm(formEdit, id)
    if (err) { setEditErro(err); return }

    const min_d = mesesParaDias(Number(formEdit.idade_min_meses))
    const max_d = formEdit.idade_max_meses !== ''
      ? mesesParaDias(Number(formEdit.idade_max_meses))
      : null

    const { error } = await supabase
      .from('carteira_config_retorno')
      .update({
        idade_min_dias: min_d,
        idade_max_dias: max_d,
        retorno_dias:   Number(formEdit.retorno_dias),
      })
      .eq('id', id)

    if (error) {
      setEditErro('Erro ao salvar.')
    } else {
      setEditandoId(null)
      mostrarSucesso('Faixa atualizada.')
      await carregarFaixas()
    }
  }

  // ── excluir ──────────────────────────────────────────────────────────────

  async function excluirFaixa(id: string) {
    const { error } = await supabase
      .from('carteira_config_retorno')
      .delete()
      .eq('id', id)

    if (error) {
      setErro('Erro ao excluir.')
    } else {
      setExcluindoId(null)
      mostrarSucesso('Faixa removida.')
      await carregarFaixas()
    }
  }

  // ── restaurar padrão ─────────────────────────────────────────────────────

  async function restaurarPadrao() {
    setConfirmandoRestore(false)
    // 1. Apaga tudo
    const { error: delErr } = await supabase
      .from('carteira_config_retorno')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // all rows

    if (delErr) { setErro('Erro ao restaurar.'); return }

    // 2. Insere padrões
    const { error: insErr } = await supabase
      .from('carteira_config_retorno')
      .insert(FAIXAS_PADRAO)

    if (insErr) { setErro('Erro ao inserir padrões.'); return }

    mostrarSucesso('Configuração restaurada para os padrões.')
    await carregarFaixas()
  }

  // ── util ─────────────────────────────────────────────────────────────────

  function mostrarSucesso(msg: string) {
    setSucesso(msg)
    setTimeout(() => setSucesso(null), 3000)
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl">

      {/* aviso explicativo */}
      <div className="flex gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold mb-1">Como funciona</p>
          <p>
            Defina faixas etárias e o intervalo ideal de retorno para cada uma.
            O status de cada paciente (<span className="font-semibold text-emerald-700">Ok</span>,{' '}
            <span className="font-semibold text-amber-700">Atenção</span>,{' '}
            <span className="font-semibold text-red-700">Perigo</span>) é calculado
            comparando a recência do paciente com o intervalo da sua faixa etária.
          </p>
          <ul className="mt-2 space-y-0.5 list-none">
            <li><span className="font-semibold text-emerald-700">Ok</span> — recência ≤ 2/3 do intervalo</li>
            <li><span className="font-semibold text-amber-700">Atenção</span> — recência entre 2/3 e o intervalo</li>
            <li><span className="font-semibold text-red-700">Perigo</span> — recência &gt; intervalo</li>
          </ul>
        </div>
      </div>

      {/* feedbacks */}
      {erro && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {erro}
          <button onClick={() => setErro(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {sucesso && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <Check className="w-4 h-4" />
          {sucesso}
        </div>
      )}

      {/* tabela de faixas */}
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Faixa etária</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Intervalo ideal</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="text-center py-8 text-slate-400">Carregando...</td>
              </tr>
            )}
            {!loading && faixas.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-8 text-slate-400">
                  Nenhuma faixa configurada. Clique em "+ Adicionar Faixa" ou "Restaurar padrão".
                </td>
              </tr>
            )}
            {faixas.map(f => (
              editandoId === f.id
                ? (
                  <tr key={f.id} className="border-t border-slate-100 bg-amber-50">
                    <td className="px-4 py-3" colSpan={3}>
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-3 items-end">
                          <label className="flex flex-col gap-1 text-xs text-slate-600">
                            Idade mínima (meses)
                            <input
                              type="number"
                              min="0"
                              className="w-36 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                              value={formEdit.idade_min_meses}
                              onChange={e => setFormEdit(p => ({ ...p, idade_min_meses: e.target.value }))}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs text-slate-600">
                            Idade máxima (meses) — vazio = sem limite
                            <input
                              type="number"
                              min="0"
                              placeholder="∞"
                              className="w-44 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                              value={formEdit.idade_max_meses}
                              onChange={e => setFormEdit(p => ({ ...p, idade_max_meses: e.target.value }))}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs text-slate-600">
                            Retornar em (dias)
                            <input
                              type="number"
                              min="1"
                              className="w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                              value={formEdit.retorno_dias}
                              onChange={e => setFormEdit(p => ({ ...p, retorno_dias: e.target.value }))}
                            />
                          </label>
                        </div>
                        {editErro && (
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />{editErro}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => salvarEdicao(f.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" /> Salvar
                          </button>
                          <button
                            onClick={() => { setEditandoId(null); setEditErro(null) }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" /> Cancelar
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
                : (
                  <tr key={f.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-700">
                      {diasParaLabel(f.idade_min_dias)}
                      {' '}—{' '}
                      {f.idade_max_dias != null ? diasParaLabel(f.idade_max_dias) : 'em diante'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {f.retorno_dias} dias
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {excluindoId === f.id ? (
                          <>
                            <span className="text-xs text-red-600 mr-1">Excluir?</span>
                            <button
                              onClick={() => excluirFaixa(f.id)}
                              className="px-2 py-1 rounded-md bg-red-600 text-white text-xs hover:bg-red-700 transition-colors"
                            >
                              Sim
                            </button>
                            <button
                              onClick={() => setExcluindoId(null)}
                              className="px-2 py-1 rounded-md border border-slate-300 text-slate-600 text-xs hover:bg-slate-100 transition-colors"
                            >
                              Não
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => iniciarEdicao(f)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setExcluindoId(f.id)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
            ))}
          </tbody>
        </table>
      </div>

      {/* form nova faixa */}
      {mostrarForm && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-brand-800">Nova faixa etária</p>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Idade mínima (meses)
              <input
                type="number"
                min="0"
                className="w-36 border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={formNovo.idade_min_meses}
                onChange={e => setFormNovo(p => ({ ...p, idade_min_meses: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Idade máxima (meses) — vazio = sem limite
              <input
                type="number"
                min="0"
                placeholder="∞"
                className="w-44 border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={formNovo.idade_max_meses}
                onChange={e => setFormNovo(p => ({ ...p, idade_max_meses: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Retornar em (dias)
              <input
                type="number"
                min="1"
                className="w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={formNovo.retorno_dias}
                onChange={e => setFormNovo(p => ({ ...p, retorno_dias: e.target.value }))}
              />
            </label>
          </div>
          {formErro && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />{formErro}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={adicionarFaixa}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Salvar faixa
            </button>
            <button
              onClick={() => { setMostrarForm(false); setFormNovo(FORM_VAZIO); setFormErro(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-medium hover:bg-white transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ações */}
      <div className="flex flex-wrap gap-3">
        {!mostrarForm && (
          <button
            onClick={() => { setMostrarForm(true); setFormErro(null); setFormNovo(FORM_VAZIO) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Adicionar Faixa
          </button>
        )}

        {confirmandoRestore ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-amber-700">Restaurar padrões? Isso apagará todas as faixas atuais.</span>
            <button
              onClick={restaurarPadrao}
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors"
            >
              Confirmar
            </button>
            <button
              onClick={() => setConfirmandoRestore(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-medium hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmandoRestore(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-100 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Restaurar padrão
          </button>
        )}
      </div>
    </div>
  )
}
