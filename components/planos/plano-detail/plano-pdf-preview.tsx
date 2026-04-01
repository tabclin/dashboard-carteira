import { formatarMoeda } from '@/lib/utils'
import { recalcularTodosPacientes, somarConsultas, calcularEconomia, STATUS_LABELS } from '@/lib/planos-utils'
import type { PlanoAcompanhamento } from '@/types'

interface PlanoPdfPreviewProps {
  plano: PlanoAcompanhamento
}

export default function PlanoPdfPreview({ plano }: PlanoPdfPreviewProps) {
  const pacientes = plano.plano_pacientes ?? []

  const pacientesCalc = recalcularTodosPacientes(
    pacientes.map(p => ({
      ...p,
      tempId: p.id,
      nascimento: p.nascimento ?? '',
      observacao: p.observacao ?? '',
      consultas: (p.plano_consultas ?? []).map(c => ({
        ...c,
        tempId: c.id,
        servico_nome: c.servico_nome,
        data_sugerida: c.data_sugerida ?? '',
        observacao: c.observacao ?? '',
      })),
    })),
    plano.plano_pagamento ?? null
  )

  const todasConsultas = pacientesCalc.flatMap(p => p.consultas)
  const { totalCheio, totalComPlano } = somarConsultas(todasConsultas)
  const { economiaReais, economiaPct } = calcularEconomia(totalCheio, totalComPlano)

  const hoje = new Date().toLocaleDateString('pt-BR')
  const temDesconto = totalCheio !== totalComPlano

  return (
    // Todos os estilos são inline para garantir fidelidade no html2canvas
    <div
      id="pdf-preview"
      style={{
        fontFamily: "'Segoe UI', Arial, sans-serif",
        background: '#ffffff',
        color: '#1e293b',
        width: '794px',        // largura A4 a 96dpi
        margin: '0 auto',
        padding: '48px',
        boxSizing: 'border-box',
        fontSize: '13px',
        lineHeight: '1.5',
      }}
    >
      {/* ── Cabeçalho ── */}
      <div style={{ borderBottom: '3px solid #0ea5e9', paddingBottom: '20px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0ea5e9', letterSpacing: '-0.5px' }}>
            TabClin Consultoria
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Proposta de Plano de Acompanhamento
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '11px', color: '#94a3b8' }}>
          <div>Emitida em {hoje}</div>
          <div style={{ marginTop: '2px', fontWeight: '600', color: '#0ea5e9' }}>
            {STATUS_LABELS[plano.status]}
          </div>
        </div>
      </div>

      {/* ── Responsável + Plano de Pagamento — lado a lado ── */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>

        {/* Responsável */}
        <div style={{ flex: 1, background: '#f8fafc', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            Responsável
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>{plano.responsavel_nome}</div>
          {plano.responsavel_telefone && (
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{plano.responsavel_telefone}</div>
          )}
          {plano.data_inicio && plano.data_fim && (
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Período:{' '}
              {plano.data_inicio.slice(0, 7).split('-').reverse().join('/')}
              {' → '}
              {plano.data_fim.slice(0, 7).split('-').reverse().join('/')}
            </div>
          )}
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
            {pacientes.length} paciente{pacientes.length !== 1 ? 's' : ''} · {todasConsultas.length} consulta{todasConsultas.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Plano de Pagamento */}
        {plano.plano_pagamento ? (
          <div style={{ flex: 1, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              Plano de Pagamento
            </div>
            <div style={{ fontWeight: '700', color: '#1e40af', fontSize: '16px' }}>{plano.plano_pagamento.nome}</div>
            {plano.plano_pagamento.percentual != null && (
              <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '4px' }}>
                {plano.plano_pagamento.tipo === 'cashback'
                  ? `Cashback de ${plano.plano_pagamento.percentual}% a cada consulta`
                  : `Desconto de ${plano.plano_pagamento.percentual}% por consulta`}
              </div>
            )}
            {plano.plano_pagamento.descricao && (
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px', fontStyle: 'italic' }}>{plano.plano_pagamento.descricao}</div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              Plano de Pagamento
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>Valores cheios (sem plano)</div>
          </div>
        )}

      </div>

      {/* ── Consultas por paciente ── */}
      {pacientesCalc.map((paciente, pidx) => (
        <div key={paciente.tempId} style={{ marginBottom: '28px' }}>
          {/* Header do paciente */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '28px', height: '28px', background: '#0ea5e9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '12px', flexShrink: 0 }}>
              {pidx + 1}
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>{paciente.nome || `Paciente ${pidx + 1}`}</div>
              {paciente.nascimento && (
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Nasc.: {paciente.nascimento.split('-').reverse().join('/')}
                </div>
              )}
            </div>
          </div>

          {paciente.observacao && (
            <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginBottom: '8px', paddingLeft: '38px' }}>
              {paciente.observacao}
            </div>
          )}

          {/* Tabela de consultas */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderRadius: '6px 0 0 6px' }}>#</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Serviço</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Data</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valor Cheio</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderRadius: '0 6px 6px 0' }}>Com Plano</th>
              </tr>
            </thead>
            <tbody>
              {paciente.consultas.map((c, cidx) => (
                <tr key={c.tempId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '9px 10px', color: '#94a3b8' }}>{cidx + 1}</td>
                  <td style={{ padding: '9px 10px' }}>
                    <div style={{ fontWeight: '600', color: '#334155' }}>{c.servico_nome}</div>
                    {c.observacao && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>{c.observacao}</div>
                    )}
                  </td>
                  <td style={{ padding: '9px 10px', color: '#64748b' }}>
                    {c.data_sugerida ? c.data_sugerida.split('-').reverse().join('/') : '—'}
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', color: '#94a3b8', textDecoration: temDesconto ? 'line-through' : 'none' }}>
                    {formatarMoeda(c.valor_cheio)}
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', color: '#059669' }}>{formatarMoeda(c.valor_com_plano)}</div>
                    {c.cashback_gerado > 0 && (
                      <div style={{ fontSize: '10px', color: '#7c3aed' }}>+{formatarMoeda(c.cashback_gerado)} cashback</div>
                    )}
                    {c.cashback_utilizado > 0 && (
                      <div style={{ fontSize: '10px', color: '#2563eb' }}>-{formatarMoeda(c.cashback_utilizado)} usado</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* ── Resumo financeiro ── */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
          Resumo Financeiro
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Sem plano</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#334155' }}>{formatarMoeda(totalCheio)}</div>
          </div>
          <div style={{ width: '1px', background: '#d1fae5' }} />
          <div>
            <div style={{ fontSize: '11px', color: '#16a34a', marginBottom: '4px' }}>Com plano</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#15803d' }}>{formatarMoeda(totalComPlano)}</div>
          </div>
          {economiaReais > 0 && (
            <>
              <div style={{ width: '1px', background: '#d1fae5' }} />
              <div>
                <div style={{ fontSize: '11px', color: '#0ea5e9', marginBottom: '4px' }}>Economia</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#0369a1' }}>{economiaPct}%</div>
                <div style={{ fontSize: '11px', color: '#0ea5e9' }}>{formatarMoeda(economiaReais)}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Observações clínicas ── */}
      {plano.observacao && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
            Observações Clínicas
          </div>
          <div style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic', background: '#f8fafc', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #0ea5e9' }}>
            {plano.observacao}
          </div>
        </div>
      )}

      {/* ── Rodapé ── */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#cbd5e1' }}>
        <span>Gerado pela TabClin Consultoria</span>
        <span>Este documento é uma proposta de acompanhamento clínico. Não tem valor fiscal.</span>
      </div>
    </div>
  )
}
