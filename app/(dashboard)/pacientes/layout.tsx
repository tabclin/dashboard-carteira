import { UserRound } from 'lucide-react'

export default function PacientesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b bg-white px-6 py-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0">
            <UserRound className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Pacientes</h1>
            <p className="text-xs text-slate-500">Gestão completa do cadastro de pacientes</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {children}
      </div>
    </div>
  )
}
