-- ============================================================
--  EQUIPES MULTI-USUÁRIO — ClinKPI
--  Médico (admin) + Secretária (membro) compartilham os mesmos dados
--  Execute no Supabase SQL Editor
-- ============================================================

-- ── PASSO 1: Adicionar team_id e role à tabela profiles ──────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin'
  CHECK (role IN ('admin', 'membro'));

-- Backfill: usuários existentes são admins da própria equipe
UPDATE profiles SET team_id = id WHERE team_id IS NULL;

-- Tornar obrigatório
ALTER TABLE profiles ALTER COLUMN team_id SET NOT NULL;


-- ── PASSO 2: Função auxiliar que retorna o team_id do usuário logado ──
-- Para admins: retorna o próprio id
-- Para membros (secretária): retorna o id do médico (dono dos dados)

CREATE OR REPLACE FUNCTION current_team_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(team_id, auth.uid())
  FROM profiles
  WHERE id = auth.uid()
$$;


-- ── PASSO 3: Atualizar DEFAULT de user_id em todas as tabelas ──
-- Agora inserts feitos pela secretária também vão para o espaço do médico

ALTER TABLE pacientes               ALTER COLUMN user_id SET DEFAULT current_team_id();
ALTER TABLE atendimentos            ALTER COLUMN user_id SET DEFAULT current_team_id();
ALTER TABLE agenda                  ALTER COLUMN user_id SET DEFAULT current_team_id();
ALTER TABLE servicos                ALTER COLUMN user_id SET DEFAULT current_team_id();
ALTER TABLE planos_pagamento        ALTER COLUMN user_id SET DEFAULT current_team_id();
ALTER TABLE planos_acompanhamento   ALTER COLUMN user_id SET DEFAULT current_team_id();
ALTER TABLE plano_pacientes         ALTER COLUMN user_id SET DEFAULT current_team_id();
ALTER TABLE plano_consultas         ALTER COLUMN user_id SET DEFAULT current_team_id();
ALTER TABLE fin_categorias          ALTER COLUMN user_id SET DEFAULT current_team_id();
ALTER TABLE fin_movimentacoes       ALTER COLUMN user_id SET DEFAULT current_team_id();
ALTER TABLE fin_alocacoes           ALTER COLUMN user_id SET DEFAULT current_team_id();
ALTER TABLE fin_orcamento           ALTER COLUMN user_id SET DEFAULT current_team_id();

DO $$ BEGIN
  ALTER TABLE fin_classificacoes ALTER COLUMN user_id SET DEFAULT current_team_id();
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE fin_dre_linhas ALTER COLUMN user_id SET DEFAULT current_team_id();
EXCEPTION WHEN undefined_table THEN NULL; END $$;


-- ── PASSO 4: Atualizar políticas RLS para usar current_team_id() ──
-- Antes: auth.uid() = user_id  (só o próprio usuário)
-- Agora: current_team_id() = user_id  (usuário OU membros da equipe)

-- Recriar todas as políticas

DROP POLICY IF EXISTS "tenant_isolation" ON pacientes;
CREATE POLICY "tenant_isolation" ON pacientes
  FOR ALL USING (user_id = current_team_id())
  WITH CHECK (user_id = current_team_id());

DROP POLICY IF EXISTS "tenant_isolation" ON atendimentos;
CREATE POLICY "tenant_isolation" ON atendimentos
  FOR ALL USING (user_id = current_team_id())
  WITH CHECK (user_id = current_team_id());

DROP POLICY IF EXISTS "tenant_isolation" ON agenda;
CREATE POLICY "tenant_isolation" ON agenda
  FOR ALL USING (user_id = current_team_id())
  WITH CHECK (user_id = current_team_id());

DROP POLICY IF EXISTS "tenant_isolation" ON servicos;
CREATE POLICY "tenant_isolation" ON servicos
  FOR ALL USING (user_id = current_team_id())
  WITH CHECK (user_id = current_team_id());

DROP POLICY IF EXISTS "tenant_isolation" ON planos_pagamento;
CREATE POLICY "tenant_isolation" ON planos_pagamento
  FOR ALL USING (user_id = current_team_id())
  WITH CHECK (user_id = current_team_id());

DROP POLICY IF EXISTS "tenant_isolation" ON planos_acompanhamento;
CREATE POLICY "tenant_isolation" ON planos_acompanhamento
  FOR ALL USING (user_id = current_team_id())
  WITH CHECK (user_id = current_team_id());

DROP POLICY IF EXISTS "tenant_isolation" ON plano_pacientes;
CREATE POLICY "tenant_isolation" ON plano_pacientes
  FOR ALL USING (user_id = current_team_id())
  WITH CHECK (user_id = current_team_id());

DROP POLICY IF EXISTS "tenant_isolation" ON plano_consultas;
CREATE POLICY "tenant_isolation" ON plano_consultas
  FOR ALL USING (user_id = current_team_id())
  WITH CHECK (user_id = current_team_id());

DROP POLICY IF EXISTS "tenant_isolation" ON fin_categorias;
CREATE POLICY "tenant_isolation" ON fin_categorias
  FOR ALL USING (user_id = current_team_id())
  WITH CHECK (user_id = current_team_id());

DROP POLICY IF EXISTS "tenant_isolation" ON fin_movimentacoes;
CREATE POLICY "tenant_isolation" ON fin_movimentacoes
  FOR ALL USING (user_id = current_team_id())
  WITH CHECK (user_id = current_team_id());

DROP POLICY IF EXISTS "tenant_isolation" ON fin_alocacoes;
CREATE POLICY "tenant_isolation" ON fin_alocacoes
  FOR ALL USING (user_id = current_team_id())
  WITH CHECK (user_id = current_team_id());

DROP POLICY IF EXISTS "tenant_isolation" ON fin_orcamento;
CREATE POLICY "tenant_isolation" ON fin_orcamento
  FOR ALL USING (user_id = current_team_id())
  WITH CHECK (user_id = current_team_id());

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_isolation" ON fin_classificacoes;
  CREATE POLICY "tenant_isolation" ON fin_classificacoes
    FOR ALL USING (user_id = current_team_id())
    WITH CHECK (user_id = current_team_id());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_isolation" ON fin_dre_linhas;
  CREATE POLICY "tenant_isolation" ON fin_dre_linhas
    FOR ALL USING (user_id = current_team_id())
    WITH CHECK (user_id = current_team_id());
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Tabela join (fin_dre_linha_classificacoes) — atualizar para usar current_team_id()
DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_isolation" ON fin_dre_linha_classificacoes;
  CREATE POLICY "tenant_isolation" ON fin_dre_linha_classificacoes
    FOR ALL
    USING (EXISTS (
      SELECT 1 FROM fin_dre_linhas
      WHERE id = fin_dre_linha_classificacoes.linha_id
        AND user_id = current_team_id()
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM fin_dre_linhas
      WHERE id = fin_dre_linha_classificacoes.linha_id
        AND user_id = current_team_id()
    ));
EXCEPTION WHEN undefined_table THEN NULL; END $$;


-- ── PASSO 5: Atualizar trigger de criação de usuário ──────────
-- Quando médico cria secretária pelo sistema, passa team_id nos metadados
-- O trigger lê e define o papel correto automaticamente

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_team_id UUID;
  v_role    TEXT;
BEGIN
  -- Se veio team_id nos metadados, é um membro (ex: secretária)
  -- Caso contrário, é um admin (nova conta independente)
  IF NEW.raw_user_meta_data->>'team_id' IS NOT NULL THEN
    v_team_id := (NEW.raw_user_meta_data->>'team_id')::UUID;
    v_role    := 'membro';
  ELSE
    v_team_id := NEW.id;
    v_role    := 'admin';
  END IF;

  INSERT INTO profiles (id, nome, team_id, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    v_team_id,
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ── PASSO 6: Política da tabela profiles ─────────────────────
-- Admin vê todos da sua equipe; membro vê só o próprio perfil

DROP POLICY IF EXISTS "own_profile" ON profiles;

-- Leitura: admin vê todos com team_id = seu id; membro vê só si mesmo
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR (
      team_id = auth.uid()  -- admin vê membros da sua equipe
    )
  );

-- Escrita: cada um edita só o próprio perfil
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Insert: apenas pelo trigger (SECURITY DEFINER não precisa de policy)
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());


-- ── VERIFICAÇÃO ───────────────────────────────────────────────
-- Confirme que a função foi criada:
-- SELECT current_team_id();   -- deve retornar seu UUID (admin) ou UUID do médico (membro)
--
-- Confira os perfis:
-- SELECT id, nome, team_id, role FROM profiles;
