-- ── Unificação de Banco: ClinKPI + CkEx ──────────────────────────
-- Execute no Supabase do ClinKPI (hlfiykpoousspkcdswer)
-- Cria todas as tabelas do Check Exames neste banco

-- ── 1. Enums do CkEx ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'CLINIC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AnalysisStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'FINALIZED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ResultStatus" AS ENUM ('NOT_EVALUATED', 'NORMAL', 'ATTENTION', 'DANGER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "UsageAction" AS ENUM (
    'PDF_UPLOAD', 'AI_EXTRACTION', 'AI_INTERPRETATION', 'REPORT_GENERATED', 'REPORT_SENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Tabelas do CkEx ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  plan       "Plan" NOT NULL DEFAULT 'FREE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professionals (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  auth_user_id TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  crm          TEXT,
  specialty    TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patients (
  id              TEXT PRIMARY KEY,
  professional_id TEXT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  birth_date      DATE,
  email           TEXT,
  phone           TEXT,
  sex             TEXT,
  notes           TEXT,
  clinikpi_id     UUID UNIQUE,   -- vínculo com pacientes.id do ClinKPI
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analyses (
  id               TEXT PRIMARY KEY,
  patient_id       TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  professional_id  TEXT NOT NULL REFERENCES professionals(id),
  collected_at     DATE NOT NULL,
  lab_name         TEXT,
  status           "AnalysisStatus" NOT NULL DEFAULT 'DRAFT',
  pdf_url          TEXT,
  pdf_storage_path TEXT,
  notes            TEXT,
  finalized_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS results (
  id               TEXT PRIMARY KEY,
  analysis_id      TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  catalog_id       TEXT,
  exam_name        TEXT NOT NULL,
  exam_slug        TEXT NOT NULL,
  extracted_name   TEXT,
  category         TEXT,
  value            TEXT,
  value_numeric    DECIMAL(10,4),
  unit             TEXT,
  ref_min          DECIMAL(10,4),
  ref_max          DECIMAL(10,4),
  ref_text         TEXT,
  status           "ResultStatus" NOT NULL DEFAULT 'NOT_EVALUATED',
  professional_note TEXT,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_catalog_template (
  id            TEXT PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  category      TEXT,
  description   TEXT,
  unit          TEXT,
  critical_low  DECIMAL(10,4),
  critical_high DECIMAL(10,4),
  ref_min_male  DECIMAL(10,4),
  ref_max_male  DECIMAL(10,4),
  ref_min_female DECIMAL(10,4),
  ref_max_female DECIMAL(10,4),
  aliases       TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_reference (
  id                  TEXT PRIMARY KEY,
  catalog_template_id TEXT NOT NULL REFERENCES exam_catalog_template(id) ON DELETE CASCADE,
  unit                TEXT NOT NULL,
  sex                 TEXT NOT NULL DEFAULT 'U',
  age_min_months      INT,
  age_max_months      INT,
  ref_min             DECIMAL(10,4),
  ref_max             DECIMAL(10,4),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_catalog (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL,
  professional_id TEXT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL,
  category        TEXT,
  description     TEXT,
  unit            TEXT,
  critical_low    DECIMAL(10,4),
  critical_high   DECIMAL(10,4),
  ref_min_male    DECIMAL(10,4),
  ref_max_male    DECIMAL(10,4),
  ref_min_female  DECIMAL(10,4),
  ref_max_female  DECIMAL(10,4),
  aliases         TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(slug, professional_id)
);

-- FK de results para exam_catalog (adicionada após ambas as tabelas existirem)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'results_catalog_id_fkey' AND table_name = 'results'
  ) THEN
    ALTER TABLE results ADD CONSTRAINT results_catalog_id_fkey
      FOREIGN KEY (catalog_id) REFERENCES exam_catalog(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS unit_alias (
  id        TEXT PRIMARY KEY,
  canonical TEXT NOT NULL,
  alias     TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_reference_override (
  id                TEXT PRIMARY KEY,
  professional_id   TEXT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  exam_reference_id TEXT NOT NULL REFERENCES exam_reference(id) ON DELETE CASCADE,
  ref_min           DECIMAL(10,4),
  ref_max           DECIMAL(10,4),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(professional_id, exam_reference_id)
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action     "UsageAction" NOT NULL,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Trigger: sync automático pacientes → patients ─────────────
-- Quando um paciente é criado/atualizado no ClinKPI,
-- espelha automaticamente na tabela patients do CkEx

CREATE OR REPLACE FUNCTION sync_paciente_to_ckex()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_professional_id TEXT;
  v_birth_date      DATE;
BEGIN
  -- Encontrar o professional_id no CkEx para este usuário ClinKPI
  SELECT id INTO v_professional_id
  FROM professionals
  WHERE auth_user_id = NEW.user_id::TEXT
  LIMIT 1;

  -- Sem professional vinculado → nada a fazer (CkEx ainda não configurado)
  IF v_professional_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Converter nascimento (TEXT) para DATE com segurança
  BEGIN
    v_birth_date := NEW.nascimento::DATE;
  EXCEPTION WHEN OTHERS THEN
    v_birth_date := NULL;
  END;

  INSERT INTO patients (id, professional_id, name, birth_date, clinikpi_id, created_at, updated_at)
  VALUES (
    gen_random_uuid()::TEXT,
    v_professional_id,
    NEW.paciente,
    v_birth_date,
    NEW.id,
    NOW(),
    NOW()
  )
  ON CONFLICT (clinikpi_id) DO UPDATE SET
    name       = EXCLUDED.name,
    birth_date = EXCLUDED.birth_date,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_paciente_to_ckex ON pacientes;
CREATE TRIGGER trg_sync_paciente_to_ckex
  AFTER INSERT OR UPDATE ON pacientes
  FOR EACH ROW EXECUTE FUNCTION sync_paciente_to_ckex();
