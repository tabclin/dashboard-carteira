// Mede o tempo das telas com um volume parecido com o da Dra. (≈1.400 pacientes, 3.100 consultas, análises e tarefas),
// num login temporário com dados fictícios que são apagados no fim.
// Uso: npm run build && npx next start -p 3300   e depois   node scripts/medir-velocidade.mts
import { chromium } from 'playwright-core'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { randomBytes, randomUUID } from 'node:crypto'
config({ path: '.env.local', quiet: true })
const B = process.env.BASE ?? 'http://localhost:3300'
const adm = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const q = async (sql: string, a: unknown[] = []) => (await db.query(sql, a)).rows

// ida e volta ao banco, para separar o tempo da rede do tempo do app
const t0 = performance.now(); for (let i = 0; i < 5; i++) await q('select 1'); const ping = (performance.now() - t0) / 5

const senha = randomBytes(12).toString('base64url'), email = 'teste-velocidade@tabclin.local'
const { data: u, error } = await adm.auth.admin.createUser({ email, password: senha, email_confirm: true }); if (error) throw error
try {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage()
  await p.goto(B + '/login'); await p.fill('input[type=email]', email); await p.fill('input[placeholder="••••••••"]', senha); await p.click('button[type=submit]')
  await p.waitForURL((x) => x.pathname === '/tarefas')
  const [{ id: prof }] = await q('select id from professionals where auth_user_id = $1', [u.user.id])

  // volume fictício
  const ids = Array.from({ length: 1400 }, () => randomUUID())
  await q(`insert into patients (id, professional_id, name, birth_date, proximo_agendamento, updated_at)
           select id, $2, 'TESTE Vel ' || n, date '2015-01-01' + (n::int % 3000), case when n % 4 = 0 then current_date + (n::int % 60) end, now()
           from unnest($1::text[]) with ordinality as t(id, n)`, [ids, prof])
  await q(`insert into consultas (professional_id, patient_id, paciente_nome, data, tipo, tipo_resumido, servico, origem)
           select $2, ids[1 + (n % 1400)], 'x', current_date - (n % 1800), 'Consulta', 'consulta', 'Consulta pediátrica', 'planilha'
           from generate_series(1, 3100) n, (select $1::text[] ids) s`, [ids, prof])
  const analises = Array.from({ length: 50 }, () => randomUUID())
  await q(`insert into analyses (id, patient_id, professional_id, collected_at, status, updated_at)
           select a, ($2::text[])[1 + n::int], $3, current_date - n::int, case when n % 6 = 0 then 'DRAFT' else 'FINALIZED' end::"AnalysisStatus", now()
           from unnest($1::text[]) with ordinality as t(a, n)`, [analises, ids, prof])
  await q(`insert into results (id, analysis_id, exam_name, exam_slug, value, updated_at)
           select gen_random_uuid()::text, a, 'Exame ' || k, 'exame_' || k, '10', now() from unnest($1::text[]) a, generate_series(1, 35) k`, [analises])
  await q(`insert into tarefas (professional_id, patient_id, tipo, prazo)
           select $2, ($1::text[])[1 + n], (array['exames','dri','orientacao'])[1 + n % 3], current_date + (n % 20) - 5 from generate_series(1, 30) n`, [ids, prof])

  const telas: [string, string][] = [
    ['Tarefas', '/tarefas'], ['Pacientes (1.400)', '/pacientes'], ['Ficha do paciente', `/pacientes/${ids[1]}`],
    ['Check Exames: pacientes', '/check-exames/pacientes'], ['Check Exames: nova análise', '/check-exames/analises/nova'],
    ['Check Exames: análise', `/check-exames/analises/${analises[0]}`], ['DRI', '/dri/calculadora'], ['Orientações', '/orientacoes'], ['Configurações', '/configuracoes'],
  ]
  console.log(`ida e volta ao banco: ${ping.toFixed(0)} ms\n`)
  console.log('tela'.padEnd(30), 'servidor (ms)'.padStart(14), 'tela pronta (ms)'.padStart(17))
  for (const [nome, url] of telas) {
    await p.goto(B + url); await p.waitForLoadState('networkidle') // aquece
    const medidas: { ttfb: number; total: number }[] = []
    for (let i = 0; i < 3; i++) {
      await p.goto(B + url); await p.waitForLoadState('networkidle')
      medidas.push(await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming; return { ttfb: n.responseStart - n.requestStart, total: n.loadEventEnd - n.startTime } }))
    }
    const med = (k: 'ttfb' | 'total') => medidas.map((m) => m[k]).sort((a, z) => a - z)[1]
    console.log(nome.padEnd(30), med('ttfb').toFixed(0).padStart(14), med('total').toFixed(0).padStart(17))
  }
  // navegação pelo menu (sem recarregar a página)
  await p.goto(B + '/tarefas'); await p.waitForLoadState('networkidle')
  for (const item of ['Pacientes', 'Check Exames', 'DRI', 'Orientações', 'Tarefas']) {
    const t = performance.now()
    await p.locator('aside nav a', { hasText: item }).click(); await p.waitForLoadState('networkidle')
    console.log(`clique no menu → ${item}`.padEnd(30), (performance.now() - t).toFixed(0).padStart(14))
  }
  await b.close()
} finally {
  const [pr] = await q('select id, org_id from professionals where auth_user_id = $1', [u.user.id])
  if (pr) {
    for (const t of ['tarefas', 'consultas', 'analyses', 'patients', 'exam_reference_override', 'exam_catalog']) await q(`delete from ${t} where professional_id = $1`, [pr.id]).catch(() => {})
    await q('delete from professionals where id = $1', [pr.id]); await q('delete from organizations where id = $1', [pr.org_id])
  }
  await adm.auth.admin.deleteUser(u.user.id); await db.end(); console.log('\nlogin e dados de teste removidos')
}
