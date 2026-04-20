import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { SecaoValor } from '@/lib/orientacoes/types'

function parseImageSrc(valor: string): { src: string; largura: number } {
  try {
    const p = JSON.parse(valor)
    if (p && typeof p.src === 'string') return { src: p.src, largura: p.largura ?? 100 }
  } catch {}
  return { src: valor, largura: 100 }
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '  • ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const BRAND   = '#4f46e5'
const BRAND_D = '#3730a3'
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
    backgroundColor: BRAND,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerName: { color: '#fff', fontSize: 13, fontFamily: 'Helvetica-Bold' },
  headerSub:  { color: '#c7d2fe', fontSize: 9, marginTop: 2 },
  headerDate: { color: '#c7d2fe', fontSize: 9 },

  patientBox: {
    backgroundColor: SLATE_1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
  patientLabel: { color: SLATE_5, fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  patientName:  { color: SLATE_7, fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 2 },

  docTitle: {
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
    paddingLeft: 10,
    marginBottom: 18,
  },
  docTitleText: { color: BRAND_D, fontSize: 14, fontFamily: 'Helvetica-Bold' },

  divider: { borderTopWidth: 1, borderTopColor: SLATE_2, marginBottom: 16 },

  section: { marginBottom: 14 },
  sectionLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: BRAND,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionValue: { fontSize: 10, color: SLATE_7, lineHeight: 1.6 },
  sectionEmpty: { fontSize: 10, color: SLATE_5, fontFamily: 'Helvetica-Oblique' },

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

interface Props {
  professional: { name: string; crm?: string | null; specialty?: string | null }
  patientName:  string | null
  title:        string
  secoes:       SecaoValor[]
  createdAt:    Date
}

export function OrientacaoDocument({ professional, patientName, title, secoes, createdAt }: Props) {
  const dateStr = createdAt.toLocaleDateString('pt-BR')
  const crmLine = [professional.crm, professional.specialty].filter(Boolean).join(' | ')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.headerName}>{professional.name}</Text>
            {crmLine ? <Text style={styles.headerSub}>{crmLine}</Text> : null}
          </View>
          <Text style={styles.headerDate}>{dateStr}</Text>
        </View>

        {patientName ? (
          <View style={styles.patientBox}>
            <Text style={styles.patientLabel}>Paciente</Text>
            <Text style={styles.patientName}>{patientName}</Text>
          </View>
        ) : null}

        <View style={styles.docTitle}>
          <Text style={styles.docTitleText}>{title}</Text>
        </View>

        <View style={styles.divider} />

        {secoes.map((s) => (
          <View key={s.id} style={styles.section}>
            {s.titulo ? <Text style={styles.sectionLabel}>{s.titulo}</Text> : null}
            {s.tipo === 'imagem'
              ? (() => {
                  const { src, largura } = parseImageSrc(s.valor)
                  if (!src) return null
                  const w = Math.round((499 * largura) / 100)
                  return <Image src={src} style={{ width: w, maxHeight: 300, objectFit: 'contain', borderRadius: 4 }} />
                })()
              : s.valor.trim()
                ? <Text style={styles.sectionValue}>{htmlToText(s.valor)}</Text>
                : <Text style={styles.sectionEmpty}>Nao preenchido</Text>
            }
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{professional.name}</Text>
          <Text style={styles.footerText}>Gerado em {dateStr}</Text>
        </View>
      </Page>
    </Document>
  )
}
