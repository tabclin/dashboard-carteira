'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatarMoeda, formatarData } from '@/lib/utils'
import { Sparkles, CheckCircle2, AlertCircle, Loader2, FileText } from 'lucide-react'
import Papa from 'papaparse'
import type { FinCategoria } from '@/types'

interface Transacao {
  data: string
  descricao: string
  valor_centavos: number
  tipo: 'entrada' | 'saida'
  categoria_id_sugerida: string
  confianca: 'alta' | 'media' | 'baixa'
  // local
  selecionada: boolean
  categoria_id_final: string
}

interface ExtratoImportProps {
  categorias: FinCategoria[]
}

export default function ExtratoImport({ categorias }: ExtratoImportProps) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [etapa, setEtapa] = useState<'input' | 'revisao' | 'concluido'>('input')
  const [texto, setTexto] = useState('')
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [analisando, setAnalisando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [erro, setErro] = useState('')
  const [totalSalvo, setTotalSalvo] = useState(0)

  function handleFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setErro('')
    setNomeArquivo(file.name)

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const reader = new FileReader()
      reader.onload = e => {
        const dataUrl = e.target?.result as string
        // dataUrl = "data:application/pdf;base64,XXXX"
        const base64 = dataUrl.split(',')[1]
        setPdfBase64(base64)
        setTexto('')
      }
      reader.onerror = () => setErro('Erro ao ler PDF.')
      reader.readAsDataURL(file)
    } else {
      setPdfBase64(null)
      Papa.parse(file, {
        complete: result => {
          const linhas = (result.data as string[][]).map(row => row.join('\t')).join('\n')
          setTexto(linhas)
        },
        error: () => setErro('Erro ao ler arquivo.'),
      })
    }
  }

  async function analisar() {
    if (!pdfBase64 && !texto.trim()) { setErro('Cole o texto do extrato ou faça upload de um arquivo.'); return }
    setErro('')
    setAnalisando(true)

    try {
      const res = await fetch('/api/financeiro/importar-extrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: pdfBase64 ? null : texto,
          pdfBase64: pdfBase64 ?? null,
          categorias: categorias.map(c => ({ id: c.id, nome: c.nome, tipo: c.tipo })),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erro na análise')

      const txs: Transacao[] = (data.transacoes as Omit<Transacao, 'selecionada' | 'categoria_id_final'>[]).map(t => ({
        ...t,
        selecionada: true,
        categoria_id_final: t.categoria_id_sugerida,
      }))

      setTransacoes(txs)
      setEtapa('revisao')
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setAnalisando(false)
    }
  }

  async function confirmar() {
    const selecionadas = transacoes.filter(t => t.selecionada)
    if (selecionadas.length === 0) { setErro('Selecione pelo menos uma transação.'); return }
    setErro('')
    setSalvando(true)

    const payload = selecionadas.map(t => ({
      descricao: t.descricao,
      valor: t.valor_centavos,
      tipo: t.tipo,
      categoria_id: t.categoria_id_final || null,
      data_competencia: t.data,
      data_caixa: t.data,
      origem: 'importacao' as const,
    }))

    const { error } = await supabase.from('fin_movimentacoes').insert(payload)
    setSalvando(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }

    setTotalSalvo(selecionadas.length)
    setEtapa('concluido')
    router.refresh()
  }

  function toggleTodas(v: boolean) {
    setTransacoes(txs => txs.map(t => ({ ...t, selecionada: v })))
  }

  const todasSelecionadas = transacoes.length > 0 && transacoes.every(t => t.selecionada)
  const nenhumaSelecionada = transacoes.every(t => !t.selecionada)

  // ── ETAPA: input ─────────────────────────────────────────────
  if (etapa === 'input') {
    return (
      <div className="space-y-5">
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Importar Extrato Bancário com IA</h3>
          <p className="text-xs text-slate-500 mb-4">
            A IA analisa o texto do extrato, identifica cada transação e sugere a categoria financeira correta.
            Você revisa antes de confirmar.
          </p>

          {/* Upload de arquivo */}
          <div
            className="border-2 border-dashed border-indigo-200 bg-indigo-50 rounded-xl p-5 text-center cursor-pointer hover:border-indigo-300 transition-colors mb-4"
            onClick={() => fileRef.current?.click()}
          >
            <FileText className="w-8 h-8 mx-auto text-indigo-400 mb-2" />
            {nomeArquivo ? (
              <>
                <p className="text-sm font-medium text-indigo-700">{nomeArquivo}</p>
                <p className="text-xs text-slate-400 mt-1">Clique para trocar o arquivo</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-600">Upload do extrato (PDF, CSV ou TXT)</p>
                <p className="text-xs text-slate-400 mt-1">Clique para selecionar ou arraste o arquivo</p>
              </>
            )}
            <input ref={fileRef} type="file" accept=".csv,.txt,.pdf,application/pdf" className="hidden" onChange={e => handleFile(e.target.files)} />
          </div>

          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 border-t border-slate-200" />
            <span className="text-xs text-slate-400">ou cole o texto abaixo (CSV/TXT)</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          <div>
            <label className="label">Texto do extrato</label>
            <textarea
              className="input resize-none font-mono text-xs"
              rows={10}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder={`Cole aqui o texto do extrato bancário. Exemplo:
01/03/2026 PIX RECEBIDO MARIA SILVA       600,00
02/03/2026 PAGAMENTO ALUGUEL             -3.000,00
03/03/2026 CONTA DE ENERGIA               -189,50`}
            />
          </div>

          {erro && (
            <div className="flex items-center gap-2 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{erro}</p>
            </div>
          )}
        </div>

        <button
          onClick={analisar}
          disabled={analisando || (!texto.trim() && !pdfBase64)}
          className="btn-primary w-full"
        >
          {analisando
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Analisando com IA...</>
            : <><Sparkles className="w-4 h-4" /> Analisar Extrato</>
          }
        </button>
      </div>
    )
  }

  // ── ETAPA: revisao ────────────────────────────────────────────
  if (etapa === 'revisao') {
    const selecionadas = transacoes.filter(t => t.selecionada)
    const totalEntradas = selecionadas.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor_centavos, 0)
    const totalSaidas = selecionadas.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor_centavos, 0)

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Revisar Transações Identificadas</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {transacoes.length} transações encontradas · {selecionadas.length} selecionadas
            </p>
          </div>
          <button onClick={() => setEtapa('input')} className="btn-secondary text-xs">← Voltar</button>
        </div>

        {/* Totais */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card py-2 text-center">
            <p className="text-xs text-emerald-600">Entradas selecionadas</p>
            <p className="text-base font-bold text-emerald-700">{formatarMoeda(totalEntradas)}</p>
          </div>
          <div className="card py-2 text-center">
            <p className="text-xs text-red-600">Saídas selecionadas</p>
            <p className="text-base font-bold text-red-700">{formatarMoeda(totalSaidas)}</p>
          </div>
          <div className="card py-2 text-center">
            <p className="text-xs text-slate-600">Saldo</p>
            <p className={cn('text-base font-bold', totalEntradas - totalSaidas >= 0 ? 'text-emerald-700' : 'text-red-700')}>
              {formatarMoeda(totalEntradas - totalSaidas)}
            </p>
          </div>
        </div>

        {/* Tabela de revisão */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-100 bg-slate-50">
            <input
              type="checkbox"
              checked={todasSelecionadas}
              onChange={e => toggleTodas(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-slate-500">Selecionar todas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th w-8"></th>
                  <th className="table-th">Data</th>
                  <th className="table-th">Descrição</th>
                  <th className="table-th">Valor</th>
                  <th className="table-th">Categoria</th>
                  <th className="table-th">Confiança</th>
                </tr>
              </thead>
              <tbody>
                {transacoes.map((t, i) => (
                  <tr key={i} className={cn('transition-colors', !t.selecionada && 'opacity-40')}>
                    <td className="table-td">
                      <input
                        type="checkbox"
                        checked={t.selecionada}
                        onChange={e => setTransacoes(txs => txs.map((tx, j) => j === i ? { ...tx, selecionada: e.target.checked } : tx))}
                        className="rounded"
                      />
                    </td>
                    <td className="table-td text-sm text-slate-600 whitespace-nowrap">
                      {formatarData(t.data)}
                    </td>
                    <td className="table-td">
                      <p className="text-sm font-medium text-slate-800">{t.descricao}</p>
                    </td>
                    <td className="table-td whitespace-nowrap">
                      <span className={cn('text-sm font-semibold', t.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600')}>
                        {t.tipo === 'entrada' ? '+' : '-'}{formatarMoeda(t.valor_centavos)}
                      </span>
                    </td>
                    <td className="table-td">
                      <select
                        className="input py-1 text-xs"
                        value={t.categoria_id_final}
                        onChange={e => setTransacoes(txs => txs.map((tx, j) => j === i ? { ...tx, categoria_id_final: e.target.value } : tx))}
                      >
                        <option value="">Sem categoria</option>
                        {categorias
                          .filter(c => c.ativo && c.tipo === t.tipo)
                          .map(c => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                      </select>
                    </td>
                    <td className="table-td">
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        t.confianca === 'alta' ? 'bg-emerald-100 text-emerald-700'
                        : t.confianca === 'media' ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                      )}>
                        {t.confianca}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {erro && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <p className="text-sm text-red-600">{erro}</p>
          </div>
        )}

        <button
          onClick={confirmar}
          disabled={salvando || nenhumaSelecionada}
          className="btn-primary w-full"
        >
          {salvando
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            : <><CheckCircle2 className="w-4 h-4" /> Confirmar {selecionadas.length} transaç{selecionadas.length !== 1 ? 'ões' : 'ão'}</>
          }
        </button>
      </div>
    )
  }

  // ── ETAPA: concluido ──────────────────────────────────────────
  return (
    <div className="card text-center py-12">
      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-slate-800">{totalSalvo} transaç{totalSalvo !== 1 ? 'ões importadas' : 'ão importada'}!</h3>
      <p className="text-sm text-slate-500 mt-1">As movimentações foram adicionadas ao módulo financeiro.</p>
      <div className="flex gap-3 justify-center mt-5">
        <a href="/financeiro/movimentacoes" className="btn-primary">Ver Movimentações</a>
        <button onClick={() => { setEtapa('input'); setTexto(''); setTransacoes([]) }} className="btn-secondary">
          Importar outro extrato
        </button>
      </div>
    </div>
  )
}
