// Testes do conversor do texto formatado em blocos do PDF (lib/pdf/html-blocos.ts). Uso: node --test scripts/teste-html-blocos.mts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { htmlParaBlocos, type Bloco } from '../lib/pdf/html-blocos.ts'

function textoDe(blocos: Bloco[]): string {
  return blocos.map((b) => b.tipo === 'lista' ? b.itens.map(textoDe).join(' ') : b.tipo === 'linha' ? '' : b.trechos.map((t) => t.texto).join('')).join(' ')
}
const p = (html: string) => htmlParaBlocos(html)[0]

test('parágrafo simples', () => {
  assert.deepEqual(htmlParaBlocos('<p>Olá</p>'), [{ tipo: 'paragrafo', alinhamento: 'left', trechos: [{ texto: 'Olá' }] }])
})
test('negrito, itálico, sublinhado e tachado', () => {
  assert.deepEqual(p('<p><strong>a</strong><em>b</em><u>c</u><s>d</s><b><i>e</i></b></p>'), { tipo: 'paragrafo', alinhamento: 'left', trechos: [
    { texto: 'a', negrito: true }, { texto: 'b', italico: true }, { texto: 'c', sublinhado: true }, { texto: 'd', tachado: true }, { texto: 'e', negrito: true, italico: true },
  ] })
})
test('negrito dentro de cor', () => {
  assert.deepEqual(p('<p><span style="color: #ff0000">a <strong>b</strong></span></p>'), { tipo: 'paragrafo', alinhamento: 'left', trechos: [
    { texto: 'a ', cor: '#ff0000' }, { texto: 'b', cor: '#ff0000', negrito: true },
  ] })
})
test('cor rgb vira hex', () => {
  assert.equal((p('<p><span style="color: rgb(239, 127, 103)">x</span></p>') as { trechos: { cor?: string }[] }).trechos[0].cor, '#ef7f67')
})
test('marca-texto', () => {
  const b = p('<p><mark data-color="#bbf7d0" style="background-color: #bbf7d0; color: inherit">x</mark><mark>y</mark></p>') as { trechos: { texto: string; fundo?: string; cor?: string }[] }
  assert.deepEqual(b.trechos, [{ texto: 'x', fundo: '#bbf7d0' }, { texto: 'y', fundo: '#fef08a' }])
})
test('títulos e alinhamento', () => {
  assert.deepEqual(p('<h2 style="text-align: center">Oi</h2>'), { tipo: 'h2', alinhamento: 'center', trechos: [{ texto: 'Oi' }] })
  assert.equal(p('<h3>a</h3>').tipo, 'h3')
  assert.equal(p('<h1>a</h1>').tipo, 'h2')
  assert.equal(p('<h4>a</h4>').tipo, 'h3')
  assert.equal((p('<p style="text-align: right">a</p>') as { alinhamento: string }).alinhamento, 'right')
})
test('listas, inclusive aninhada', () => {
  const [l] = htmlParaBlocos('<ul><li><p>a</p><ul><li><p>b</p></li></ul></li><li><p>c</p></li></ul>')
  assert.equal(l.tipo, 'lista')
  if (l.tipo !== 'lista') return
  assert.equal(l.ordenada, false)
  assert.equal(l.itens.length, 2)
  assert.equal(textoDe(l.itens[0].slice(0, 1)), 'a')
  assert.equal(l.itens[0][1].tipo, 'lista')
  const [o] = htmlParaBlocos('<ol><li>um</li></ol>')
  assert.equal(o.tipo === 'lista' && o.ordenada, true)
  assert.equal(textoDe([o]), 'um')
})
test('linha divisória e link', () => {
  const bs = htmlParaBlocos('<p>a</p><hr><p><a href="https://x.com" target="_blank">site</a></p>')
  assert.equal(bs[1].tipo, 'linha')
  assert.deepEqual(bs[2], { tipo: 'paragrafo', alinhamento: 'left', trechos: [{ texto: 'site', link: 'https://x.com' }] })
})
test('quebra de linha', () => {
  assert.equal(textoDe([p('<p>a<br>b</p>')]), 'a\nb')
})
test('tag desconhecida mantém o texto', () => {
  assert.equal(textoDe(htmlParaBlocos('<div><foo>Olá</foo> mundo</div>')), 'Olá mundo')
  assert.equal(textoDe(htmlParaBlocos('solto <strong>forte</strong>')), 'solto forte')
})
test('entidades', () => {
  assert.equal(textoDe(htmlParaBlocos('<p>A &amp; B&nbsp;C &#233; &lt;x&gt; &quot;</p>')), 'A & B C é <x> "')
})
test('parágrafo vazio é mantido como espaço', () => {
  assert.equal(htmlParaBlocos('<p>a</p><p></p><p>b</p>').length, 3)
})
test('texto puro com quebras', () => {
  assert.deepEqual(htmlParaBlocos('linha 1\nlinha 2').map((b) => textoDe([b])), ['linha 1', 'linha 2'])
  assert.deepEqual(htmlParaBlocos(''), [])
})
test('Shift+Enter no fim do item (ou do parágrafo) vira uma linha em branco que o PDF mostra', () => {
  const [l] = htmlParaBlocos('<ol><li><p>Um<br></p></li><li><p>Dois</p></li></ol>')
  assert.ok(l.tipo === 'lista')
  if (l.tipo !== 'lista') return
  assert.equal(textoDe(l.itens[0]), 'Um\n ')
  assert.equal(textoDe([htmlParaBlocos('<p>a<br><br></p>')[0]]), 'a\n\n ')
  assert.equal(textoDe([htmlParaBlocos('<p>a<br>b</p>')[0]]), 'a\nb')
})
