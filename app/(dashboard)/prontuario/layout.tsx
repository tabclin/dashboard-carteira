export default function ProntuarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Prontuário Eletrônico</h1>
        <p className="text-sm text-slate-500 mt-0.5">Registros clínicos completos por paciente.</p>
      </div>
      {children}
    </div>
  )
}
