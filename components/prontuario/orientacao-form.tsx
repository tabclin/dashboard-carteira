'use client'

interface Props {
  consultaId?: string
  orientacao?: string | null
}

export default function OrientacaoForm({ consultaId, orientacao }: Props) {
  return (
    <div className="card py-16 text-center">
      <p className="text-slate-500 text-sm font-medium">Aba Orientação em desenvolvimento</p>
      <p className="text-xs text-slate-400 mt-1">Esta funcionalidade será disponibilizada em breve.</p>
    </div>
  )
}
