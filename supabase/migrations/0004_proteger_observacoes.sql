-- Liga a proteção por linha (RLS) na tabela `observacoes` (anotações da antiga Carteira).
-- Ficou de fora da 0001 porque a Carteira, ainda no ar naquela época, lia a tabela pela chave pública.
-- Com a Carteira removida, nada no app usa a tabela; os dados continuam guardados.
alter table public.observacoes enable row level security;
