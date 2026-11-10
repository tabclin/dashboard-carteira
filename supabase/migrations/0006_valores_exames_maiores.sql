-- Valores de exames maiores: alguns laboratórios escrevem hemácias como 4.590.000/mm³ (e referência 4.000.000 a 5.200.000),
-- o que não cabia em numeric(10,4) (máx. 999.999,9999) e fazia o banco recusar a análise inteira.
-- Só aumenta a capacidade para numeric(18,4): nenhum valor existente muda e a tabela não é reescrita.

alter table public.results
  alter column value_numeric type numeric(18,4),
  alter column ref_min       type numeric(18,4),
  alter column ref_max       type numeric(18,4);

alter table public.exam_catalog
  alter column critical_low   type numeric(18,4),
  alter column critical_high  type numeric(18,4),
  alter column ref_min_male   type numeric(18,4),
  alter column ref_max_male   type numeric(18,4),
  alter column ref_min_female type numeric(18,4),
  alter column ref_max_female type numeric(18,4);

alter table public.exam_catalog_template
  alter column critical_low   type numeric(18,4),
  alter column critical_high  type numeric(18,4),
  alter column ref_min_male   type numeric(18,4),
  alter column ref_max_male   type numeric(18,4),
  alter column ref_min_female type numeric(18,4),
  alter column ref_max_female type numeric(18,4);

alter table public.exam_reference
  alter column ref_min type numeric(18,4),
  alter column ref_max type numeric(18,4);

alter table public.exam_reference_override
  alter column ref_min type numeric(18,4),
  alter column ref_max type numeric(18,4);
