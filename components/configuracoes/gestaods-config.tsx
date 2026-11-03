'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { KeyRound, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/ckex/button'
import { Input } from '@/components/ui/ckex/input'
import { salvarChaveGestaoDS, removerChaveGestaoDS, atualizarPeloGestaoDS } from '@/app/(dashboard)/configuracoes/acoes'
import { ResumoImportacaoView } from './resumo-importacao'
import type { ResumoImportacao } from '@/lib/gestaods/importar'

type Integracao = {
  final: string
  ultima: string | null
  status: string | null
  erro: string | null
  resumo: (ResumoImportacao & { segundos: number }) | null
} | null

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export function GestaoDSConfig({ integracao }: { integracao: Integracao }) {
  const [trocando, setTrocando] = useState(!integracao)
  const [token, setToken] = useState('')
  const [salvando, iniciarSalvar] = useTransition()
  const [atualizando, iniciarAtualizar] = useTransition()

  const salvar = () => iniciarSalvar(async () => {
    const r = await salvarChaveGestaoDS(token)
    if (!r.ok) return void toast.error(r.erro)
    toast.success('Chave conferida e guardada.'); setToken(''); setTrocando(false)
  })
  const remover = () => {
    if (!confirm('Remover a chave do Gestão DS deste login? Os pacientes e consultas já importados continuam.')) return
    iniciarSalvar(async () => { await removerChaveGestaoDS(); setTrocando(true); toast.success('Chave removida.') })
  }
  const atualizar = () => iniciarAtualizar(async () => {
    const r = await atualizarPeloGestaoDS()
    if (r.ok) toast.success('Dados atualizados pelo Gestão DS.')
    else toast.error(r.erro)
  })

  return (
    <section className="bg-white rounded-xl border p-5 space-y-4" aria-labelledby="titulo-gestaods">
      <div>
        <h2 id="titulo-gestaods" className="font-semibold text-slate-800">Gestão DS</h2>
        <p className="text-sm text-slate-500">Traz os pacientes e as consultas realizadas do Gestão DS para este login. A chave fica guardada criptografada e só é usada por esta conta.</p>
      </div>

      {integracao && !trocando ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
            <KeyRound className="w-4 h-4" /> Chave ••••{integracao.final}
          </span>
          <Button variant="outline" size="sm" onClick={() => setTrocando(true)} disabled={salvando || atualizando}>Trocar chave</Button>
          <Button variant="ghost" size="sm" onClick={remover} disabled={salvando || atualizando} className="text-red-600">Remover</Button>
        </div>
      ) : (
        <form className="flex flex-wrap items-center gap-3" onSubmit={(e) => { e.preventDefault(); salvar() }}>
          <label htmlFor="chave-gestaods" className="sr-only">Chave da API do Gestão DS</label>
          <Input id="chave-gestaods" type="password" autoComplete="off" placeholder="Cole aqui a chave da API do Gestão DS"
            value={token} onChange={(e) => setToken(e.target.value)} className="flex-1 min-w-[260px]" />
          <Button type="submit" disabled={salvando || token.trim().length < 10}>
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Conferir e salvar
          </Button>
          {integracao && <Button type="button" variant="ghost" onClick={() => setTrocando(false)}>Cancelar</Button>}
        </form>
      )}

      {integracao && (
        <div className="border-t pt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={atualizar} disabled={atualizando || salvando}>
              {atualizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {atualizando ? 'Atualizando…' : 'Atualizar agora'}
            </Button>
            {atualizando && <span className="text-sm text-slate-500">{integracao.ultima ? 'Pode levar alguns segundos.' : 'A primeira vez traz o histórico e pode levar alguns minutos.'}</span>}
          </div>
          {integracao.ultima && (
            <p className="text-sm text-slate-500 flex items-center gap-1.5">
              {integracao.status === 'erro' ? <AlertTriangle className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
              Última atualização: {quando(integracao.ultima)}{integracao.resumo && ` · ${integracao.resumo.segundos}s`}
            </p>
          )}
          {integracao.status === 'erro' && integracao.erro && <p className="text-sm text-red-600" role="alert">{integracao.erro}</p>}
          {integracao.resumo && <ResumoImportacaoView resumo={integracao.resumo} />}
        </div>
      )}
    </section>
  )
}
