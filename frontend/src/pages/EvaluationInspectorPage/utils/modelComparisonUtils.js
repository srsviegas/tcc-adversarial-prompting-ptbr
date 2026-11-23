/**
 * Utilities for cross-model row-by-row comparison for a selected adversarial method.
 *
 * Each comparison row represents a single interaction uniquely identified by:
 *   (original_row_index, prompt_language, attack_style, iteration)
 *
 * Portuguese (pt-BR) and English (en) are always kept as separate rows.
 */
import {
  STANDARD_METHODS,
  STANDARD_MODELS,
  parseLogFilename,
  getMethodMeta,
  getModelMeta,
} from './evaluationMatrixUtils';

/**
 * Groups availableFiles by adversarial method, listing all models present for each method.
 * Returns { methods, modelsByMethod } where:
 *  - methods: ordered array of method meta objects that have at least 1 file
 *  - modelsByMethod: Map<methodId, Array<{ model, fileName, fileInfo }>>
 */
export function groupFilesByMethod(availableFiles = []) {
  const methodFilesMap = new Map();

  availableFiles.forEach((fileInfo) => {
    const parsed = parseLogFilename(fileInfo.name);
    if (!parsed || !parsed.methodKey) return;

    if (!methodFilesMap.has(parsed.methodKey)) {
      methodFilesMap.set(parsed.methodKey, new Map());
    }
    const modelMap = methodFilesMap.get(parsed.methodKey);
    // Avoid duplicates for the same modelKey; prefer entry with more judges or base log
    const existing = modelMap.get(parsed.modelKey);
    if (!existing || (fileInfo.judgesCount > existing.fileInfo.judgesCount) || (!existing.fileInfo.hasLog && fileInfo.hasLog)) {
      modelMap.set(parsed.modelKey, {
        model: getModelMeta(parsed.modelKey),
        fileName: fileInfo.name,
        fileInfo,
      });
    }
  });

  // Order methods: STANDARD_METHODS order first, then any extra discovered methods
  const orderedMethods = [];
  const remainingMethodKeys = new Set(methodFilesMap.keys());

  STANDARD_METHODS.forEach((m) => {
    if (remainingMethodKeys.has(m.id)) {
      orderedMethods.push(m);
      remainingMethodKeys.delete(m.id);
    }
  });
  Array.from(remainingMethodKeys)
    .sort()
    .forEach((key) => {
      orderedMethods.push(getMethodMeta(key));
    });

  // Order models inside each method: STANDARD_MODELS order first, then any extra
  const modelsByMethod = new Map();
  orderedMethods.forEach((method) => {
    const modelMap = methodFilesMap.get(method.id);
    const orderedModels = [];
    const remainingModelKeys = new Set(modelMap.keys());

    STANDARD_MODELS.forEach((sm) => {
      if (remainingModelKeys.has(sm.id)) {
        orderedModels.push(modelMap.get(sm.id));
        remainingModelKeys.delete(sm.id);
      }
    });
    Array.from(remainingModelKeys)
      .sort()
      .forEach((key) => {
        orderedModels.push(modelMap.get(key));
      });

    modelsByMethod.set(method.id, orderedModels);
  });

  return { methods: orderedMethods, modelsByMethod };
}

/**
 * Builds the canonical cross-model interaction key for a single row.
 * Strictly separates prompt_language (pt-BR vs en), attack_style, and iteration.
 */
export function getInteractionKey(row) {
  const origIdx = row.original_row_index ?? row.id ?? 0;
  const lang = String(row.inputs?.prompt_language || 'pt-BR').toLowerCase().includes('pt')
    ? 'pt-BR'
    : 'en';
  const style = row.inputs?.attack_style || 'plain';
  const iter = row.inputs?.iteration ?? 1;
  return `${origIdx}::${lang}::${style}::${iter}`;
}

/**
 * Aligns rows across multiple models for the same adversarial method.
 *
 * @param {Array<{ model: object, fileName: string, rows: Array }>} modelDatasets
 * @returns {{
 *   comparisonRows: Array,
 *   availableStyles: Array<string>,
 *   availableIterations: Array<number>,
 * }}
 */
export function buildMethodComparisonRows(modelDatasets = []) {
  const rowMap = new Map();
  const stylesSet = new Set();
  const iterationsSet = new Set();

  modelDatasets.forEach(({ model, rows = [] }) => {
    const modelId = model.id;
    rows.forEach((row) => {
      const origIdx = row.original_row_index ?? row.id ?? 0;
      const lang = String(row.inputs?.prompt_language || 'pt-BR').toLowerCase().includes('pt')
        ? 'pt-BR'
        : 'en';
      const style = row.inputs?.attack_style || 'plain';
      const iter = Number(row.inputs?.iteration ?? 1);

      stylesSet.add(style);
      iterationsSet.add(iter);

      const key = `${origIdx}::${lang}::${style}::${iter}`;
      let entry = rowMap.get(key);
      if (!entry) {
        entry = {
          key,
          original_row_index: origIdx,
          prompt_language: lang,
          attack_style: style,
          iteration: iter,
          prompt: '',
          models: {},
        };
        rowMap.set(key, entry);
      }

      if (!entry.prompt) {
        const candidatePrompt = row.inputs?.user_input_raw || row.inputs?.user_prompt || '';
        if (candidatePrompt) {
          entry.prompt = candidatePrompt;
        }
      }

      entry.models[modelId] = row;
    });
  });

  // Sort deterministically: original_row_index -> prompt_language (pt-BR then en) -> attack_style -> iteration
  const comparisonRows = Array.from(rowMap.values()).sort((a, b) => {
    if (a.original_row_index !== b.original_row_index) {
      return a.original_row_index - b.original_row_index;
    }
    if (a.prompt_language !== b.prompt_language) {
      return a.prompt_language === 'pt-BR' ? -1 : 1;
    }
    if (a.attack_style !== b.attack_style) {
      return a.attack_style.localeCompare(b.attack_style);
    }
    return a.iteration - b.iteration;
  });

  const availableStyles = Array.from(stylesSet).sort();
  const availableIterations = Array.from(iterationsSet).sort((a, b) => a - b);

  return {
    comparisonRows,
    availableStyles,
    availableIterations,
  };
}

/**
 * Evaluates cross-model agreement/divergence for a single comparison row
 * restricted to the currently active/selected model IDs.
 */
export function computeRowCrossModelSummary(compRow, activeModelIds = []) {
  let presentCount = 0;
  let quorumCount = 0;
  let dangerousCount = 0;
  let safeCount = 0;
  let pendingCount = 0;
  let missingCount = 0;

  activeModelIds.forEach((modelId) => {
    const row = compRow.models[modelId];
    if (!row) {
      missingCount += 1;
      return;
    }
    presentCount += 1;
    const cons = row.evaluations?.consensus;
    if (cons?.has_quorum) {
      quorumCount += 1;
      if (cons.consensus_dangerous === true) {
        dangerousCount += 1;
      } else if (cons.consensus_dangerous === false) {
        safeCount += 1;
      }
    } else {
      pendingCount += 1;
    }
  });

  const hasDivergence = dangerousCount > 0 && safeCount > 0;
  const allDangerous = quorumCount > 0 && dangerousCount === quorumCount;
  const allSafe = quorumCount > 0 && safeCount === quorumCount;

  return {
    presentCount,
    quorumCount,
    dangerousCount,
    safeCount,
    pendingCount,
    missingCount,
    hasDivergence,
    allDangerous,
    allSafe,
  };
}

/**
 * Computes aggregate comparison statistics over a list of filtered comparison rows
 * for the currently active models.
 */
export function computeComparisonStats(filteredRows = [], activeModels = []) {
  const activeModelIds = activeModels.map((m) => m.id);
  let divergentCount = 0;
  let anyDangerousCount = 0;
  let allDangerousCount = 0;
  let allSafeCount = 0;

  const perModel = {};
  activeModelIds.forEach((id) => {
    perModel[id] = { present: 0, quorum: 0, dangerous: 0, safe: 0, asr: null };
  });

  filteredRows.forEach((compRow) => {
    const summary = computeRowCrossModelSummary(compRow, activeModelIds);
    if (summary.hasDivergence) divergentCount += 1;
    if (summary.dangerousCount > 0) anyDangerousCount += 1;
    if (summary.allDangerous) allDangerousCount += 1;
    if (summary.allSafe) allSafeCount += 1;

    activeModelIds.forEach((id) => {
      const row = compRow.models[id];
      if (!row) return;
      const pm = perModel[id];
      pm.present += 1;
      const cons = row.evaluations?.consensus;
      if (cons?.has_quorum) {
        pm.quorum += 1;
        if (cons.consensus_dangerous === true) pm.dangerous += 1;
        else if (cons.consensus_dangerous === false) pm.safe += 1;
      }
    });
  });

  activeModelIds.forEach((id) => {
    const pm = perModel[id];
    pm.asr = pm.quorum > 0 ? ((pm.dangerous / pm.quorum) * 100).toFixed(1) : null;
  });

  return {
    totalRows: filteredRows.length,
    divergentCount,
    anyDangerousCount,
    allDangerousCount,
    allSafeCount,
    perModel,
  };
}
