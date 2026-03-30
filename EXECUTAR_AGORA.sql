-- ============================================================
--  EXECUTAR AGORA — Multi-Tenancy ClinKPI
--  Cole e rode no Supabase SQL Editor (uma única execução)
-- ============================================================

DO $$
DECLARE
  v_uid UUID;
BEGIN
  -- Busca o UUID do usuário dono dos dados existentes pelo e-mail
  SELECT id INTO v_uid
  FROM auth.users
  WHERE email = 'tab@tabclin.com'
  LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário tab@tabclin.com não encontrado. Verifique o e-mail.';
  END IF;

  RAISE NOTICE 'Usuário encontrado: %', v_uid;

  -- ── PASSO 1: Adicionar coluna user_id em todas as tabelas ──

  EXECUTE 'ALTER TABLE pacientes               ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE';
  EXECUTE 'ALTER TABLE atendimentos            ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE';
  EXECUTE 'ALTER TABLE agenda                  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE';
  EXECUTE 'ALTER TABLE servicos                ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE';
  EXECUTE 'ALTER TABLE planos_pagamento        ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE';
  EXECUTE 'ALTER TABLE planos_acompanhamento   ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE';
  EXECUTE 'ALTER TABLE plano_pacientes         ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE';
  EXECUTE 'ALTER TABLE plano_consultas         ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE';
  EXECUTE 'ALTER TABLE fin_categorias          ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE';
  EXECUTE 'ALTER TABLE fin_movimentacoes       ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE';
  EXECUTE 'ALTER TABLE fin_alocacoes           ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE';
  EXECUTE 'ALTER TABLE fin_orcamento           ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE';

  -- Tabelas novas (podem não existir ainda — ignora erro se não existir)
  BEGIN
    EXECUTE 'ALTER TABLE fin_classificacoes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE';
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER TABLE fin_dre_linhas ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE';
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- ── PASSO 2: DEFAULT auth.uid() para novos registros ──

  EXECUTE 'ALTER TABLE pacientes               ALTER COLUMN user_id SET DEFAULT auth.uid()';
  EXECUTE 'ALTER TABLE atendimentos            ALTER COLUMN user_id SET DEFAULT auth.uid()';
  EXECUTE 'ALTER TABLE agenda                  ALTER COLUMN user_id SET DEFAULT auth.uid()';
  EXECUTE 'ALTER TABLE servicos                ALTER COLUMN user_id SET DEFAULT auth.uid()';
  EXECUTE 'ALTER TABLE planos_pagamento        ALTER COLUMN user_id SET DEFAULT auth.uid()';
  EXECUTE 'ALTER TABLE planos_acompanhamento   ALTER COLUMN user_id SET DEFAULT auth.uid()';
  EXECUTE 'ALTER TABLE plano_pacientes         ALTER COLUMN user_id SET DEFAULT auth.uid()';
  EXECUTE 'ALTER TABLE plano_consultas         ALTER COLUMN user_id SET DEFAULT auth.uid()';
  EXECUTE 'ALTER TABLE fin_categorias          ALTER COLUMN user_id SET DEFAULT auth.uid()';
  EXECUTE 'ALTER TABLE fin_movimentacoes       ALTER COLUMN user_id SET DEFAULT auth.uid()';
  EXECUTE 'ALTER TABLE fin_alocacoes           ALTER COLUMN user_id SET DEFAULT auth.uid()';
  EXECUTE 'ALTER TABLE fin_orcamento           ALTER COLUMN user_id SET DEFAULT auth.uid()';
  BEGIN
    EXECUTE 'ALTER TABLE fin_classificacoes  ALTER COLUMN user_id SET DEFAULT auth.uid()';
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER TABLE fin_dre_linhas      ALTER COLUMN user_id SET DEFAULT auth.uid()';
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- ── PASSO 3: Backfill — todos os dados existentes vão para tab@tabclin.com ──

  UPDATE pacientes               SET user_id = v_uid WHERE user_id IS NULL;
  UPDATE atendimentos            SET user_id = v_uid WHERE user_id IS NULL;
  UPDATE agenda                  SET user_id = v_uid WHERE user_id IS NULL;
  UPDATE servicos                SET user_id = v_uid WHERE user_id IS NULL;
  UPDATE planos_pagamento        SET user_id = v_uid WHERE user_id IS NULL;
  UPDATE planos_acompanhamento   SET user_id = v_uid WHERE user_id IS NULL;
  UPDATE plano_pacientes         SET user_id = v_uid WHERE user_id IS NULL;
  UPDATE plano_consultas         SET user_id = v_uid WHERE user_id IS NULL;
  UPDATE fin_categorias          SET user_id = v_uid WHERE user_id IS NULL;
  UPDATE fin_movimentacoes       SET user_id = v_uid WHERE user_id IS NULL;
  UPDATE fin_alocacoes           SET user_id = v_uid WHERE user_id IS NULL;
  UPDATE fin_orcamento           SET user_id = v_uid WHERE user_id IS NULL;
  BEGIN
    UPDATE fin_classificacoes    SET user_id = v_uid WHERE user_id IS NULL;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  BEGIN
    UPDATE fin_dre_linhas        SET user_id = v_uid WHERE user_id IS NULL;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  RAISE NOTICE 'Backfill concluído — todos os dados associados a tab@tabclin.com';

  -- ── PASSO 4: Habilitar RLS ──

  EXECUTE 'ALTER TABLE pacientes               ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE atendimentos            ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE agenda                  ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE servicos                ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE planos_pagamento        ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE planos_acompanhamento   ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE plano_pacientes         ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE plano_consultas         ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE fin_categorias          ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE fin_movimentacoes       ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE fin_alocacoes           ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE fin_orcamento           ENABLE ROW LEVEL SECURITY';
  BEGIN
    EXECUTE 'ALTER TABLE fin_classificacoes    ENABLE ROW LEVEL SECURITY';
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER TABLE fin_dre_linhas        ENABLE ROW LEVEL SECURITY';
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  RAISE NOTICE 'RLS habilitado em todas as tabelas';

END $$;


-- ── PASSO 5: Criar políticas de isolamento (fora do bloco DO) ──
-- Ignora erro se a política já existir

DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON pacientes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON atendimentos
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON agenda
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON servicos
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON planos_pagamento
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON planos_acompanhamento
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON plano_pacientes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON plano_consultas
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON fin_categorias
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON fin_movimentacoes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON fin_alocacoes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON fin_orcamento
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON fin_classificacoes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN undefined_table OR duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON fin_dre_linhas
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN undefined_table OR duplicate_object THEN NULL;
END $$;

-- Tabela de join (fin_dre_linha_classificacoes) — via tabela pai
DO $$ BEGIN
  ALTER TABLE fin_dre_linha_classificacoes ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "tenant_isolation" ON fin_dre_linha_classificacoes
    FOR ALL
    USING (EXISTS (
      SELECT 1 FROM fin_dre_linhas
      WHERE id = fin_dre_linha_classificacoes.linha_id
        AND user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM fin_dre_linhas
      WHERE id = fin_dre_linha_classificacoes.linha_id
        AND user_id = auth.uid()
    ));
EXCEPTION WHEN undefined_table OR duplicate_object THEN NULL;
END $$;


-- ── PASSO 6: Criar tabela de perfis e trigger ──

CREATE TABLE IF NOT EXISTS profiles (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome      TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "own_profile" ON profiles
    FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill de perfis para usuários já existentes
INSERT INTO profiles (id, nome)
SELECT id, COALESCE(raw_user_meta_data->>'nome', email)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Trigger: perfil criado automaticamente para novos usuários
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


-- ── PASSO 7: Índices de performance ──

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


-- ── VERIFICAÇÃO FINAL ──
-- Rode isso separado para confirmar que tudo funcionou:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
-- (todas as tabelas de dados devem mostrar rowsecurity = true)
