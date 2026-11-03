-- Tarefas da Dra.: o quê (exames, DRI, orientação), para quem (paciente) e até quando (prazo).
-- Só acréscimos: nenhuma coluna ou dado existente é alterado ou apagado.

create table if not exists public.tarefas (
  id              text primary key default gen_random_uuid()::text,
  professional_id text not null references public.professionals(id) on delete cascade,
  patient_id      text not null references public.patients(id) on delete cascade,
  tipo            text not null check (tipo in ('exames', 'dri', 'orientacao')),
  prazo           date not null,
  observacao      text,
  status          text not null default 'pendente' check (status in ('pendente', 'feita', 'cancelada')),
  concluida_em    timestamptz,
  concluida_como  text check (concluida_como in ('automatico', 'manual')), -- automático = a ferramenta foi usada
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists tarefas_profissional_status_prazo on public.tarefas (professional_id, status, prazo);
create index if not exists tarefas_paciente on public.tarefas (patient_id, status);
alter table public.tarefas enable row level security;

-- Prazo padrão (em dias) de cada tipo de tarefa, por login
create table if not exists public.preferencias_tarefas (
  professional_id  text primary key references public.professionals(id) on delete cascade,
  dias_exames      integer not null default 5 check (dias_exames between 0 and 90),
  dias_dri         integer not null default 7 check (dias_dri between 0 and 90),
  dias_orientacao  integer not null default 3 check (dias_orientacao between 0 and 90),
  updated_at       timestamptz not null default now()
);
alter table public.preferencias_tarefas enable row level security;

-- Próximo agendamento do paciente no Gestão DS (para sugerir o prazo "antes do retorno")
alter table public.patients add column if not exists proximo_agendamento date;
