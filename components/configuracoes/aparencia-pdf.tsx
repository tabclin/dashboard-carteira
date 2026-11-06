'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, FileText, ImagePlus, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/ckex/button'
import { coresDe, linhaRegistro, type Aparencia } from '@/lib/pdf/aparencia'
import { salvarAparenciaPdf } from '@/app/(dashboard)/configuracoes/acoes'

const SUGERIDAS = ['#4f46e5', '#3e6e8e', '#0f766e', '#db2777', '#ef7f67', '#7c3aed']
const LOGO_MAX_BYTES = 1024 * 1024

/** Cor, nome, registros e logo do cabeçalho do PDF das orientações. */
export function AparenciaPdf({ inicial }: { inicial: Aparencia }) {
  const [a, setA] = useState(inicial)
  const [salvando, iniciar] = useTransition()
  const arquivo = useRef<HTMLInputElement>(null)
  const c = coresDe(a.cor)
  const registro = linhaRegistro(a)
  const campo = (k: 'nome' | 'crm' | 'rqe' | 'especialidade') => (e: React.ChangeEvent<HTMLInputElement>) => setA((v) => ({ ...v, [k]: e.target.value }))

  function escolherLogo(f: File) {
    if (!/^image\/(png|jpeg)$/.test(f.type)) { toast.error('A logo precisa ser PNG ou JPG.'); return }
    if (f.size > LOGO_MAX_BYTES) { toast.error('A logo pode ter até 1 MB.'); return }
    const r = new FileReader()
    r.onload = (e) => setA((v) => ({ ...v, logo: e.target?.result as string }))
    r.readAsDataURL(f)
  }

  const salvar = () => iniciar(async () => {
    const r = await salvarAparenciaPdf({ cor: a.cor, nome: a.nome, crm: a.crm ?? '', rqe: a.rqe ?? '', especialidade: a.especialidade ?? '', logo: a.logo })
    if (r.ok) toast.success('Aparência do PDF salva.'); else toast.error(r.erro)
  })

  const input = 'w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm'

  return (
    <section className="bg-white rounded-xl border p-5 space-y-4" aria-labelledby="titulo-aparencia">
      <div>
        <h2 id="titulo-aparencia" className="font-semibold text-slate-800">Aparência do PDF das orientações</h2>
        <p className="text-sm text-slate-500">Cor, nome e registros que aparecem no cabeçalho do PDF entregue à família.</p>
      </div>

      {/* prévia do cabeçalho */}
      <div className="rounded-lg px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: c.principal }}>
        <div className="flex items-center gap-3 min-w-0">
          {a.logo && (
            <span className="bg-white rounded-md p-1 flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.logo} alt="Logo" className="h-10 max-w-[100px] object-contain" />
            </span>
          )}
          <div className="min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: c.textoSobre }}>{a.nome || 'Seu nome'}</p>
            {registro && <p className="text-xs truncate" style={{ color: c.textoSobreSuave }}>{registro}</p>}
          </div>
        </div>
        <span className="text-xs flex-shrink-0" style={{ color: c.textoSobreSuave }}>06/11/2026</span>
      </div>

      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <div>
          <span className="block text-xs text-slate-500 mb-1.5">Cor principal</span>
          <div className="flex flex-wrap items-center gap-2">
            {SUGERIDAS.map((cor) => (
              <button key={cor} type="button" onClick={() => setA((v) => ({ ...v, cor }))} title={cor} aria-label={`Cor ${cor}`}
                className="w-7 h-7 rounded-full border border-black/10 flex items-center justify-center" style={{ backgroundColor: cor }}>
                {a.cor === cor && <Check className="w-4 h-4" style={{ color: coresDe(cor).textoSobre }} />}
              </button>
            ))}
            <label className="flex items-center gap-1.5 text-xs text-slate-600 ml-1 cursor-pointer">
              <input type="color" value={a.cor} onChange={(e) => setA((v) => ({ ...v, cor: e.target.value }))} className="w-7 h-7 rounded cursor-pointer" />
              Outra cor
            </label>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm text-slate-700"><span className="block text-xs text-slate-500 mb-1">Nome</span>
            <input className={input} value={a.nome} onChange={campo('nome')} required /></label>
          <label className="text-sm text-slate-700"><span className="block text-xs text-slate-500 mb-1">Especialidade</span>
            <input className={input} value={a.especialidade ?? ''} onChange={campo('especialidade')} placeholder="Pediatra" /></label>
          <label className="text-sm text-slate-700"><span className="block text-xs text-slate-500 mb-1">CRM</span>
            <input className={input} value={a.crm ?? ''} onChange={campo('crm')} placeholder="CRM-SP 157418" /></label>
          <label className="text-sm text-slate-700"><span className="block text-xs text-slate-500 mb-1">RQE</span>
            <input className={input} value={a.rqe ?? ''} onChange={campo('rqe')} placeholder="59046" /></label>
        </div>

        <div>
          <span className="block text-xs text-slate-500 mb-1.5">Logo (opcional)</span>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => arquivo.current?.click()}>
              <ImagePlus className="w-4 h-4" /> {a.logo ? 'Trocar logo' : 'Escolher logo'}
            </Button>
            {a.logo && (
              <button type="button" onClick={() => setA((v) => ({ ...v, logo: null }))} className="flex items-center gap-1 text-xs text-red-500 hover:underline">
                <X className="w-3.5 h-3.5" /> Remover logo
              </button>
            )}
            <span className="text-xs text-slate-400">PNG ou JPG, até 1 MB</span>
          </div>
          <input ref={arquivo} type="file" accept="image/png,image/jpeg" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) escolherLogo(f); e.target.value = '' }} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={salvando}>{salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar aparência</Button>
          <a href="/api/orientacoes/exemplo-pdf" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 hover:underline">
            <FileText className="w-4 h-4" /> Ver PDF de exemplo
          </a>
          <span className="text-xs text-slate-400">O exemplo usa o que está salvo.</span>
        </div>
      </form>
    </section>
  )
}
