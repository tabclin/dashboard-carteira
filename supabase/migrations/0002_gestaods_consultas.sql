-- Etapa 2: base para a integração com o Gestão DS, consultas realizadas e o vínculo do DRI com o paciente.
-- Só acréscimos: nenhuma coluna ou dado existente é alterado ou apagado.

-- 1) Pacientes: código no Gestão DS e dados que vêm de lá
alter table public.patients add column if not exists gestaods_id integer;
alter table public.patients add column if not exists cpf         text;
alter table public.patients add column if not exists cidade      text;
-- um mesmo paciente do Gestão DS só pode estar ligado a um cadastro por login
create unique index if not exists patients_profissional_gestaods
  on public.patients (professional_id, gestaods_id) where gestaods_id is not null;

-- 2) Consultas realizadas (vindas do Gestão DS ou de planilha)
create table if not exists public.consultas (
  id              text primary key default gen_random_uuid()::text,
  professional_id text not null references public.professionals(id) on delete cascade,
  patient_id      text references public.patients(id) on delete set null,
  paciente_nome   text not null,                 -- como veio da origem (para conferência)
  data            date not null,
  tipo            text,                          -- texto original (ex.: "Consulta", "Retorno")
  tipo_resumido   text not null default 'outro' check (tipo_resumido in ('consulta', 'retorno', 'outro')),
  servico         text,
  gestaods_id     integer,                       -- id do atendimento no Gestão DS
  origem          text not null check (origem in ('gestaods', 'planilha')),
  created_at      timestamptz not null default now()
);
create unique index if not exists consultas_profissional_gestaods
  on public.consultas (professional_id, gestaods_id) where gestaods_id is not null;
create index if not exists consultas_paciente_data on public.consultas (patient_id, data desc);
create index if not exists consultas_profissional_data on public.consultas (professional_id, data);
alter table public.consultas enable row level security;

-- 3) Chave do Gestão DS de cada login, criptografada pelo app (a chave em texto nunca é gravada)
create table if not exists public.integracoes_gestaods (
  professional_id      text primary key references public.professionals(id) on delete cascade,
  token_cifrado        text not null,
  token_final          text not null,           -- últimos 4 caracteres, só para conferência na tela
  medico_id            integer,
  ultima_sincronizacao timestamptz,
  ultimo_status        text check (ultimo_status in ('ok', 'erro')),
  ultimo_erro          text,
  ultimo_resumo        jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table public.integracoes_gestaods enable row level security;

-- 4) DRI e plano alimentar passam a apontar para o cadastro do paciente (o nome digitado continua)
alter table public.dri_avaliacoes     add column if not exists patient_id text references public.patients(id) on delete set null;
alter table public.planos_alimentares add column if not exists patient_id text references public.patients(id) on delete set null;
create index if not exists dri_avaliacoes_paciente     on public.dri_avaliacoes (patient_id);
create index if not exists planos_alimentares_paciente on public.planos_alimentares (patient_id);
create index if not exists orientacoes_paciente        on public.orientacoes (patient_id);
