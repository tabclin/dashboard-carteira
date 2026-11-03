-- Liga a proteção por linha (RLS) nas tabelas usadas pelo Prisma.
-- Sem políticas, a chave pública (anon) e os logins pela API REST do Supabase não leem nada;
-- o app acessa essas tabelas pela conexão do servidor (usuário postgres, que ignora RLS), então nada muda nele.
-- A tabela `observacoes` fica de fora: a Carteira ainda em produção a usa pela chave pública.
alter table public.patients                enable row level security;
alter table public.analyses                enable row level security;
alter table public.results                 enable row level security;
alter table public.professionals           enable row level security;
alter table public.organizations           enable row level security;
alter table public.usage_logs              enable row level security;
alter table public.exam_catalog            enable row level security;
alter table public.exam_catalog_template   enable row level security;
alter table public.exam_reference          enable row level security;
alter table public.exam_reference_override enable row level security;
alter table public.unit_alias              enable row level security;
alter table public.dri_avaliacoes          enable row level security;
alter table public.planos_alimentares      enable row level security;
alter table public.orientacoes             enable row level security;
alter table public.orientacao_templates    enable row level security;
