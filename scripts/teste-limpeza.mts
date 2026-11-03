// Testa o app depois da limpeza (só Pacientes, Check Exames, DRI e Orientações) com um login temporário.
// Nunca usa pacientes reais: cria um paciente de teste no login temporário e apaga tudo no fim.
// Uso: npm run build && npx next start -p 3300  e depois  node scripts/teste-limpeza.mts
import { chromium } from 'playwright-core'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { randomBytes } from 'node:crypto'
config({ path: '.env.local', quiet: true })
const B = 'http://localhost:3300'
const adm = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const EMAIL = 'teste-limpeza@tabclin.local', SENHA = randomBytes(12).toString('base64url')
const { data: u, error } = await adm.auth.admin.createUser({ email: EMAIL, password: SENHA, email_confirm: true }); if (error) throw error
const ok = (c: unknown, m: string) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) process.exitCode = 1 }
try {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage()
  const erros: string[] = []; p.on('console', (m) => m.type() === 'error' && erros.push(m.text())); p.on('pageerror', (e) => erros.push(e.message))
  await p.goto(B + '/login'); await p.fill('input[type=email]', EMAIL); await p.fill('input[placeholder="••••••••"]', SENHA); await p.click('button[type=submit]')
  await p.waitForURL((x) => x.pathname === '/pacientes'); ok(true, 'depois do login abre direto em Pacientes')
  await p.waitForLoadState('networkidle')

  // login novo: o perfil do profissional é criado logo na entrada (antes só no Check Exames)
  const { rows: [prof] } = await db.query('select id, org_id from professionals where auth_user_id = $1', [u.user.id])
  ok(prof, 'perfil do profissional criado logo na primeira entrada')

  const menu = (await p.locator('aside nav a').allInnerTexts()).map((t) => t.trim())
  ok(JSON.stringify(menu) === JSON.stringify(['Pacientes', 'Check Exames', 'DRI', 'Orientações']), 'menu só com Pacientes, Check Exames, DRI e Orientações: ' + menu.join(', '))

  await p.goto(B + '/check-exames'); await p.waitForURL(/check-exames\/pacientes/); await p.waitForLoadState('networkidle')
  ok(!(await p.content()).includes('Application error'), 'Check Exames abre')

  // cadastro de paciente pelo Check Exames grava só na tabela patients
  const r = await p.evaluate(async () => (await fetch('/api/ckex/patients', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'TESTE LIMPEZA paciente', birthDate: '2022-05-10', sex: 'F' }) })).json())
  ok(r.id && r.name === 'TESTE LIMPEZA paciente', 'Check Exames cadastra paciente')
  const { rows: [antigos] } = await db.query('select count(*)::int n from pacientes where user_id::text = $1', [u.user.id])
  ok(antigos.n === 0, 'nada é gravado na tabela antiga de pacientes')
  const dup = await p.evaluate(async () => (await fetch('/api/ckex/patients', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'teste limpeza PACIENTE' }) })).status)
  ok(dup === 409, 'nome repetido (sem diferenciar maiúsculas) é recusado')

  await p.goto(B + `/check-exames/analises/nova?patientId=${r.id}`)
  ok(await p.getByText('Nova análise').isVisible(), 'tela de nova análise abre')
  ok((await p.content()).includes('TESTE LIMPEZA paciente'), 'nova análise lista o paciente de teste')
  await p.goto(B + '/check-exames/catalogo'); await p.waitForLoadState('networkidle'); ok(!(await p.content()).includes('Application error'), 'catálogo abre')

  // Pacientes: lista, edita e exclui pela API do módulo
  await p.goto(B + '/pacientes'); await p.getByText('TESTE LIMPEZA paciente').first().waitFor(); ok(true, 'Pacientes lista o paciente de teste')
  const ed = await p.evaluate(async (id) => (await fetch('/api/pacientes/' + id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'TESTE LIMPEZA editado' }) })).status, r.id)
  ok(ed === 200, 'edição de paciente funciona')

  await p.goto(B + '/dri/calculadora'); await p.waitForLoadState('networkidle'); ok(!(await p.content()).includes('Application error'), 'DRI abre')
  await p.goto(B + '/dri/historico'); await p.waitForLoadState('networkidle'); ok(!(await p.content()).includes('Application error'), 'histórico do DRI abre')
  await p.goto(B + '/orientacoes'); await p.waitForLoadState('networkidle'); ok(!(await p.content()).includes('Application error'), 'Orientações abre')

  // o 409 do nome repetido é proposital; as páginas removidas abaixo dão 404 de propósito
  const inesperados = erros.filter((e) => !e.includes('status of 409'))
  ok(inesperados.length === 0, 'sem erros no console nas telas que ficam' + (inesperados[0] ? ': ' + inesperados[0].slice(0, 160) : ''))
  for (const rota of ['/carteira', '/agenda', '/prontuario', '/planos', '/financeiro', '/usuarios', '/indicadores', '/upload']) {
    const resp = await p.goto(B + rota); ok(resp?.status() === 404, `${rota} não existe mais (${resp?.status()})`)
  }
  const del = await p.evaluate(async (id) => (await fetch('/api/pacientes/' + id, { method: 'DELETE' })).status, r.id)
  ok(del === 200, 'exclusão de paciente sem análise funciona')
  await b.close()
} finally {
  const { rows } = await db.query('select id, org_id from professionals where auth_user_id = $1', [u.user.id])
  for (const pr of rows) {
    await db.query('delete from patients where professional_id = $1', [pr.id])
    await db.query('delete from exam_reference_override where professional_id = $1', [pr.id]).catch(() => {})
    await db.query('delete from exam_catalog where professional_id = $1', [pr.id]).catch(() => {})
    await db.query('delete from usage_logs where org_id = $1', [pr.org_id]).catch(() => {})
    await db.query('delete from professionals where id = $1', [pr.id])
    await db.query('delete from organizations where id = $1', [pr.org_id])
  }
  await adm.auth.admin.deleteUser(u.user.id); await db.end(); console.log('login de teste removido')
}
