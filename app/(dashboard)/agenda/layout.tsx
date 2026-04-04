import AgendaTabNav from '@/components/agenda/agenda-tab-nav'

export default function AgendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Agenda</h1>
        <p className="text-sm text-slate-500 mt-0.5">Gerencie os agendamentos e consultas dos pacientes.</p>
      </div>
      <AgendaTabNav />
      {children}
    </div>
  )
}
