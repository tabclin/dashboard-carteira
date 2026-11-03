// Aplica no banco, em ordem, os arquivos de supabase/migrations que ainda não foram aplicados.
// Cada arquivo roda numa transação; os aplicados ficam registrados em public._migracoes.
// Uso: node scripts/aplicar-migracoes.mjs            (aplica)
//      node scripts/aplicar-migracoes.mjs --ensaio   (roda tudo e desfaz no fim, sem gravar)
import { readFileSync, readdirSync } from 'node:fs'
import { config } from 'dotenv'
import pg from 'pg'
config({ path: '.env.local', quiet: true })
const ensaio = process.argv.includes('--ensaio')
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
await db.query(`create table if not exists public._migracoes (arquivo text primary key, aplicada_em timestamptz not null default now());
                alter table public._migracoes enable row level security;`)
const feitas = new Set((await db.query('select arquivo from public._migracoes')).rows.map((r) => r.arquivo))
const pendentes = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql') && !feitas.has(f)).sort()
if (!pendentes.length) console.log('nada pendente')
for (const f of pendentes) {
  await db.query('begin')
  try {
    await db.query(readFileSync(`supabase/migrations/${f}`, 'utf8'))
    await db.query('insert into public._migracoes (arquivo) values ($1)', [f])
    await db.query(ensaio ? 'rollback' : 'commit')
    console.log((ensaio ? 'ensaio ok (desfeito): ' : 'aplicada: ') + f)
  } catch (e) {
    await db.query('rollback'); console.error('FALHOU (nada gravado): ' + f + ' -> ' + e.message); process.exitCode = 1; break
  }
}
await db.end()
