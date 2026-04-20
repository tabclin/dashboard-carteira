import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { GrupoResult } from '@/lib/dri/plano-alimentar'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanoAlimentarPdfData {
  professional: {
    name:      string
    crm:       string | null
    specialty: string | null
  }
  patient: {
    name:      string | null
    ageMonths: number
    ageGroup:  string
  }
  avaliacao: {
    data:          Date
    eerMasc:       number | null
    eerFem:        number | null
    weightKg:      number
    heightCm:      number
    activityLevel: string
  }
  plano: {
    eerKcal:   number
    totalKcal: number
    grupos:    GrupoResult[]
    refeicoes: { nome: string; pct: number; kcal: number; grupos: string[] }[]
    condutaIa: string | null
    notes:     string | null
    createdAt: Date
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(d)
}
function fmtN(n: number, dec = 0): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtPorcoes(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}
function ageLabel(months: number): string {
  const y = Math.floor(months / 12), m = months % 12
  if (y === 0) return `${m} ${m === 1 ? 'mes' : 'meses'}`
  if (m === 0) return `${y} ${y === 1 ? 'ano' : 'anos'}`
  return `${y}a ${m}m`
}
const ACTIVITY_LABEL: Record<string, string> = {
  sedentary: 'Sedentario', low_active: 'Pouco ativo', active: 'Ativo', very_active: 'Muito ativo',
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BRAND   = '#f97316'
const BRAND_D = '#c2410c'
const SLATE   = '#1e293b'
const SLATE_5 = '#64748b'
const SLATE_4 = '#94a3b8'
const SLATE_1 = '#f8fafc'
const BORDER  = '#e2e8f0'
const WHITE   = '#ffffff'

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: SLATE,
    paddingTop: 0,
    paddingBottom: 36,
    paddingHorizontal: 0,
  },

  // ── Header ──
  header: {
    backgroundColor: BRAND,
    paddingHorizontal: 36,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: { flex: 1 },
  docTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: WHITE, marginBottom: 2 },
  docSubtitle: { fontSize: 8, color: '#fed7aa' },
  headerRight: { alignItems: 'flex-end' },
  brandBadge: {
    backgroundColor: BRAND_D,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginBottom: 4,
  },
  brandText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: WHITE },
  emitDate: { fontSize: 7.5, color: '#fed7aa' },

  body: { paddingHorizontal: 36 },

  // ── Info block ──
  infoBlock: {
    backgroundColor: SLATE_1,
    borderRadius: 4,
    padding: 10,
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  infoRow: { flexDirection: 'row', marginBottom: 4 },
  infoGroup: { flex: 1 },
  infoLabel: { fontSize: 7, color: SLATE_4, textTransform: 'uppercase', marginBottom: 1 },
  infoValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  infoValueLight: { fontSize: 9, color: SLATE_5 },

  eerRow: { flexDirection: 'row', marginTop: 6 },
  eerChip: {
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginRight: 6,
  },
  eerChipM: { backgroundColor: '#eff6ff' },
  eerChipF: { backgroundColor: '#fff1f2' },
  eerChipText: { fontSize: 7.5, color: SLATE_5 },
  eerChipVal: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  eerChipM_val: { color: '#1d4ed8' },
  eerChipF_val: { color: '#be123c' },

  // ── Section title ──
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_D,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#fed7aa',
    paddingBottom: 3,
  },

  // ── Table ──
  table: { borderWidth: 0.5, borderColor: BORDER, borderRadius: 3, overflow: 'hidden' },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tableRowAlt: { backgroundColor: '#fafafa' },
  tableRowLast: { borderBottomWidth: 0 },
  tableFoot: {
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  thText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: SLATE_5 },
  tdText: { fontSize: 8, color: SLATE },
  tdBold: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: SLATE },

  colGrupo:   { flex: 3.5 },
  colPorcoes: { flex: 1.2, alignItems: 'center' },
  colKcalP:   { flex: 1.2, alignItems: 'center' },
  colTotal:   { flex: 1.5, alignItems: 'flex-end' },
  colPct:     { flex: 1, alignItems: 'flex-end' },

  // ── Refeições ──
  refeicoesRow: { flexDirection: 'row', flexWrap: 'wrap' },
  refeicaoCard: {
    width: '19%',
    marginRight: '1.25%',
    marginBottom: 5,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 3,
    padding: 5,
    backgroundColor: SLATE_1,
  },
  refeicaoNome: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: SLATE, marginBottom: 2 },
  refeicaoKcal: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BRAND_D, marginBottom: 3 },
  refeicaoGrupo: { fontSize: 6.5, color: SLATE_5, marginBottom: 1 },

  // ── Conduta / Notes ──
  condutaBox: {
    backgroundColor: '#faf5ff',
    borderWidth: 0.5,
    borderColor: '#e9d5ff',
    borderRadius: 4,
    padding: 10,
    marginTop: 2,
  },
  condutaText: { fontSize: 8.5, color: SLATE, lineHeight: 1.6 },

  notesBox: {
    backgroundColor: SLATE_1,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 8,
    marginTop: 2,
  },
  notesText: { fontSize: 8, color: SLATE_5, lineHeight: 1.5 },

  // ── Footer ──
  footer: {
    marginTop: 24,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: SLATE_4 },
})

// ─── Document ─────────────────────────────────────────────────────────────────

export function PlanoAlimentarDocument({ data }: { data: PlanoAlimentarPdfData }) {
  const { professional, patient, avaliacao, plano } = data
  const totalKcal = plano.grupos.reduce((s, g) => s + g.kcalTotal, 0)

  return (
    <Document
      title={`Plano Alimentar${patient.name ? ` - ${patient.name}` : ''}`}
      author={professional.name}
    >
      <Page size="A4" style={s.page}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.docTitle}>Plano Alimentar</Text>
            <Text style={s.docSubtitle}>
              Distribuicao por grupos alimentares (CFN Resolucao 600/2018)
            </Text>
          </View>
          <View style={s.headerRight}>
            <View style={s.brandBadge}>
              <Text style={s.brandText}>ClinKPI</Text>
            </View>
            <Text style={s.emitDate}>Emitido em {fmtDate(new Date())}</Text>
          </View>
        </View>

        <View style={s.body}>

          {/* ── Dados do paciente + avaliação ─────────────────────── */}
          <View style={s.infoBlock}>
            <View style={s.infoRow}>
              <View style={s.infoGroup}>
                <Text style={s.infoLabel}>Paciente</Text>
                <Text style={s.infoValue}>{patient.name ?? 'Nao identificado'}</Text>
              </View>
              <View style={s.infoGroup}>
                <Text style={s.infoLabel}>Idade</Text>
                <Text style={s.infoValueLight}>{ageLabel(patient.ageMonths)} | {patient.ageGroup}</Text>
              </View>
              <View style={s.infoGroup}>
                <Text style={s.infoLabel}>Peso / Estatura</Text>
                <Text style={s.infoValueLight}>
                  {fmtN(avaliacao.weightKg, 1)} kg | {fmtN(avaliacao.heightCm, 1)} cm
                </Text>
              </View>
              <View style={s.infoGroup}>
                <Text style={s.infoLabel}>Nivel de atividade</Text>
                <Text style={s.infoValueLight}>{ACTIVITY_LABEL[avaliacao.activityLevel] ?? avaliacao.activityLevel}</Text>
              </View>
            </View>

            {/* EER chips */}
            <View style={s.eerRow}>
              <View style={[s.eerChip, s.eerChipM]}>
                <Text style={s.eerChipText}>Necessidade calorica (plano)</Text>
                <Text style={[s.eerChipVal, s.eerChipM_val]}>{fmtN(plano.eerKcal)} kcal/dia</Text>
              </View>
              {avaliacao.eerMasc != null && (
                <View style={[s.eerChip, s.eerChipM]}>
                  <Text style={s.eerChipText}>EER Masculino</Text>
                  <Text style={[s.eerChipVal, s.eerChipM_val]}>{fmtN(avaliacao.eerMasc)} kcal/dia</Text>
                </View>
              )}
              {avaliacao.eerFem != null && (
                <View style={[s.eerChip, s.eerChipF]}>
                  <Text style={s.eerChipText}>EER Feminino</Text>
                  <Text style={[s.eerChipVal, s.eerChipF_val]}>{fmtN(avaliacao.eerFem)} kcal/dia</Text>
                </View>
              )}
              <View style={s.eerChip}>
                <Text style={s.eerChipText}>Avaliacao DRI em</Text>
                <Text style={[s.eerChipVal, { color: SLATE_5 }]}>{fmtDate(avaliacao.data)}</Text>
              </View>
            </View>
          </View>

          {/* ── Grupos alimentares ───────────────────────────────── */}
          <Text style={s.sectionTitle}>Distribuicao Diaria por Grupo Alimentar</Text>
          <View style={s.table}>
            {/* Head */}
            <View style={s.tableHead}>
              <View style={s.colGrupo}><Text style={s.thText}>Grupo Alimentar</Text></View>
              <View style={s.colPorcoes}><Text style={[s.thText, { textAlign: 'center' }]}>Porcoes/dia</Text></View>
              <View style={s.colKcalP}><Text style={[s.thText, { textAlign: 'center' }]}>kcal/porcao</Text></View>
              <View style={s.colTotal}><Text style={[s.thText, { textAlign: 'right' }]}>Total kcal</Text></View>
              <View style={s.colPct}><Text style={[s.thText, { textAlign: 'right' }]}>%</Text></View>
            </View>

            {/* Rows */}
            {plano.grupos.map((g, i) => {
              const isLast = i === plano.grupos.length - 1
              const isAlt  = i % 2 === 1
              return (
                <View
                  key={g.key}
                  style={[s.tableRow, isAlt ? s.tableRowAlt : {}, isLast ? s.tableRowLast : {}]}
                >
                  <View style={s.colGrupo}>
                    <Text style={s.tdBold}>{g.label}</Text>
                    <Text style={[s.tdText, { fontSize: 7, color: SLATE_4, marginTop: 1 }]}>{g.porcaoDesc}</Text>
                  </View>
                  <View style={s.colPorcoes}>
                    <Text style={[s.tdBold, { textAlign: 'center' }]}>{fmtPorcoes(g.porcoes)}</Text>
                    {g.flexivel && <Text style={[{ fontSize: 6.5, color: BRAND, textAlign: 'center' }]}>ajust.</Text>}
                  </View>
                  <View style={s.colKcalP}>
                    <Text style={[s.tdText, { textAlign: 'center' }]}>{g.kcalPorcao}</Text>
                  </View>
                  <View style={s.colTotal}>
                    <Text style={[s.tdBold, { textAlign: 'right' }]}>{fmtN(g.kcalTotal)}</Text>
                  </View>
                  <View style={s.colPct}>
                    <Text style={[s.tdText, { textAlign: 'right', color: SLATE_5 }]}>{g.pct}%</Text>
                  </View>
                </View>
              )
            })}

            {/* Foot */}
            <View style={s.tableFoot}>
              <View style={s.colGrupo}><Text style={[s.tdBold, { color: BRAND_D }]}>Total do dia</Text></View>
              <View style={s.colPorcoes} />
              <View style={s.colKcalP} />
              <View style={s.colTotal}>
                <Text style={[s.tdBold, { textAlign: 'right', color: BRAND_D, fontSize: 9 }]}>
                  {fmtN(totalKcal)} kcal
                </Text>
              </View>
              <View style={s.colPct}>
                <Text style={[s.tdBold, { textAlign: 'right', color: SLATE_5 }]}>100%</Text>
              </View>
            </View>
          </View>

          {/* ── Distribuição por refeição ─────────────────────────── */}
          <Text style={s.sectionTitle}>Distribuicao por Refeicao</Text>
          <View style={s.refeicoesRow}>
            {plano.refeicoes.map(r => (
              <View key={r.nome} style={s.refeicaoCard}>
                <Text style={s.refeicaoNome}>{r.nome}</Text>
                <Text style={s.refeicaoKcal}>{fmtN(r.kcal)} kcal ({r.pct}%)</Text>
                {r.grupos.map(g => (
                  <Text key={g} style={s.refeicaoGrupo}>• {g}</Text>
                ))}
              </View>
            ))}
          </View>

          {/* ── Orientações (conduta IA) ─────────────────────────── */}
          {plano.condutaIa?.trim() && (
            <>
              <Text style={s.sectionTitle}>Orientacoes do Plano Alimentar</Text>
              <View style={s.condutaBox}>
                <Text style={s.condutaText}>{plano.condutaIa}</Text>
              </View>
            </>
          )}

          {/* ── Observações clínicas ──────────────────────────────── */}
          {plano.notes?.trim() && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 10 }]}>Observacoes Clinicas</Text>
              <View style={s.notesBox}>
                <Text style={s.notesText}>{plano.notes}</Text>
              </View>
            </>
          )}

          {/* ── Rodapé ─────────────────────────────────────────── */}
          <View style={s.footer}>
            <Text style={s.footerText}>
              Prof.: {professional.name}
              {professional.crm ? `  |  CRM: ${professional.crm}` : ''}
              {professional.specialty ? `  |  ${professional.specialty}` : ''}
            </Text>
            <Text style={s.footerText}>
              Plano gerado em {fmtDate(plano.createdAt)}  |  ClinKPI
            </Text>
          </View>

        </View>
      </Page>
    </Document>
  )
}
