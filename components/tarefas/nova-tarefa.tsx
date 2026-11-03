'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, X, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/ckex/button'
import { cn } from '@/lib/utils'
import { TIPOS_TAREFA, type TipoTarefa } from '@/lib/tarefas-regras'
import { criarTarefa, sugerirPrazos } from '@/app/(dashboard)/tarefas/acoes'
import { VISUAL_TIPO } from './tipo-tarefa'

type Paciente = { id: string; name: string }
const chave = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
type Sugestoes = Record<TipoTarefa, { prazo: string; motivo: string }>

/** Botão "+ Tarefa" com o formulário. Sem `paciente`, pede para buscar um. */
export function NovaTarefa({ paciente, rotulo = 'Nova tarefa' }: { paciente?: Paciente; rotulo?: string }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Button onClick={() => setAberto(true)} size="sm"><Plus className="w-4 h-4" aria-hidden /> {rotulo}</Button>
      {aberto && <Formulario pacienteFixo={paciente} fechar={() => setAberto(false)} />}
    </>
  )
}

function Formulario({ pacienteFixo, fechar }: { pacienteFixo?: Paciente; fechar: () => void }) {
  const router = useRouter()
  const [paciente, setPaciente] = useState<Paciente | null>(pacienteFixo ?? null)
  const [busca, setBusca] = useState('')
  const [achados, setAchados] = useState<Paciente[]>([])
  const [sugestoes, setSugestoes] = useState<Sugestoes | null>(null)
  const [marcados, setMarcados] = useState<TipoTarefa[]>([])
  const [prazos, setPrazos] = useState<Record<string, string>>({})
  const [observacao, setObservacao] = useState('')
  const [salvando, iniciar] = useTransition()
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fechar()
    window.addEventListener('keydown', esc); caixa.current?.querySelector<HTMLElement>('input,button')?.focus()
    return () => window.removeEventListener('keydown', esc)
  }, [fechar])

  // busca de paciente (quando não veio da ficha): carrega a lista uma vez e filtra sem acento
  const [todos, setTodos] = useState<(Paciente & { k: string })[] | null>(null)
  useEffect(() => {
    if (pacienteFixo || todos) return
    fetch('/api/pacientes').then((r) => (r.ok ? r.json() : [])).then((l: Paciente[]) => setTodos(l.map((p) => ({ ...p, k: chave(p.name) }))))
  }, [pacienteFixo, todos])
  useEffect(() => {
    const termos = chave(busca).split(' ').filter(Boolean)
    if (paciente || !todos || !termos.length || busca.trim().length < 2) { setAchados([]); return }
    setAchados(todos.filter((p) => termos.every((t) => p.k.includes(t))).slice(0, 8))
  }, [busca, paciente, todos])

  // prazo sugerido (antes do retorno, ou padrão do tipo)
  useEffect(() => {
    if (!paciente) return
    sugerirPrazos(paciente.id).then((s) => {
      if (!s) return
      setSugestoes(s); setPrazos(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.prazo])))
    })
  }, [paciente])

  const salvar = () => iniciar(async () => {
    if (!paciente) return
    const r = await criarTarefa({ patientId: paciente.id, tipos: marcados, prazos, observacao })
    if (!r.ok) return void toast.error(r.erro)
    toast.success(marcados.length > 1 ? `${marcados.length} tarefas criadas.` : 'Tarefa criada.')
    fechar(); router.refresh()
  })

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-[10vh]" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div ref={caixa} role="dialog" aria-modal="true" aria-labelledby="titulo-nova-tarefa" className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 id="titulo-nova-tarefa" className="font-semibold text-slate-800">Nova tarefa</h2>
          <button type="button" onClick={fechar} aria-label="Fechar" className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">Paciente</p>
            {paciente ? (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
                {paciente.name}
                {!pacienteFixo && <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => { setPaciente(null); setSugestoes(null); setMarcados([]) }}>trocar</button>}
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite o nome do paciente" aria-label="Buscar paciente"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
                {achados.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg" role="listbox">
                    {achados.map((p) => (
                      <li key={p.id}><button type="button" role="option" aria-selected="false" onClick={() => setPaciente(p)} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50">{p.name}</button></li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {paciente && (
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-slate-500">O que fazer (pode marcar mais de um)</legend>
              <div className="space-y-2">
                {TIPOS_TAREFA.map(({ tipo, acao }) => {
                  const on = marcados.includes(tipo), Icone = VISUAL_TIPO[tipo].icone
                  return (
                    <div key={tipo} className={cn('rounded-lg border px-3 py-2.5', on ? 'border-slate-400 bg-slate-50' : 'border-slate-200')}>
                      <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-800">
                        <input type="checkbox" checked={on} onChange={() => setMarcados((m) => on ? m.filter((x) => x !== tipo) : [...m, tipo])} className="h-4 w-4" />
                        <Icone className="w-4 h-4 text-slate-500" aria-hidden /> {acao}
                      </label>
                      {on && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 pl-6 text-sm">
                          <label htmlFor={`prazo-${tipo}`} className="text-slate-500">Até</label>
                          <input id={`prazo-${tipo}`} type="date" value={prazos[tipo] ?? ''} onChange={(e) => setPrazos((p) => ({ ...p, [tipo]: e.target.value }))}
                            className="rounded-md border border-slate-200 px-2 py-1 text-sm" />
                          {sugestoes && prazos[tipo] === sugestoes[tipo].prazo && <span className="text-xs text-slate-500">({sugestoes[tipo].motivo})</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </fieldset>
          )}

          {paciente && (
            <div>
              <label htmlFor="obs-tarefa" className="mb-1.5 block text-xs font-medium text-slate-500">Observação (opcional)</label>
              <textarea id="obs-tarefa" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: mãe vai mandar os exames pelo WhatsApp"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" onClick={fechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={!paciente || !marcados.length || salvando}>
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Criar tarefa
          </Button>
        </div>
      </div>
    </div>
  )
}
