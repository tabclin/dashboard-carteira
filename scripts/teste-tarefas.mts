// Testa as Tarefas: criar (pela ficha e pela tela), prazo sugerido, grupos, número no menu, mudar prazo,
// concluir/reabrir/excluir e a conclusão automática pelas ferramentas. Dois logins temporários, pacientes fictícios.
// Uso: npm run build && npx next start -p 3300   e depois   node scripts/teste-tarefas.mts
import { chromium, type Page } from 'playwright-core'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { randomBytes, randomUUID } from 'node:crypto'
config({ path: '.env.local', quiet: true })
const B = 'http://localhost:3300'
const adm = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const ok = (c: unknown, m: string) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) process.exitCode = 1 }
const q = async (sql: string, a: unknown[] = []) => (await db.query(sql, a)).rows
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const mais = (n: number) => new Date(new Date(hoje + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10)

async function criarLogin(email: string) {
  const senha = randomBytes(12).toString('base64url')
  const { data, error } = await adm.auth.admin.createUser({ email, password: senha, email_confirm: true }); if (error) throw error
  return { id: data.user.id, email, senha }
}
async function entrar(p: Page, l: { email: string; senha: string }) {
  await p.goto(B + '/login'); await p.fill('input[type=email]', l.email); await p.fill('input[placeholder="••••••••"]', l.senha); await p.click('button[type=submit]')
  await p.waitForURL((x) => x.pathname === '/tarefas'); await p.waitForLoadState('networkidle')
}
const l1 = await criarLogin('teste-tar-1@tabclin.local'), l2 = await criarLogin('teste-tar-2@tabclin.local')
try {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage()
  const erros: string[] = []; p.on('pageerror', (e) => erros.push(e.message))
  await entrar(p, l1)
  ok(true, 'depois do login abre em Tarefas')
  ok((await p.locator('aside nav a').first().innerText()).trim().startsWith('Tarefas'), 'Tarefas é o primeiro item do menu')
  ok((await p.getByText('Nenhuma tarefa pendente').count()) === 1, 'sem tarefas mostra o aviso')
  const [{ id: prof }] = await q('select id from professionals where auth_user_id = $1', [l1.id])

  const ana = randomUUID(), joao = randomUUID()
  await q(`insert into patients (id, professional_id, name, proximo_agendamento, updated_at) values ($1, $3, 'TESTE Ana Retorno', $4, now()), ($2, $3, 'TESTE João Sem Retorno', null, now())`, [ana, joao, prof, mais(12)])

  // ── pela ficha: exames + orientação, prazo sugerido = véspera do retorno ──
  await p.goto(B + `/pacientes/${ana}`)
  ok((await p.getByText(/daqui a 12 dias/).count()) === 1, 'ficha mostra o próximo agendamento')
  await p.getByRole('region', { name: 'Tarefas' }).getByRole('button', { name: 'Nova tarefa' }).click()
  const dlg = p.getByRole('dialog', { name: 'Nova tarefa' })
  await dlg.getByLabel('Analisar exames').check(); await dlg.getByLabel('Enviar orientação').check()
  await dlg.locator('#prazo-exames').waitFor()
  await p.waitForFunction(() => (document.querySelector('#prazo-exames') as HTMLInputElement)?.value !== '')
  ok(await dlg.locator('#prazo-exames').inputValue() === mais(11), 'prazo sugerido é a véspera do retorno')
  ok((await dlg.getByText(/antes do retorno em/).count()) >= 1, 'e explica o motivo do prazo')
  await dlg.getByLabel('Observação (opcional)').fill('mãe manda os exames pelo WhatsApp')
  if (process.env.FOTOS) await p.screenshot({ path: process.env.FOTOS + '/nova-tarefa.png' })
  await dlg.getByRole('button', { name: 'Criar tarefa' }).click(); await p.getByText('2 tarefas criadas.').waitFor()
  const t1 = await q(`select tipo, prazo::text, observacao from tarefas where patient_id = $1 order by tipo`, [ana])
  ok(t1.length === 2 && t1.every((t) => t.prazo === mais(11) && t.observacao?.includes('WhatsApp')), 'duas tarefas criadas de uma vez, com prazo e observação')
  await p.getByRole('region', { name: 'Tarefas' }).locator('li').nth(1).waitFor({ timeout: 10_000 }).catch(() => {})
  ok((await p.getByRole('region', { name: 'Tarefas' }).locator('li').count()) === 2, 'tarefas aparecem na ficha')

  // ── pela tela Tarefas: busca sem acento, prazo padrão (sem retorno) ──
  await p.goto(B + '/tarefas'); await p.getByRole('button', { name: 'Nova tarefa' }).click()
  await p.getByRole('dialog').getByLabel('Buscar paciente').fill('joao sem')
  await p.getByRole('option', { name: 'TESTE João Sem Retorno' }).click()
  await p.getByRole('dialog').getByLabel('Fazer DRI').check()
  await p.waitForFunction(() => (document.querySelector('#prazo-dri') as HTMLInputElement)?.value !== '')
  ok(await p.locator('#prazo-dri').inputValue() === mais(7) && (await p.getByText('(prazo padrão de 7 dias)').count()) === 1, 'sem retorno: prazo padrão do tipo (DRI = 7 dias)')
  await p.getByRole('button', { name: 'Criar tarefa' }).click(); await p.getByText('Tarefa criada.').waitFor()
  await p.reload()
  ok((await p.getByRole('region', { name: 'Próximos 7 dias' }).locator('li').count()) === 1 && (await p.getByRole('region', { name: 'Depois' }).locator('li').count()) === 2, 'tarefas agrupadas pelo prazo')

  // ── mudar o prazo para ontem: vira atrasada e aparece no menu ──
  const linhaDri = p.locator('li', { hasText: 'TESTE João Sem Retorno' })
  await linhaDri.getByTitle('Mudar o prazo').click(); await linhaDri.locator('input[type=date]').fill(mais(-1))
  await p.getByText('Prazo alterado.').waitFor(); await p.reload()
  ok((await p.getByRole('region', { name: 'Atrasadas' }).getByText('venceu ontem').count()) === 1, 'prazo alterado para ontem: aparece em Atrasadas')
  ok((await p.locator('aside').getByLabel('1 atrasadas ou para hoje').count()) === 1, 'menu mostra o número de atrasadas/hoje')
  if (process.env.FOTOS) await p.screenshot({ path: process.env.FOTOS + '/tarefas.png' })

  // ── conclusão automática pelas ferramentas ──
  await p.evaluate(async (pid) => fetch('/api/orientacoes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ patientId: pid, patientName: 'x', title: 'TESTE orientação', secoes: [] }) }), ana)
  const [orient] = await q(`select status, concluida_como from tarefas where patient_id = $1 and tipo = 'orientacao'`, [ana])
  ok(orient.status === 'feita' && orient.concluida_como === 'automatico', 'salvar uma orientação conclui a tarefa de orientação')
  const analise = randomUUID()
  await q(`insert into analyses (id, patient_id, professional_id, collected_at, status, updated_at) values ($1, $2, $3, $4, 'DRAFT', now())`, [analise, ana, prof, hoje])
  await p.reload()
  ok((await p.getByRole('region', { name: 'Análises em andamento' }).getByText('TESTE Ana Retorno').count()) === 1, 'análise em rascunho aparece em "Análises em andamento"')
  ok((await q(`select status from tarefas where patient_id = $1 and tipo = 'exames'`, [ana]))[0].status === 'pendente', 'rascunho ainda não conclui a tarefa de exames')
  await p.evaluate(async (id) => fetch('/api/ckex/analyses/' + id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'FINALIZED' }) }), analise)
  ok((await q(`select status, concluida_como from tarefas where patient_id = $1 and tipo = 'exames'`, [ana]))[0].concluida_como === 'automatico', 'finalizar a análise conclui a tarefa de exames')
  await p.evaluate(async (pid) => fetch('/api/dri/avaliacoes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ patientId: pid, ageMonths: 60, weightKg: 18, heightCm: 108, sexInput: 'M', activityLevel: 'sedentary', ageCategory: 'x' }) }), joao)
  ok((await q(`select status from tarefas where patient_id = $1 and tipo = 'dri'`, [joao]))[0].status === 'feita', 'salvar um DRI conclui a tarefa de DRI')
  await p.reload()
  ok((await p.getByText('Nenhuma tarefa pendente').count()) === 1 && (await p.locator('aside').getByLabel(/atrasadas ou para hoje/).count()) === 0, 'tudo feito: lista vazia e número some do menu')
  ok((await p.getByText('Feita pela ferramenta').count()) === 3, '"Feitas" mostra que foram concluídas pela ferramenta')

  // ── concluir à mão, reabrir e excluir ──
  await p.locator('summary', { hasText: 'Feitas nos últimos' }).click()
  await p.locator('li', { hasText: 'TESTE João Sem Retorno' }).getByRole('button', { name: 'Reabrir' }).click(); await p.getByText('Tarefa reaberta.').waitFor(); await p.reload()
  const linha = p.locator('section li', { hasText: 'TESTE João Sem Retorno' })
  ok((await linha.count()) === 1, 'reabrir devolve a tarefa à lista')
  ok((await linha.getByRole('link', { name: /Fazer agora/ }).getAttribute('href')) === `/dri/calculadora?patientId=${joao}`, '"Fazer agora" abre a ferramenta com o paciente')
  await linha.getByRole('button', { name: 'Concluir' }).click(); await p.getByText('Tarefa concluída.').waitFor()
  ok((await q(`select concluida_como from tarefas where patient_id = $1 and tipo = 'dri'`, [joao]))[0].concluida_como === 'manual', 'concluir à mão fica registrado como manual')
  await q(`insert into tarefas (professional_id, patient_id, tipo, prazo) values ($1, $2, 'exames', $3)`, [prof, joao, mais(2)])
  await p.reload(); p.once('dialog', (d) => d.accept())
  await p.locator('section li', { hasText: 'TESTE João Sem Retorno' }).getByRole('button', { name: 'Excluir tarefa' }).click(); await p.getByText('Tarefa excluída.').waitFor()
  ok((await q(`select status from tarefas where patient_id = $1 and tipo = 'exames'`, [joao]))[0].status === 'cancelada', 'excluir tira a tarefa da lista')

  // ── prazo padrão configurável ──
  await p.goto(B + '/configuracoes')
  await p.getByRole('region', { name: 'Prazo padrão das tarefas' }).getByLabel('Fazer DRI').fill('2')
  await p.getByRole('button', { name: 'Salvar prazos' }).click(); await p.getByText('Prazos salvos.').waitFor()
  await p.goto(B + `/pacientes/${joao}`); await p.getByRole('button', { name: 'Nova tarefa' }).click()
  await p.getByRole('dialog').getByLabel('Fazer DRI').check()
  await p.waitForFunction(() => (document.querySelector('#prazo-dri') as HTMLInputElement)?.value !== '')
  ok(await p.locator('#prazo-dri').inputValue() === mais(2), 'novo prazo padrão é usado na sugestão')
  ok(erros.length === 0, 'sem erros na página' + (erros[0] ? ': ' + erros[0] : ''))

  // ── outro login não vê as tarefas do primeiro ──
  await q(`insert into tarefas (professional_id, patient_id, tipo, prazo) values ($1, $2, 'exames', $3)`, [prof, ana, mais(-3)])
  const p2 = await (await b.newContext()).newPage(); await entrar(p2, l2)
  ok((await p2.getByText('Nenhuma tarefa pendente').count()) === 1 && (await p2.locator('aside').getByLabel(/atrasadas ou para hoje/).count()) === 0, 'segundo login não vê as tarefas nem o número do primeiro')
  await b.close()
} finally {
  for (const l of [l1, l2]) {
    const [pr] = await q('select id, org_id from professionals where auth_user_id = $1', [l.id])
    if (pr) {
      for (const t of ['tarefas', 'preferencias_tarefas', 'planos_alimentares', 'dri_avaliacoes', 'orientacoes', 'analyses', 'consultas', 'patients']) await q(`delete from ${t} where professional_id = $1`, [pr.id])
      await q('delete from professionals where id = $1', [pr.id]); await q('delete from organizations where id = $1', [pr.org_id])
    }
    await adm.auth.admin.deleteUser(l.id)
  }
  await db.end(); console.log('logins de teste removidos')
}
