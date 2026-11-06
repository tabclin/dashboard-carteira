import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, Link } from '@react-pdf/renderer'
import type { SecaoValor } from '@/lib/orientacoes/types'
import { parseImageValor } from '@/lib/orientacoes/imagem'
import { htmlParaBlocos, type Bloco, type Trecho } from './html-blocos'
import { coresDe, linhaRegistro, type Aparencia } from './aparencia'

const SLATE_7 = '#334155'
const SLATE_5 = '#64748b'
const SLATE_2 = '#e2e8f0'
const SLATE_1 = '#f1f5f9'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: SLATE_7,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
  },
  header: {
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  logoBox:    { backgroundColor: '#fff', borderRadius: 6, padding: 4, marginRight: 12 },
  logo:       { height: 44, maxWidth: 110, objectFit: 'contain' },
  headerName: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  headerSub:  { fontSize: 9, marginTop: 2 },
  headerDate: { fontSize: 9, marginLeft: 12 },

  patientBox: {
    backgroundColor: SLATE_1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
  patientLabel: { color: SLATE_5, fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  patientName:  { color: SLATE_7, fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  patientAge:   { color: SLATE_5, fontFamily: 'Helvetica' },

  docTitle: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginBottom: 18,
  },
  docTitleText: { fontSize: 14, fontFamily: 'Helvetica-Bold' },

  divider: { borderTopWidth: 1, borderTopColor: SLATE_2, marginBottom: 16 },

  section:      { marginBottom: 18 },
  // faixa clara de ponta a ponta marcando o início de cada seção
  sectionBand:  { borderRadius: 4, paddingVertical: 5, paddingHorizontal: 9, marginBottom: 8 },
  sectionLabel: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  sectionEmpty: { fontSize: 10, color: SLATE_5, fontFamily: 'Helvetica-Oblique' },

  paragrafo: { fontSize: 10, lineHeight: 1.6 },
  h2:        { fontSize: 12.5, fontFamily: 'Helvetica-Bold', lineHeight: 1.4, marginTop: 6, marginBottom: 3 },
  h3:        { fontSize: 11, fontFamily: 'Helvetica-Bold', color: SLATE_7, lineHeight: 1.4, marginTop: 4, marginBottom: 2 },
  linha:     { borderTopWidth: 1, borderTopColor: SLATE_2, marginVertical: 8 },
  item:      { flexDirection: 'row' },
  marcador:  { width: 14, fontSize: 10, lineHeight: 1.6 },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: SLATE_2,
    paddingTop: 8,
  },
  footerText: { color: SLATE_5, fontSize: 8 },
})

type Base = 'Helvetica' | 'Helvetica-Bold'

function fonte(t: Trecho, base: Base) {
  const negrito = t.negrito || base === 'Helvetica-Bold'
  if (negrito && t.italico) return 'Helvetica-BoldOblique'
  if (negrito) return 'Helvetica-Bold'
  if (t.italico) return 'Helvetica-Oblique'
  return 'Helvetica'
}

function TrechoPdf({ t, base, corLink }: { t: Trecho; base: Base; corLink: string }) {
  const decoracao = [t.sublinhado || t.link ? 'underline' : '', t.tachado ? 'line-through' : ''].filter(Boolean).join(' ')
  const estilo = {
    fontFamily: fonte(t, base),
    ...(t.cor || t.link ? { color: t.cor ?? corLink } : {}),
    ...(t.fundo ? { backgroundColor: t.fundo } : {}),
    ...(decoracao ? { textDecoration: decoracao as 'underline' } : {}),
  }
  if (t.link) return <Link src={t.link} style={estilo}>{t.texto}</Link>
  return <Text style={estilo}>{t.texto}</Text>
}

/** Texto formatado do editor: títulos, parágrafos, listas e linhas. */
function Blocos({ blocos, cor, nivel = 0 }: { blocos: Bloco[]; cor: string; nivel?: number }) {
  return (
    <>
      {blocos.map((b, i) => {
        if (b.tipo === 'linha') return <View key={i} style={styles.linha} />
        if (b.tipo === 'lista') {
          return (
            <View key={i} style={{ marginLeft: nivel ? 12 : 4 }}>
              {b.itens.map((item, j) => (
                <View key={j} style={styles.item}>
                  <Text style={styles.marcador}>{b.ordenada ? `${j + 1}.` : '•'}</Text>
                  <View style={{ flex: 1 }}><Blocos blocos={item} cor={cor} nivel={nivel + 1} /></View>
                </View>
              ))}
            </View>
          )
        }
        const estilo = b.tipo === 'h2' ? [styles.h2, { color: cor }] : b.tipo === 'h3' ? [styles.h3] : [styles.paragrafo]
        const base: Base = b.tipo === 'paragrafo' ? 'Helvetica' : 'Helvetica-Bold'
        return (
          <Text key={i} style={[...estilo, { textAlign: b.alinhamento }]}>
            {b.trechos.length ? b.trechos.map((t, j) => <TrechoPdf key={j} t={t} base={base} corLink={cor} />) : ' '}
          </Text>
        )
      })}
    </>
  )
}

const JUSTIFICA = { esquerda: 'flex-start', centro: 'center', direita: 'flex-end' } as const

interface Props {
  aparencia: Aparencia
  paciente:  { nome: string; idade: string | null } | null
  title:     string
  secoes:    SecaoValor[]
  data:      string   // dd/mm/aaaa
}

export function OrientacaoDocument({ aparencia, paciente, title, secoes, data }: Props) {
  const registro = linhaRegistro(aparencia)
  const c        = coresDe(aparencia.cor)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.header, { backgroundColor: c.principal }]} fixed>
          <View style={styles.headerLeft}>
            {aparencia.logo ? (
              <View style={styles.logoBox}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={aparencia.logo} style={styles.logo} />
              </View>
            ) : null}
            <View style={{ flexShrink: 1 }}>
              <Text style={[styles.headerName, { color: c.textoSobre }]}>{aparencia.nome}</Text>
              {registro ? <Text style={[styles.headerSub, { color: c.textoSobreSuave }]}>{registro}</Text> : null}
            </View>
          </View>
          <Text style={[styles.headerDate, { color: c.textoSobreSuave }]}>{data}</Text>
        </View>

        {paciente ? (
          <View style={styles.patientBox}>
            <Text style={styles.patientLabel}>Paciente</Text>
            <Text style={styles.patientName}>
              {paciente.nome}
              {paciente.idade ? <Text style={styles.patientAge}>{`  ·  ${paciente.idade}`}</Text> : null}
            </Text>
          </View>
        ) : null}

        <View style={[styles.docTitle, { borderLeftColor: c.principal }]}>
          <Text style={[styles.docTitleText, { color: c.escura }]}>{title}</Text>
        </View>

        <View style={styles.divider} />

        {secoes.map((s) => (
          // a imagem não se separa do seu título
          <View key={s.id} style={styles.section} wrap={s.tipo !== 'imagem'}>
            {s.titulo ? (
              <View style={[styles.sectionBand, { backgroundColor: c.faixa }]} minPresenceAhead={40}>
                <Text style={[styles.sectionLabel, { color: c.titulo }]}>{s.titulo}</Text>
              </View>
            ) : null}
            {s.tipo === 'imagem'
              ? (() => {
                  const { src, largura, alinhamento } = parseImageValor(s.valor)
                  if (!src) return null
                  const w = Math.round((499 * largura) / 100)
                  return (
                    <View style={{ flexDirection: 'row', justifyContent: JUSTIFICA[alinhamento] }}>
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <Image src={src} style={{ width: w, maxHeight: 300, objectFit: 'contain', borderRadius: 4 }} />
                    </View>
                  )
                })()
              : s.valor.trim()
                ? <Blocos blocos={htmlParaBlocos(s.valor)} cor={c.titulo} />
                : <Text style={styles.sectionEmpty}>Não preenchido</Text>
            }
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{aparencia.nome}</Text>
          <Text style={styles.footerText}>Gerado em {data}</Text>
        </View>
      </Page>
    </Document>
  )
}
