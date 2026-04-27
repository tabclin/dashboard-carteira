import React from 'react'
import {
  Document, Page, View, Text, StyleSheet,
} from '@react-pdf/renderer'
import type { $Enums } from '@prisma/client'
type ResultStatus = $Enums.ResultStatus

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReportResult {
  examName: string
  value: string | null
  unit: string | null
  refDisplay: string
  status: ResultStatus
  professionalNote: string | null
  description: string | null
  category: string | null
}

export interface ReportData {
  professional: {
    name: string
    crm: string | null
    specialty: string | null
  }
  patient: {
    name: string
    sex: string | null
    birthDate: Date | null
  }
  analysis: {
    collectedAt: Date
    labName: string | null
    notes: string | null
    showDescription: boolean
  }
  results: ReportResult[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(d)
}

function calcAge(birthDate: Date): string {
  const now = new Date()
  const months = (now.getFullYear() - birthDate.getFullYear()) * 12
    + (now.getMonth() - birthDate.getMonth())
  if (months < 24) return `${months} ${months === 1 ? 'mês' : 'meses'}`
  const years = Math.floor(months / 12)
  return `${years} ${years === 1 ? 'ano' : 'anos'}`
}

function sexLabel(sex: string | null): string {
  if (sex === 'M') return 'Masculino'
  if (sex === 'F') return 'Feminino'
  return ''
}


const STATUS_COLOR: Record<ResultStatus, string> = {
  NORMAL: '#16a34a',
  ATTENTION: '#ca8a04',
  DANGER: '#dc2626',
  NOT_EVALUATED: '#94a3b8',
}

const STATUS_LABEL: Record<ResultStatus, string> = {
  NORMAL: 'Normal',
  ATTENTION: 'Atenção',
  DANGER: 'Risco',
  NOT_EVALUATED: '—',
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1e293b',
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 36,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: '#2563eb',
  },
  headerLeft: { flex: 1 },
  profName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1e40af', marginBottom: 2 },
  profSub: { fontSize: 8, color: '#64748b' },
  headerRight: { alignItems: 'flex-end' },
  emitLabel: { fontSize: 7, color: '#94a3b8', textTransform: 'uppercase' },
  emitDate: { fontSize: 9, color: '#475569' },

  // Patient block
  infoBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    padding: '8 10',
    marginBottom: 14,
    flexDirection: 'row',
    gap: 16,
  },
  infoGroup: { flex: 1 },
  infoLabel: { fontSize: 7, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 },
  infoValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  infoValueLight: { fontSize: 9, color: '#475569' },

  // Category
  categoryTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
    marginTop: 10,
  },

  // Table
  table: { borderWidth: 0.5, borderColor: '#e2e8f0', borderRadius: 3 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  tableRowLast: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  colExam: { flex: 3 },
  colValue: { flex: 1.2, textAlign: 'right' },
  colRef: { flex: 2, textAlign: 'center' },
  colStatus: { flex: 1.2, textAlign: 'right' },
  th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase' },
  td: { fontSize: 8.5 },
  tdBold: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  note: { fontSize: 7.5, color: '#64748b', marginTop: 1, fontStyle: 'italic' },
  description: { fontSize: 7.5, color: '#94a3b8', marginTop: 2, fontStyle: 'italic' },

  // Status dot
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 1,
    marginRight: 4,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },

  // Observations
  obsSection: {
    marginTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
  obsTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  obsText: { fontSize: 8.5, color: '#334155', lineHeight: 1.5 },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: '#94a3b8' },
})

// ─── Component ───────────────────────────────────────────────────────────────

export function ReportDocument({ data }: { data: ReportData }) {
  const { professional, patient, analysis, results } = data

  const grouped = results.reduce<Record<string, ReportResult[]>>((acc, r) => {
    const cat = r.category ?? 'Outros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(r)
    return acc
  }, {})

  const categories = Object.keys(grouped).sort()
  const today = formatDate(new Date())

  const patientInfo = [
    patient.birthDate ? calcAge(patient.birthDate) : null,
    sexLabel(patient.sex),
  ].filter(Boolean).join(' · ')

  const profSub = [professional.crm ? `CRM ${professional.crm}` : null, professional.specialty]
    .filter(Boolean).join(' · ')

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.profName}>{professional.name}</Text>
            {profSub ? <Text style={s.profSub}>{profSub}</Text> : null}
          </View>
          <View style={s.headerRight}>
            <Text style={s.emitLabel}>Emitido em</Text>
            <Text style={s.emitDate}>{today}</Text>
          </View>
        </View>

        {/* Patient + Analysis info */}
        <View style={s.infoBlock}>
          <View style={s.infoGroup}>
            <Text style={s.infoLabel}>Paciente</Text>
            <Text style={s.infoValue}>{patient.name}</Text>
            {patientInfo ? <Text style={s.infoValueLight}>{patientInfo}</Text> : null}
          </View>
          <View style={s.infoGroup}>
            <Text style={s.infoLabel}>Data da coleta</Text>
            <Text style={s.infoValue}>{formatDate(analysis.collectedAt)}</Text>
            {analysis.labName ? <Text style={s.infoValueLight}>{analysis.labName}</Text> : null}
          </View>
        </View>

        {/* Results by category */}
        {categories.map((cat) => {
          const rows = grouped[cat]
          return (
            <View key={cat}>
              <Text style={s.categoryTitle}>{cat}</Text>
              <View style={s.table}>
                {/* Table header */}
                <View style={s.tableHeader}>
                  <Text style={[s.th, s.colExam]}>Exame</Text>
                  <Text style={[s.th, s.colValue]}>Resultado</Text>
                  <Text style={[s.th, s.colRef]}>Referência</Text>
                  <Text style={[s.th, s.colStatus]}>Status</Text>
                </View>
                {/* Rows */}
                {rows.map((r, i) => {
                  const showDesc = analysis.showDescription && !!r.description
                  const isLast = i === rows.length - 1 && !r.professionalNote && !showDesc
                  const rowStyle = isLast ? s.tableRowLast : s.tableRow
                  const statusColor = STATUS_COLOR[r.status]
                  return (
                    <View key={i}>
                      <View style={rowStyle}>
                        <Text style={[s.td, s.colExam]}>{r.examName}</Text>
                        <Text style={[s.tdBold, s.colValue]}>
                          {r.value ?? '—'}{r.unit ? ` ${r.unit}` : ''}
                        </Text>
                        <Text style={[s.td, s.colRef]}>
                          {r.refDisplay}
                        </Text>
                        <View style={[s.statusRow, s.colStatus]}>
                          {r.status !== 'NOT_EVALUATED' && (
                            <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                          )}
                          <Text style={[s.td, { color: statusColor }]}>
                            {STATUS_LABEL[r.status]}
                          </Text>
                        </View>
                      </View>
                      {r.professionalNote ? (
                        <View style={[showDesc ? s.tableRow : (isLast ? s.tableRowLast : s.tableRow), { paddingTop: 0, paddingBottom: 5 }]}>
                          <Text style={[s.note, { flex: 1 }]}>↳ {r.professionalNote}</Text>
                        </View>
                      ) : null}
                      {showDesc ? (
                        <View style={[i === rows.length - 1 ? s.tableRowLast : s.tableRow, { paddingTop: 0, paddingBottom: 5 }]}>
                          <Text style={[s.description, { flex: 1 }]}>{r.description}</Text>
                        </View>
                      ) : null}
                    </View>
                  )
                })}
              </View>
            </View>
          )
        })}

        {/* General observations */}
        {analysis.notes ? (
          <View style={s.obsSection}>
            <Text style={s.obsTitle}>Observações</Text>
            <Text style={s.obsText}>{analysis.notes}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{patient.name} · {formatDate(analysis.collectedAt)}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
            `Página ${pageNumber} de ${totalPages}`
          } />
        </View>

      </Page>
    </Document>
  )
}
