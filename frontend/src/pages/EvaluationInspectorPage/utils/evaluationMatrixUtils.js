/**
 * Evaluation Matrix Utilities
 * Handles parsing, color scaling, and KPI aggregates for the Evaluation Matrix Overview.
 */
import {
  STANDARD_METHODS,
  STANDARD_MODELS,
  METHOD_CATEGORIES,
  parseLogFilename,
  getMethodMeta,
  getModelMeta,
} from '../../LogViewerPage/utils/matrixUtils';

export {
  STANDARD_METHODS,
  STANDARD_MODELS,
  METHOD_CATEGORIES,
  parseLogFilename,
  getMethodMeta,
  getModelMeta,
};

/**
 * Returns color tokens for an Attack Success Rate (ASR) percentage.
 * Subdued monochromatic badge with a subtle indicator dot for high readability.
 */
export function getAsrColor(asr) {
  if (asr === null || asr === undefined) {
    return {
      bg: '#ffffff',
      border: '#e2e8f0',
      text: '#64748b',
      badgeBg: '#f8fafc',
      dotColor: '#94a3b8',
    };
  }
  if (asr < 10) {
    return {
      bg: '#ffffff',
      border: '#e2e8f0',
      text: '#0f172a',
      badgeBg: '#f8fafc',
      dotColor: '#10b981',
    };
  }
  if (asr < 25) {
    return {
      bg: '#ffffff',
      border: '#e2e8f0',
      text: '#0f172a',
      badgeBg: '#f8fafc',
      dotColor: '#f59e0b',
    };
  }
  return {
    bg: '#ffffff',
    border: '#e2e8f0',
    text: '#0f172a',
    badgeBg: '#f8fafc',
    dotColor: '#ef4444',
  };
}

/**
 * Returns color tokens for completion percentage.
 * Clean, monochromatic styling for professional visualization.
 */
export function getCompletionColor(rate) {
  if (rate >= 100) {
    return {
      barColor: '#334155',
      badgeBg: '#f8fafc',
      badgeText: '#0f172a',
      badgeBorder: '#cbd5e1',
      label: '100% Quorum',
    };
  }
  if (rate > 0) {
    return {
      barColor: '#64748b',
      badgeBg: '#f8fafc',
      badgeText: '#334155',
      badgeBorder: '#e2e8f0',
      label: `${rate.toFixed(0)}% Quorum`,
    };
  }
  return {
    barColor: '#e2e8f0',
    badgeBg: '#f8fafc',
    badgeText: '#94a3b8',
    badgeBorder: '#e2e8f0',
    label: '0% Quorum',
  };
}

/**
 * Parses consensus JSONL text to extract completion count, quorum stats,
 * per-evaluator votes, and language breakdown.
 */
export function parseConsensusFileText(text, fileName, logRowCount = null) {
  if (!text) return null;
  const lines = text.split('\n');

  let totalRows = 0;
  let quorumRows = 0;
  let pendingRows = 0;
  let consensusDangerous = 0;
  let consensusSafe = 0;

  let llamaTotal = 0;
  let llamaDang = 0;
  let qwenTotal = 0;
  let qwenDang = 0;
  let gemmaTotal = 0;
  let gemmaDang = 0;

  let ptTotal = 0;
  let ptQuorum = 0;
  let ptDang = 0;
  let enTotal = 0;
  let enQuorum = 0;
  let enDang = 0;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    totalRows++;
    try {
      const obj = JSON.parse(l);
      const isQuorum = Boolean(obj.has_quorum);
      const isDang = obj.consensus_dangerous === true;
      const isSafe = obj.consensus_dangerous === false;

      // Extract language from record_key: pid::model::lang::style::iter
      const rk = obj.record_key || '';
      const parts = rk.split('::');
      const lang = parts.length >= 3 ? parts[2].toLowerCase() : (rk.toLowerCase().includes('pt') ? 'pt-br' : 'en');
      const isPt = lang.includes('pt');
      const isEn = lang.includes('en');

      if (isPt) {
        ptTotal++;
        if (isQuorum) {
          ptQuorum++;
          if (isDang) ptDang++;
        }
      } else if (isEn) {
        enTotal++;
        if (isQuorum) {
          enQuorum++;
          if (isDang) enDang++;
        }
      }

      if (isQuorum) {
        quorumRows++;
        if (isDang) consensusDangerous++;
        if (isSafe) consensusSafe++;
      } else {
        pendingRows++;
      }

      if (obj.evaluators_present && Array.isArray(obj.evaluators_present)) {
        if (obj.evaluators_present.includes('llamaguard')) {
          llamaTotal++;
          if (obj.votes && obj.votes.llamaguard === true) llamaDang++;
        }
        if (obj.evaluators_present.includes('qwen_judge')) {
          qwenTotal++;
          if (obj.votes && obj.votes.qwen_judge === true) qwenDang++;
        }
        if (obj.evaluators_present.includes('gemma_judge')) {
          gemmaTotal++;
          if (obj.votes && obj.votes.gemma_judge === true) gemmaDang++;
        }
      }
    } catch {
      // Skip malformed rows
    }
  }

  const denominator = logRowCount || totalRows;
  const consensusAsr = quorumRows > 0 ? (consensusDangerous / quorumRows) * 100 : null;
  const llamaAsr = llamaTotal > 0 ? (llamaDang / llamaTotal) * 100 : null;
  const qwenAsr = qwenTotal > 0 ? (qwenDang / qwenTotal) * 100 : null;
  const gemmaAsr = gemmaTotal > 0 ? (gemmaDang / gemmaTotal) * 100 : null;

  const ptAsr = ptQuorum > 0 ? (ptDang / ptQuorum) * 100 : null;
  const enAsr = enQuorum > 0 ? (enDang / enQuorum) * 100 : null;
  const gap = (ptAsr !== null && enAsr !== null) ? (ptAsr - enAsr) : null;

  let status = 'complete';
  if (totalRows === 0) {
    status = 'missing';
  } else if (quorumRows === 0 && (llamaTotal > 0 || qwenTotal > 0 || gemmaTotal > 0)) {
    status = 'pending_quorum';
  } else if (pendingRows > 0 || (denominator > 0 && quorumRows < denominator)) {
    status = 'partial';
  }

  return {
    fileName,
    totalLogRows: denominator,
    evaluatedRows: totalRows,
    quorumRows,
    pendingRows,
    consensusDangerous,
    consensusSafe,
    consensusAsr: consensusAsr !== null ? Math.round(consensusAsr * 10) / 10 : null,
    completionRate: denominator > 0 ? Math.round((quorumRows / denominator) * 1000) / 10 : 0,
    evaluatedRate: denominator > 0 ? Math.round((totalRows / denominator) * 1000) / 10 : 0,
    status,
    evaluators: {
      llamaguard: {
        total: llamaTotal,
        dangerous: llamaDang,
        asr: llamaAsr !== null ? Math.round(llamaAsr * 10) / 10 : null,
        present: llamaTotal > 0,
      },
      qwen_judge: {
        total: qwenTotal,
        dangerous: qwenDang,
        asr: qwenAsr !== null ? Math.round(qwenAsr * 10) / 10 : null,
        present: qwenTotal > 0,
      },
      gemma_judge: {
        total: gemmaTotal,
        dangerous: gemmaDang,
        asr: gemmaAsr !== null ? Math.round(gemmaAsr * 10) / 10 : null,
        present: gemmaTotal > 0,
      },
    },
    languages: {
      pt: {
        total: ptTotal,
        quorum: ptQuorum,
        dangerous: ptDang,
        asr: ptAsr !== null ? Math.round(ptAsr * 10) / 10 : null,
      },
      en: {
        total: enTotal,
        quorum: enQuorum,
        dangerous: enDang,
        asr: enAsr !== null ? Math.round(enAsr * 10) / 10 : null,
      },
      gap: gap !== null ? Math.round(gap * 10) / 10 : null,
    },
  };
}

/**
 * Computes suite-wide KPIs for the Evaluation Matrix view.
 */
export function computeSuiteMatrixKPIs(matrixDataMap, allMethods, allModels) {
  const totalSlots = allMethods.length * allModels.length;
  let totalEvaluatedRuns = 0;
  let totalFullyCompletedRuns = 0;
  let totalPartialRuns = 0;
  let totalPendingQuorumRuns = 0;

  let totalLogRows = 0;
  let totalQuorumRows = 0;
  let totalPendingRows = 0;
  let totalConsensusDangerous = 0;
  let totalConsensusSafe = 0;

  Object.values(matrixDataMap).forEach((st) => {
    if (!st) return;
    totalEvaluatedRuns++;
    totalLogRows += st.totalLogRows || 0;
    totalQuorumRows += st.quorumRows || 0;
    totalPendingRows += st.pendingRows || 0;
    totalConsensusDangerous += st.consensusDangerous || 0;
    totalConsensusSafe += st.consensusSafe || 0;

    if (st.status === 'complete') {
      totalFullyCompletedRuns++;
    } else if (st.status === 'partial') {
      totalPartialRuns++;
    } else if (st.status === 'pending_quorum') {
      totalPendingQuorumRuns++;
    }
  });

  const overallAsr = totalQuorumRows > 0
    ? ((totalConsensusDangerous / totalQuorumRows) * 100).toFixed(1)
    : '—';

  const suiteCompletionRate = totalLogRows > 0
    ? Math.round((totalQuorumRows / totalLogRows) * 1000) / 10
    : 0;

  return {
    totalSlots,
    totalEvaluatedRuns,
    totalFullyCompletedRuns,
    totalPartialRuns,
    totalPendingQuorumRuns,
    totalLogRows,
    totalQuorumRows,
    totalPendingRows,
    totalConsensusDangerous,
    totalConsensusSafe,
    overallAsr,
    suiteCompletionRate,
  };
}
