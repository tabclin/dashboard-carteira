-- Aparência do PDF das orientações, por login: cor principal, nome, CRM, RQE, especialidade e logo.
-- Só acréscimo: nenhuma coluna ou dado existente é alterado ou apagado.
-- Sem linha aqui, o PDF usa o nome/CRM/especialidade do cadastro e o azul de sempre.

create table if not exists public.aparencia_pdf (
  professional_id text primary key references public.professionals(id) on delete cascade,
  cor             text check (cor ~* '^#[0-9a-f]{6}$'),
  nome            text,
  crm             text,
  rqe             text,
  especialidade   text,
  logo            text,          -- imagem em base64 (data:image/png;base64,...), como as imagens das orientações
  updated_at      timestamptz not null default now()
);
alter table public.aparencia_pdf enable row level security;
