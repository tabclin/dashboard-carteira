import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FlaskConical, Flame, ScrollText, CalendarCheck, Plus, FileDown, ChevronRight, LineChart, ListChecks } from 'lucide-react'
import { prisma } from '@/lib/prisma/client'
import { profissionalDoLogin } from '@/lib/profissional'
import { idadeTexto, dataBR } from '@/lib/idade'
import { ANALYSIS_STATUS_CONFIG } from '@/types'
import { Indicadores } from '@/components/pacientes/tabela-pacientes'
import { cn } from '@/lib/utils'
import { hojeSP } from '@/lib/tarefas'
import { textoDoPrazo } from '@/lib/tarefas-regras'
import { ListaTarefas } from '@/components/tarefas/lista-tarefas'
import { NovaTarefa } from '@/components/tarefas/nova-tarefa'

const CONSULTAS_VISIVEIS = 10
const TIPO = { consulta: 'Consulta', retorno: 'Retorno', outro: 'Outro' } as Record<string, string>
const cpfBR = (c: string | null) => (c && /^\d{11}$/.test(c) ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : c)
const meses = (m: number) => (m < 24 ? `${m} meses` : `${Math.floor(m / 12)} anos${m % 12 ? ` e ${m % 12} m` : ''}`)
const kcal = (n: unknown) => (n == null ? null : Math.round(Number(n)).toLocaleString('pt-BR'))

function Secao({ titulo, icone: Icone, cor, total, acao, children }: {
  titulo: string; icone: typeof FlaskConical; cor: string; total: number; acao?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-xl border p-5" aria-label={titulo}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="flex items-center gap-2 font-semibold text-slate-800">
          <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center', cor)}><Icone className="w-4 h-4 text-white" aria-hidden /></span>
          {titulo} <span className="text-sm font-normal text-slate-400">({total})</span>
        </h3>
        {acao}
      </div>
      {children}
    </section>
  )
}

const Vazio = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-slate-400 py-2">{children}</p>

export default async function FichaPacientePage({ params }: { params: { id: string } }) {
  const prof = await profissionalDoLogin()
  if (!prof) return null

  // só pacientes do próprio login
  const p = await prisma.patient.findFirst({
    where: { id: params.id, professionalId: prof.id },
    include: {
      analyses: { orderBy: { collectedAt: 'desc' }, select: { id: true, collectedAt: true, labName: true, status: true, _count: { select: { results: true } } } },
      driAvaliacoes: { orderBy: { data: 'desc' }, select: { id: true, data: true, ageMonths: true, eerMasc: true, eerFem: true, sexInput: true, _count: { select: { planos: true } } } },
      orientacoes: { orderBy: [{ orientacaoDate: 'desc' }, { createdAt: 'desc' }], select: { id: true, title: true, orientacaoDate: true, createdAt: true } },
      consultas: { orderBy: { data: 'desc' }, select: { id: true, data: true, tipo: true, tipoResumido: true, servico: true } },
      tarefas: { where: { status: 'pendente' }, orderBy: { prazo: 'asc' }, select: { id: true, tipo: true, prazo: true, observacao: true, status: true, concluidaComo: true } },
    },
  })
  if (!p) notFound()
  const hoje = hojeSP()
  const proximo = p.proximoAgendamento?.toISOString().slice(0, 10) ?? null

  const dados = [
    ['Próximo agendamento', proximo && proximo >= hoje ? `${dataBR(proximo)} (${textoDoPrazo(proximo, hoje).replace('em ', 'daqui a ')})` : null],
    ['Idade', idadeTexto(p.birthDate)],
    ['Nascimento', dataBR(p.birthDate)],
    ['CPF', cpfBR(p.cpf)],
    ['Telefone', p.phone],
    ['E-mail', p.email],
    ['Cidade', p.cidade],
  ].filter(([, v]) => v) as [string, string][]
  const ate = (q: string) => `?patientId=${p.id}${q}`

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <Link href="/pacientes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="w-4 h-4" aria-hidden /> Pacientes
      </Link>

      <header className="bg-white rounded-xl border p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{p.name}</h2>
            {p.gestaodsId != null && <span className="text-xs text-slate-500">Ligado ao Gestão DS</span>}
          </div>
          <Indicadores p={{ exames: p.analyses.length, dri: p.driAvaliacoes.length, orientacoes: p.orientacoes.length }} />
        </div>
        {dados.length > 0 && (
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            {dados.map(([k, v]) => (
              <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="text-slate-800 break-words">{v}</dd></div>
            ))}
          </dl>
        )}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Link href={`/check-exames/analises/nova${ate('&de=paciente')}`} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="w-4 h-4" aria-hidden /> Nova análise de exames
          </Link>
          <Link href={`/dri/calculadora${ate('')}`} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">
            <Plus className="w-4 h-4" aria-hidden /> Novo DRI
          </Link>
          <Link href={`/orientacoes${ate('')}`} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            <Plus className="w-4 h-4" aria-hidden /> Nova orientação
          </Link>
        </div>
      </header>

      <Secao titulo="Tarefas" icone={ListChecks} cor="bg-emerald-600" total={p.tarefas.length}
        acao={<NovaTarefa paciente={{ id: p.id, name: p.name }} />}>
        {p.tarefas.length === 0 ? <Vazio>Nenhuma tarefa pendente para este paciente.</Vazio> : (
          <ListaTarefas semPaciente hoje={hoje} tarefas={p.tarefas.map((t) => ({
            id: t.id, tipo: t.tipo, prazo: t.prazo.toISOString().slice(0, 10), observacao: t.observacao, status: t.status,
            concluidaComo: t.concluidaComo, paciente: { id: p.id, nome: p.name },
          }))} />
        )}
      </Secao>

      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <Secao titulo="Check Exames" icone={FlaskConical} cor="bg-blue-600" total={p.analyses.length}
          acao={p.analyses.length > 1 && (
            <Link href={`/check-exames/pacientes/${p.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
              <LineChart className="w-3.5 h-3.5" aria-hidden /> Evolução dos exames
            </Link>)}>
          {p.analyses.length === 0 ? <Vazio>Nenhuma análise de exames.</Vazio> : (
            <ul className="divide-y">
              {p.analyses.map((a) => {
                const st = ANALYSIS_STATUS_CONFIG[a.status as keyof typeof ANALYSIS_STATUS_CONFIG]
                return (
                  <li key={a.id}>
                    <Link href={`/check-exames/analises/${a.id}`} className="flex items-center gap-3 py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-800">Coleta em {dataBR(a.collectedAt)}</span>
                        <span className="block text-xs text-slate-500 truncate">{a.labName ?? 'Laboratório não informado'} · {a._count.results} exames</span>
                      </span>
                      {st && <span className={cn('text-xs font-medium rounded-full px-2 py-0.5', st.bg, st.color)}>{st.label}</span>}
                      <ChevronRight className="w-4 h-4 text-slate-300" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Secao>

        <Secao titulo="DRI" icone={Flame} cor="bg-orange-500" total={p.driAvaliacoes.length}>
          {p.driAvaliacoes.length === 0 ? <Vazio>Nenhuma avaliação DRI.</Vazio> : (
            <ul className="divide-y">
              {p.driAvaliacoes.map((d) => {
                const eer = [d.sexInput !== 'F' && kcal(d.eerMasc), d.sexInput !== 'M' && kcal(d.eerFem)].filter(Boolean)[0]
                return (
                  <li key={d.id}>
                    <Link href={`/dri/plano/${d.id}`} className="flex items-center gap-3 py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-800">{dataBR(d.data)}</span>
                        <span className="block text-xs text-slate-500">{meses(d.ageMonths)}{eer && ` · ${eer} kcal/dia`}{d._count.planos > 0 && ' · com plano alimentar'}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Secao>

        <Secao titulo="Orientações" icone={ScrollText} cor="bg-indigo-600" total={p.orientacoes.length}>
          {p.orientacoes.length === 0 ? <Vazio>Nenhuma orientação.</Vazio> : (
            <ul className="divide-y">
              {p.orientacoes.map((o) => (
                <li key={o.id}>
                  <a href={`/api/orientacoes/${o.id}/pdf`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">{o.title}</span>
                      <span className="block text-xs text-slate-500">{dataBR(o.orientacaoDate ?? o.createdAt)}</span>
                    </span>
                    <FileDown className="w-4 h-4 text-slate-400" aria-label="Abrir PDF" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        <Secao titulo="Consultas realizadas" icone={CalendarCheck} cor="bg-emerald-600" total={p.consultas.length}>
          {p.consultas.length === 0 ? <Vazio>Nenhuma consulta registrada. Elas vêm do Gestão DS ou da planilha de atendimentos.</Vazio> : (
            <>
              <ul className="divide-y">
                {p.consultas.slice(0, CONSULTAS_VISIVEIS).map((c) => <LinhaConsulta key={c.id} c={c} />)}
              </ul>
              {p.consultas.length > CONSULTAS_VISIVEIS && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs font-medium text-emerald-700 py-2">Ver as outras {p.consultas.length - CONSULTAS_VISIVEIS}</summary>
                  <ul className="divide-y">{p.consultas.slice(CONSULTAS_VISIVEIS).map((c) => <LinhaConsulta key={c.id} c={c} />)}</ul>
                </details>
              )}
            </>
          )}
        </Secao>
      </div>
    </div>
  )
}

function LinhaConsulta({ c }: { c: { data: Date; tipo: string | null; tipoResumido: string; servico: string | null } }) {
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <span className="w-24 text-slate-800 font-medium">{dataBR(c.data)}</span>
      <span className={cn('text-xs rounded-full px-2 py-0.5', c.tipoResumido === 'retorno' ? 'bg-emerald-50 text-emerald-700' : c.tipoResumido === 'consulta' ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-700')}>
        {c.tipoResumido === 'outro' ? (c.tipo ?? TIPO.outro) : TIPO[c.tipoResumido]}
      </span>
      {c.servico && <span className="text-xs text-slate-500 truncate">{c.servico}</span>}
    </li>
  )
}
