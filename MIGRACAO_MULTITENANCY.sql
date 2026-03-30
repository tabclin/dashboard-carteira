-- ============================================================
--  MIGRAÇÃO: Multi-Tenancy — Row Level Security
--  ClinKPI — Execute no Supabase SQL Editor
--  (Supabase Dashboard → SQL Editor → New query → Cole e rode)
-- ============================================================

-- ============================================================
-- PASSO 1 — Adicionar coluna user_id em todas as tabelas
-- ============================================================

ALTER TABLE pacientes               ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE atendimentos            ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE agenda                  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE servicos                ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE planos_pagamento        ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE planos_acompanhamento   ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE plano_pacientes         ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE plano_consultas         ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE fin_categorias          ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE fin_movimentacoes       ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE fin_alocacoes           ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE fin_orcamento           ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE fin_classificacoes      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE fin_dre_linhas          ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;


-- ============================================================
-- PASSO 2 — Definir DEFAULT auth.uid() para novos registros
--           (inserts feitos pelo app NÃO precisam passar user_id)
-- ============================================================

ALTER TABLE pacientes               ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE atendimentos            ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE agenda                  ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE servicos                ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE planos_pagamento        ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE planos_acompanhamento   ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE plano_pacientes         ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE plano_consultas         ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE fin_categorias          ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE fin_movimentacoes       ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE fin_alocacoes           ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE fin_orcamento           ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE fin_classificacoes      ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE fin_dre_linhas          ALTER COLUMN user_id SET DEFAULT auth.uid();


-- ============================================================
-- PASSO 3 — Backfill de dados existentes
--
-- SE você já tem dados no banco (pacientes, atendimentos, etc.)
-- precisa associá-los ao usuário atual ANTES de habilitar RLS.
-- Caso contrário esses dados ficarão invisíveis.
--
-- Como obter seu user_id:
--   Supabase Dashboard → Authentication → Users → copie o UUID
--
-- Descomente as linhas abaixo, substituindo 'SEU-USER-UUID-AQUI'
-- ============================================================

-- DO $$
-- DECLARE v_uid UUID := 'SEU-USER-UUID-AQUI';
-- BEGIN
--   UPDATE pacientes               SET user_id = v_uid WHERE user_id IS NULL;
--   UPDATE atendimentos            SET user_id = v_uid WHERE user_id IS NULL;
--   UPDATE agenda                  SET user_id = v_uid WHERE user_id IS NULL;
--   UPDATE servicos                SET user_id = v_uid WHERE user_id IS NULL;
--   UPDATE planos_pagamento        SET user_id = v_uid WHERE user_id IS NULL;
--   UPDATE planos_acompanhamento   SET user_id = v_uid WHERE user_id IS NULL;
--   UPDATE plano_pacientes         SET user_id = v_uid WHERE user_id IS NULL;
--   UPDATE plano_consultas         SET user_id = v_uid WHERE user_id IS NULL;
--   UPDATE fin_categorias          SET user_id = v_uid WHERE user_id IS NULL;
--   UPDATE fin_movimentacoes       SET user_id = v_uid WHERE user_id IS NULL;
--   UPDATE fin_alocacoes           SET user_id = v_uid WHERE user_id IS NULL;
--   UPDATE fin_orcamento           SET user_id = v_uid WHERE user_id IS NULL;
--   UPDATE fin_classificacoes      SET user_id = v_uid WHERE user_id IS NULL;
--   UPDATE fin_dre_linhas          SET user_id = v_uid WHERE user_id IS NULL;
-- END $$;


-- ============================================================
-- PASSO 4 — Habilitar Row Level Security em todas as tabelas
-- ============================================================

ALTER TABLE pacientes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimentos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos_pagamento        ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos_acompanhamento   ENABLE ROW LEVEL SECURITY;
ALTER TABLE plano_pacientes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE plano_consultas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_categorias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_movimentacoes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_alocacoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_orcamento           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_classificacoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_dre_linhas          ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- PASSO 5 — Criar políticas de isolamento por usuário
--           SELECT / INSERT / UPDATE / DELETE tudo isolado
-- ============================================================

-- Cada política garante: usuário só lê e grava os próprios dados

CREATE POLICY "tenant_isolation" ON pacientes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tenant_isolation" ON atendimentos
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tenant_isolation" ON agenda
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tenant_isolation" ON servicos
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tenant_isolation" ON planos_pagamento
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tenant_isolation" ON planos_acompanhamento
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tenant_isolation" ON plano_pacientes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tenant_isolation" ON plano_consultas
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tenant_isolation" ON fin_categorias
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tenant_isolation" ON fin_movimentacoes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tenant_isolation" ON fin_alocacoes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tenant_isolation" ON fin_orcamento
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tenant_isolation" ON fin_classificacoes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tenant_isolation" ON fin_dre_linhas
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tabela de join (fin_dre_linha_classificacoes) — isolamento via tabela pai
-- Não precisa de user_id próprio: herda a segurança do fin_dre_linhas
ALTER TABLE fin_dre_linha_classificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON fin_dre_linha_classificacoes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM fin_dre_linhas
      WHERE id = fin_dre_linha_classificacoes.linha_id
        AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM fin_dre_linhas
      WHERE id = fin_dre_linha_classificacoes.linha_id
        AND user_id = auth.uid()
    )
  );


-- ============================================================
-- PASSO 6 — Índices de performance (queries por user_id)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_pacientes_user_id             ON pacientes(user_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_user_id          ON atendimentos(user_id);
CREATE INDEX IF NOT EXISTS idx_agenda_user_id                ON agenda(user_id);
CREATE INDEX IF NOT EXISTS idx_servicos_user_id              ON servicos(user_id);
CREATE INDEX IF NOT EXISTS idx_planos_pagamento_user_id      ON planos_pagamento(user_id);
CREATE INDEX IF NOT EXISTS idx_planos_acompanhamento_user_id ON planos_acompanhamento(user_id);
CREATE INDEX IF NOT EXISTS idx_plano_pacientes_user_id       ON plano_pacientes(user_id);
CREATE INDEX IF NOT EXISTS idx_plano_consultas_user_id       ON plano_consultas(user_id);
CREATE INDEX IF NOT EXISTS idx_fin_categorias_user_id        ON fin_categorias(user_id);
CREATE INDEX IF NOT EXISTS idx_fin_movimentacoes_user_id     ON fin_movimentacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_fin_alocacoes_user_id         ON fin_alocacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_fin_orcamento_user_id         ON fin_orcamento(user_id);
CREATE INDEX IF NOT EXISTS idx_fin_classificacoes_user_id    ON fin_classificacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_fin_dre_linhas_user_id        ON fin_dre_linhas(user_id);


-- ============================================================
-- PASSO 7 — Criar tabela de perfis (nome da clínica/profissional)
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL DEFAULT '',
  tipo       TEXT NOT NULL DEFAULT 'clinica' CHECK (tipo IN ('clinica', 'profissional')),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Usuário só acessa o próprio perfil
CREATE POLICY "own_profile" ON profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger: criar perfil automaticamente ao cadastrar novo usuário
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- VERIFICAÇÃO FINAL
-- Rode para confirmar que RLS está ativo em todas as tabelas:
-- ============================================================

-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'pacientes','atendimentos','agenda','servicos',
--     'planos_pagamento','planos_acompanhamento','plano_pacientes','plano_consultas',
--     'fin_categorias','fin_movimentacoes','fin_alocacoes','fin_orcamento',
--     'fin_classificacoes','fin_dre_linhas','fin_dre_linha_classificacoes',
--     'profiles'
--   )
-- ORDER BY tablename;
-- Todas as linhas devem mostrar rowsecurity = true
