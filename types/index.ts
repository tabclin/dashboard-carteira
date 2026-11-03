// ─── Check Exames (CkEx) — status configs ────────────────────────────────────

export const ANALYSIS_STATUS_CONFIG = {
  DRAFT: { label: 'Rascunho', color: 'text-slate-500', bg: 'bg-slate-100' },
  IN_REVIEW: { label: 'Em revisão', color: 'text-blue-700', bg: 'bg-blue-50' },
  FINALIZED: { label: 'Finalizada', color: 'text-green-700', bg: 'bg-green-50' },
}

export const RESULT_STATUS_CONFIG = {
  NOT_EVALUATED: { label: 'Não avaliado', color: 'text-slate-500', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  NORMAL: { label: 'Normal', color: 'text-green-700', bg: 'bg-green-50', dot: 'bg-green-500' },
  ATTENTION: { label: 'Atenção', color: 'text-yellow-700', bg: 'bg-yellow-50', dot: 'bg-yellow-500' },
  DANGER: { label: 'Perigo', color: 'text-red-700', bg: 'bg-red-50', dot: 'bg-red-500' },
}
