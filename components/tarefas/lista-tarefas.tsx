'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, CalendarClock, Trash2, Undo2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { textoDoPrazo, grupoDoPrazo } from '@/lib/tarefas-regras'
import { concluirTarefa, reabrirTarefa, mudarPrazo, excluirTarefa } from '@/app/(dashboard)/tarefas/acoes'
import { SeloTipo, linkDaTarefa } from './tipo-tarefa'

export type TarefaVista = {
  id: string
  tipo: string
  prazo: string
  observacao: string | null
  status: string
  concluidaComo: string | null
  paciente: { id: string; nome: string }
}

const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`

/** Lista de tarefas pendentes (ou feitas, com "Reabrir"). `semPaciente` esconde o nome (dentro da ficha). */
export function ListaTarefas({ tarefas, hoje, semPaciente = false }: { tarefas: TarefaVista[]; hoje: string; semPaciente?: boolean }) {
  return (
    <ul className="divide-y">
      {tarefas.map((t) => <LinhaTarefa key={t.id} t={t} hoje={hoje} semPaciente={semPaciente} />)}
    </ul>
  )
}

function LinhaTarefa({ t, hoje, semPaciente }: { t: TarefaVista; hoje: string; semPaciente: boolean }) {
  const router = useRouter()
  const [ocupado, iniciar] = useTransition()
  const [editandoPrazo, setEditandoPrazo] = useState(false)
  const feita = t.status === 'feita'
  const atrasada = !feita && grupoDoPrazo(t.prazo, hoje) === 'atrasadas'

  const agir = (fn: () => Promise<{ ok: true } | { ok: false; erro: string }>, msg: string) => iniciar(async () => {
    const r = await fn()
    if (!r.ok) return void toast.error(r.erro)
    toast.success(msg); router.refresh()
  })

  return (
    <li className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 py-3', ocupado && 'opacity-50')}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <SeloTipo tipo={t.tipo} />
        {!semPaciente && (
          <Link href={`/pacientes/${t.paciente.id}`} className="font-medium text-slate-800 hover:text-brand-600">{t.paciente.nome}</Link>
        )}
        {t.observacao && <span className="w-full text-xs text-slate-500 md:w-auto">{t.observacao}</span>}
      </div>

      {feita ? (
        <span className="text-xs text-green-700">{t.concluidaComo === 'automatico' ? 'Feita pela ferramenta' : 'Marcada como feita'}</span>
      ) : editandoPrazo ? (
        <span className="flex items-center gap-1.5">
          <label htmlFor={`prazo-${t.id}`} className="sr-only">Novo prazo</label>
          <input id={`prazo-${t.id}`} type="date" defaultValue={t.prazo} autoFocus
            onChange={(e) => e.target.value && (setEditandoPrazo(false), agir(() => mudarPrazo(t.id, e.target.value), 'Prazo alterado.'))}
            onBlur={() => setEditandoPrazo(false)} className="rounded-md border border-slate-200 px-2 py-1 text-sm" />
        </span>
      ) : (
        <button type="button" onClick={() => setEditandoPrazo(true)} title="Mudar o prazo"
          className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-slate-100', atrasada ? 'text-red-600' : 'text-slate-600')}>
          <CalendarClock className="w-3.5 h-3.5" aria-hidden /> {ddmm(t.prazo)} · {textoDoPrazo(t.prazo, hoje)}
        </button>
      )}

      <div className="flex items-center gap-1.5">
        {feita ? (
          <button type="button" onClick={() => agir(() => reabrirTarefa(t.id), 'Tarefa reaberta.')} disabled={ocupado}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <Undo2 className="w-3.5 h-3.5" aria-hidden /> Reabrir
          </button>
        ) : (
          <>
            <Link href={linkDaTarefa(t.tipo, t.paciente.id)}
              className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700">
              Fazer agora <ArrowRight className="w-3.5 h-3.5" aria-hidden />
            </Link>
            <button type="button" onClick={() => agir(() => concluirTarefa(t.id), 'Tarefa concluída.')} disabled={ocupado} title="Marcar como feita"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50">
              <Check className="w-3.5 h-3.5" aria-hidden /> Concluir
            </button>
            <button type="button" disabled={ocupado} aria-label="Excluir tarefa" title="Excluir tarefa"
              onClick={() => confirm('Excluir esta tarefa?') && agir(() => excluirTarefa(t.id), 'Tarefa excluída.')}
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 className="w-4 h-4" aria-hidden />
            </button>
          </>
        )}
      </div>
    </li>
  )
}
