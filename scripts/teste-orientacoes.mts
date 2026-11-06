// Testa as melhorias das Orientações (variáveis no cursor, menino/menina, PDF e aparência) num login temporário.
// Nunca usa pacientes reais: cria uma paciente fictícia no login temporário e apaga tudo no fim.
// Uso: npx next dev -p 3310  e depois  BASE=http://localhost:3310 LOGO=caminho.png node scripts/teste-orientacoes.mts
import { chromium } from 'playwright-core'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { randomBytes } from 'node:crypto'
import { writeFileSync, readFileSync } from 'node:fs'
config({ path: '.env.local', quiet: true })
const B = process.env.BASE ?? 'http://localhost:3300'
const SAIDA = process.env.SAIDA ?? '.' // onde salvar os PDFs e telas gerados, para conferir à vista
const LOGO = process.env.LOGO! // um PNG qualquer (até 1 MB) usado como imagem e logo de teste
const adm = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const q = async (sql: string, v: unknown[] = []) => (await db.query(sql, v)).rows
const EMAIL = 'teste-orientacoes@tabclin.local', SENHA = randomBytes(12).toString('base64url')
const { data: u, error } = await adm.auth.admin.createUser({ email: EMAIL, password: SENHA, email_confirm: true }); if (error) throw error
const ok = (c: unknown, m: string) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) process.exitCode = 1 }
const api = (p: import('playwright-core').Page, url: string, method = 'GET', body?: unknown) =>
  p.evaluate(async ([url, method, body]) => { const r = await fetch(url as string, { method: method as string, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => null) } }, [url, method, body] as const)

try {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const p = await (await b.newContext({ viewport: { width: 1360, height: 1000 } })).newPage()
  const erros: string[] = []; p.on('pageerror', (e) => erros.push(e.message))
  await p.goto(B + '/login'); await p.fill('input[type=email]', EMAIL); await p.fill('input[placeholder="••••••••"]', SENHA); await p.click('button[type=submit]')
  await p.waitForURL((x) => x.pathname === '/tarefas'); await p.waitForLoadState('networkidle')

  // paciente fictícia SEM sexo, com nascimento
  const pac = (await api(p, '/api/ckex/patients', 'POST', { name: 'Teste Orientacao Maria', birthDate: '2023-08-15' })).json
  ok(pac?.id, 'paciente fictícia criada sem sexo')

  // ── Modelos: botões de variável inserem no cursor ──
  await p.goto(B + '/orientacoes'); await p.waitForLoadState('networkidle')
  await p.getByRole('button', { name: 'Modelos' }).click()
  await p.getByRole('button', { name: 'Adicionar seção' }).click()
  const ed = p.locator('.ProseMirror').first()
  await ed.click(); await p.keyboard.type('AB'); await p.keyboard.press('ArrowLeft')
  await p.getByRole('button', { name: '#o/a', exact: true }).first().click()
  ok((await ed.innerText()).trim() === 'A#o/aB', 'texto longo: #o/a entra onde está o cursor (' + (await ed.innerText()).trim() + ')')
  await p.getByRole('button', { name: 'Adicionar seção' }).click()
  await p.locator('select').last().selectOption('texto_curto')
  const ta = p.locator('textarea').last()
  await ta.fill('XY'); await ta.evaluate((el: HTMLTextAreaElement) => { el.focus(); el.setSelectionRange(1, 1) })
  await p.getByRole('button', { name: '#nome', exact: true }).last().click()
  ok((await ta.inputValue()) === 'X#nomeY', 'texto curto: #nome entra onde está o cursor (' + (await ta.inputValue()) + ')')
  ok(await p.getByRole('button', { name: '#dele/dela', exact: true }).first().isVisible(), 'botões das variáveis de gênero aparecem')

  // modelo para a orientação (via API, com todas as formatações e uma imagem)
  const img = 'data:image/png;base64,' + readFileSync(LOGO, { encoding: 'base64' })
  const tpl = (await api(p, '/api/orientacoes/templates', 'POST', { title: 'Modelo teste', secoes: [
    { id: 's1', titulo: 'Rotina', tipo: 'texto_longo', valor: '<h2>Para #o/a #nome</h2><p>Fale para #o/a #nome que <strong>#ele/ela</strong> vai bem. O peso <span style="color: #dc2626">#do/da #nome</span>.</p><ul><li><p>Item</p></li></ul>' },
    { id: 's2', titulo: 'Recado', tipo: 'texto_curto', valor: '#Ele/Ela pode brincar' },
    { id: 's3', titulo: 'Figura', tipo: 'imagem', valor: JSON.stringify({ src: img, largura: 30 }) },
  ] })).json
  ok(tpl?.id, 'modelo de teste criado')

  // ── Criar: faixa Menino/Menina obrigatória ──
  await p.goto(B + `/orientacoes?patientId=${pac.id}`); await p.waitForLoadState('networkidle')
  ok(await p.getByText('Esta criança é:').isVisible(), 'faixa Menino/Menina aparece para paciente sem sexo')
  await p.getByRole('button', { name: 'Selecionar modelo...' }).click(); await p.getByRole('button', { name: 'Modelo teste' }).click()
  const editor = p.locator('.ProseMirror').first()
  await editor.waitFor()
  ok((await editor.innerText()).includes('Fale para o/a Teste que ele/ela vai bem'), 'sem sexo o texto fica "o/a" e "ele/ela"')
  ok(await p.getByRole('button', { name: 'Salvar', exact: true }).isDisabled(), 'Salvar bloqueado enquanto não escolhe')
  await p.screenshot({ path: `${SAIDA}/tela-faixa.png`, fullPage: false })
  // a Dra. edita antes de escolher: a edição precisa ficar
  const recado = p.locator('textarea').first()
  await recado.fill((await recado.inputValue()) + ' (editado)')
  await p.getByRole('button', { name: 'Menina' }).click()
  await p.getByText('Salvo no cadastro').waitFor()
  ok((await editor.innerText()).includes('Fale para a Teste que ela vai bem'), 'Menina: "o/a" vira "a" e "ele/ela" vira "ela" no editor')
  ok((await editor.innerText()).includes('O peso da Teste'), '"#do/da" vira "da"')
  ok((await recado.inputValue()) === 'Ela pode brincar (editado)', 'edição feita antes da escolha foi mantida (' + (await recado.inputValue()) + ')')
  const [s1] = await q('select sex from patients where id = $1', [pac.id])
  ok(s1.sex === 'F', 'sexo gravado no cadastro da paciente')
  // ainda sem editar depois da escolha: dá para trocar
  await p.getByRole('button', { name: 'Menino' }).click()
  await p.waitForFunction(() => document.querySelector('.ProseMirror')?.textContent?.includes('Fale para o Teste que ele'))
  ok(true, 'trocar para Menino reescreve o texto')
  ok((await q('select sex from patients where id = $1', [pac.id]))[0].sex === 'M', 'troca gravada no cadastro')
  await recado.fill((await recado.inputValue()) + '!')
  ok(await p.getByRole('button', { name: 'Menina' }).isDisabled(), 'depois de editar, a troca fica bloqueada')
  await p.screenshot({ path: `${SAIDA}/tela-escolhido.png` })
  ok(await p.getByRole('button', { name: 'Salvar', exact: true }).isEnabled(), 'Salvar liberado depois da escolha')
  await p.getByRole('button', { name: 'Salvar', exact: true }).click()
  await p.getByText('Orientação salva!').waitFor()
  const [ori] = await q('select id, secoes from orientacoes where patient_id = $1', [pac.id])
  ok(ori && JSON.stringify(ori.secoes).includes('Fale para o Teste que'), 'orientação salva com o texto certo')

  // PDF da orientação
  const pdf = await p.request.get(B + `/api/orientacoes/${ori.id}/pdf`)
  ok(pdf.status() === 200 && pdf.headers()['content-type'] === 'application/pdf', 'PDF da orientação gerado')
  writeFileSync(`${SAIDA}/orientacao.pdf`, await pdf.body())

  // segurança: não altera paciente de outro login
  const [outro] = await q("select id from patients where professional_id <> (select id from professionals where auth_user_id = $1) limit 1", [u.user.id])
  const alheio = await api(p, `/api/pacientes/${outro.id}/sexo`, 'PATCH', { sexo: 'F' })
  ok(alheio.status === 404, 'não grava sexo em paciente de outro login (' + alheio.status + ')')
  ok((await api(p, `/api/pacientes/${pac.id}/sexo`, 'PATCH', { sexo: 'X' })).status === 400, 'valor inválido é recusado')

  // ── Configurações: aparência do PDF ──
  await p.goto(B + '/configuracoes'); await p.waitForLoadState('networkidle')
  ok(await p.getByText('Aparência do PDF das orientações').isVisible(), 'cartão de aparência aparece em Configurações')
  await p.getByRole('button', { name: 'Cor #ef7f67' }).click()
  await p.getByPlaceholder('CRM-SP 157418').fill('CRM-SP 000000')
  await p.getByPlaceholder('59046').fill('00000')
  await p.locator('input[type=file][accept="image/png,image/jpeg"]').setInputFiles(LOGO)
  await p.getByAltText('Logo').waitFor()
  await p.getByRole('button', { name: 'Salvar aparência' }).click()
  await p.getByText('Aparência do PDF salva.').waitFor()
  const [ap] = await q('select ap.cor, ap.crm, ap.rqe, ap.logo is not null tem_logo from aparencia_pdf ap join professionals pr on pr.id = ap.professional_id where pr.auth_user_id = $1', [u.user.id])
  ok(ap?.cor === '#ef7f67' && ap.crm === 'CRM-SP 000000' && ap.rqe === '00000' && ap.tem_logo, 'aparência gravada (cor, CRM, RQE, logo)')
  await p.screenshot({ path: `${SAIDA}/tela-configuracoes.png`, fullPage: true })
  await p.reload(); await p.waitForLoadState('networkidle')
  ok(await p.getByPlaceholder('CRM-SP 157418').inputValue() === 'CRM-SP 000000', 'valores continuam lá depois de recarregar')
  const ex = await p.request.get(B + '/api/orientacoes/exemplo-pdf')
  ok(ex.status() === 200, 'PDF de exemplo gerado')
  writeFileSync(`${SAIDA}/exemplo.pdf`, await ex.body())
  const pdf2 = await p.request.get(B + `/api/orientacoes/${ori.id}/pdf`)
  writeFileSync(`${SAIDA}/orientacao-coral.pdf`, await pdf2.body())

  ok(erros.length === 0, 'sem erros na página' + (erros[0] ? ': ' + erros[0].slice(0, 200) : ''))
  await b.close()
} finally {
  const [pr] = await q('select id, org_id from professionals where auth_user_id = $1', [u.user.id])
  if (pr) {
    for (const t of ['orientacoes', 'orientacao_templates', 'aparencia_pdf', 'tarefas', 'patients']) await q(`delete from ${t} where professional_id = $1`, [pr.id]).catch((e) => console.log('limpeza', t, e.message))
    await q('delete from usage_logs where org_id = $1', [pr.org_id]).catch(() => {})
    await q('delete from professionals where id = $1', [pr.id]); await q('delete from organizations where id = $1', [pr.org_id])
  }
  await adm.auth.admin.deleteUser(u.user.id); await db.end(); console.log('login e dados de teste removidos')
}
