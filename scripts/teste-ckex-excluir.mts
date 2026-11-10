// Testa o Check Exames num login temporário: botão de excluir análise e PDF que não vira exames (não cria análise vazia).
// Nunca usa pacientes reais: cria uma paciente fictícia no login temporário e apaga tudo no fim.
// Uso: npx next dev -p 3510  e depois  BASE=http://localhost:3510 PDF=caminho.pdf node scripts/teste-ckex-excluir.mts
import { chromium } from 'playwright-core'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { randomBytes } from 'node:crypto'
config({ path: '.env.local', quiet: true })
const B = process.env.BASE ?? 'http://localhost:3510'
const PDF = process.env.PDF // um laudo em PDF para o teste de leitura (opcional)
const SAIDA = process.env.SAIDA ?? '.'
const adm = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const q = async (sql: string, v: unknown[] = []) => (await db.query(sql, v)).rows
const EMAIL = 'teste-ckex@tabclin.local', SENHA = randomBytes(12).toString('base64url')
const { data: u, error } = await adm.auth.admin.createUser({ email: EMAIL, password: SENHA, email_confirm: true }); if (error) throw error
const ok = (c: unknown, m: string) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) process.exitCode = 1 }
const api = (p: import('playwright-core').Page, url: string, method = 'GET', body?: unknown) =>
  p.evaluate(async ([url, method, body]) => { const r = await fetch(url as string, { method: method as string, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => null) } }, [url, method, body] as const)

try {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const p = await (await b.newContext({ viewport: { width: 1360, height: 1000 } })).newPage()
  const erros: string[] = []; p.on('pageerror', (e) => erros.push(e.message))
  await p.goto(B + '/login'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500) // espera hidratar (no dev compila na hora)
  await p.fill('input[type=email]', EMAIL); await p.fill('input[placeholder="••••••••"]', SENHA); await p.click('button[type=submit]')
  await p.waitForURL((x) => x.pathname !== '/login', { timeout: 120000 }); await p.waitForLoadState('networkidle')

  const pac = (await api(p, '/api/ckex/patients', 'POST', { name: 'Teste Ckex Fulana', birthDate: '2021-07-29', sex: 'F' })).json
  ok(pac?.id, 'paciente fictícia criada')
  const nova = (dia: string, results: unknown[]) => api(p, '/api/ckex/analyses', 'POST', { patientId: pac.id, collectedAt: dia, labName: 'Lab Teste', results })
  const a1 = (await nova('2026-10-01', [])).json
  const a2 = (await nova('2026-10-20', [{ examName: 'Hemoglobina', examSlug: 'hemoglobina', category: 'Hemograma', value: '12,3', valueNumeric: 12.3, unit: 'g/dL', refMin: 11.5, refMax: 13.5, refText: '11,5 - 13,5', status: 'NORMAL' }])).json
  ok(a1?.id && a2?.id, 'duas análises fictícias criadas (uma vazia, uma com exame)')

  // ── botão de excluir na tela da paciente ──
  await p.goto(B + `/check-exames/pacientes/${pac.id}`); await p.waitForLoadState('networkidle')
  const lixeiras = p.getByRole('button', { name: /Excluir análise de/ })
  ok((await lixeiras.count()) === 2, 'uma lixeira por análise (' + (await lixeiras.count()) + ')')
  await p.screenshot({ path: `${SAIDA}/tela-paciente-lixeiras.png` })

  // cancelar a confirmação não apaga nada
  p.once('dialog', (d) => d.dismiss())
  await p.getByRole('button', { name: 'Excluir análise de 01/10/2026' }).click()
  await p.waitForTimeout(800)
  ok((await q('select count(*)::int n from analyses where patient_id = $1', [pac.id]))[0].n === 2, 'cancelar a confirmação mantém a análise')

  // confirmar apaga só a análise vazia
  let msg = ''
  p.once('dialog', (d) => { msg = d.message(); d.accept() })
  await p.getByRole('button', { name: 'Excluir análise de 01/10/2026' }).click()
  await p.getByText('Análise excluída').waitFor()
  ok(msg.includes('01/10/2026') && msg.includes('0 exames'), 'confirmação mostra a data e a quantidade (' + msg + ')')
  const restantes = await q('select id from analyses where patient_id = $1', [pac.id])
  ok(restantes.length === 1 && restantes[0].id === a2.id, 'só a análise escolhida foi apagada')
  await p.getByText('Análises realizadas (1)').waitFor()
  ok(true, 'a lista atualiza sem recarregar a página')

  // segurança: não apaga análise de outro login
  const [outra] = await q("select id from analyses where professional_id <> (select id from professionals where auth_user_id = $1) limit 1", [u.user.id])
  if (outra) ok((await api(p, `/api/ckex/analyses/${outra.id}`, 'DELETE')).status === 404, 'não apaga análise de outro login')

  // ── PDF que não vira exames: avisa o motivo e não cria análise vazia ──
  if (PDF) {
    await p.goto(B + `/check-exames/analises/nova?patientId=${pac.id}`); await p.waitForLoadState('networkidle')
    await p.locator('input[type=file]').setInputFiles(PDF)
    const toast = p.locator('[data-sonner-toast]').last()
    await toast.waitFor({ timeout: 120000 })
    const texto = await toast.innerText()
    console.log('      aviso na tela: ' + texto.replace(/\s+/g, ' '))
    await p.screenshot({ path: `${SAIDA}/tela-pdf.png` })
    const n = (await q('select count(*)::int n from analyses where patient_id = $1', [pac.id]))[0].n
    if (/extraído/.test(texto)) {
      ok(n === 2, 'PDF lido: análise criada com exames')
      // laudos que escrevem hemácias como 4.590.000/mm³ precisam caber no banco (migração 0006)
      const [mx] = await q('select max(r.value_numeric)::float m, count(*)::int n from results r join analyses a on a.id = r.analysis_id where a.patient_id = $1', [pac.id])
      console.log(`      ${mx.n} resultados gravados; maior valor ${mx.m}`)
    }
    else ok(n === 1 && /Nenhuma análise foi criada/.test(texto), 'PDF sem exames: aviso claro e nenhuma análise vazia criada')
  }

  ok(erros.length === 0, 'sem erros na página' + (erros[0] ? ': ' + erros[0].slice(0, 200) : ''))
  await b.close()
} finally {
  const [pr] = await q('select id, org_id from professionals where auth_user_id = $1', [u.user.id])
  if (pr) {
    for (const t of ['analyses', 'tarefas', 'patients']) await q(`delete from ${t} where professional_id = $1`, [pr.id]).catch((e) => console.log('limpeza', t, e.message))
    await q('delete from usage_logs where org_id = $1', [pr.org_id]).catch(() => {})
    await q('delete from professionals where id = $1', [pr.id]); await q('delete from organizations where id = $1', [pr.org_id])
  }
  await adm.auth.admin.deleteUser(u.user.id); await db.end(); console.log('login e dados de teste removidos')
}
