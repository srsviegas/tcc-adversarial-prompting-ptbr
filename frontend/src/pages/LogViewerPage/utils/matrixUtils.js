/**
 * Utility functions for building and parsing the [Method x Model] matrixes
 * for both Generated Logs and Evaluated Logs.
 */

export const STANDARD_METHODS = [
    {
        id: 'pap',
        label: 'PAP (Persuasive)',
        shortLabel: 'PAP',
        description: 'Persuasive Adversarial Prompting',
        color: '#6366f1',
    },
    {
        id: 'emoji',
        label: 'Emoji Attack',
        shortLabel: 'Emoji',
        description: 'Emoji Steganography / Obfuscation',
        color: '#ec4899',
    },
    {
        id: 'toxicchat',
        label: 'ToxicChat (Plain)',
        shortLabel: 'ToxicChat',
        description: 'ToxicChat direct prompt benchmark',
        color: '#f59e0b',
    },
    {
        id: 'toxicchat_cipher',
        label: 'ToxicChat Cipher',
        shortLabel: 'Cipher',
        description: 'Base64, ROT13, Hex, Caesar, Leetspeak',
        color: '#8b5cf6',
    },
    {
        id: 'toxicchat_base64',
        label: 'ToxicChat Base64',
        shortLabel: 'Base64',
        description: 'Base64 Obfuscation benchmark',
        color: '#8b5cf6',
    },
    {
        id: 'toxicchat_rot13',
        label: 'ToxicChat ROT13',
        shortLabel: 'ROT13',
        description: 'ROT13 Letter Substitution benchmark',
        color: '#a855f7',
    },
    {
        id: 'toxicchat_hex',
        label: 'ToxicChat Hex',
        shortLabel: 'Hex',
        description: 'Hexadecimal ASCII Encoding benchmark',
        color: '#7c3aed',
    },
    {
        id: 'toxicchat_caesar',
        label: 'ToxicChat Caesar',
        shortLabel: 'Caesar',
        description: 'Caesar Cipher Shift-3 benchmark',
        color: '#9333ea',
    },
    {
        id: 'toxicchat_leetspeak',
        label: 'ToxicChat Leetspeak',
        shortLabel: 'Leetspeak',
        description: 'Leet 1337 Character Substitution benchmark',
        color: '#6366f1',
    },
    {
        id: 'toxicchat_prefix',
        label: 'ToxicChat Prefix',
        shortLabel: 'Prefix',
        description: 'Targeted Prefix & Forced Affirmation',
        color: '#14b8a6',
    },
    {
        id: 'toxicchat_gcg',
        label: 'ToxicChat GCG',
        shortLabel: 'GCG',
        description: 'Greedy Coordinate Gradient universal suffix',
        color: '#f43f5e',
    },
];

export const STANDARD_MODELS = [
    {
        id: 'gemini-3.5-flash-lite',
        label: 'Gemini 3.5 Flash Lite',
        shortLabel: 'Gemini 3.5',
        provider: 'gemini',
        matchTokens: ['gemini-3.5-flash-lite', 'gemini_3_5_flash_lite'],
    },
    {
        id: 'Meta-Llama-3.1-8B-Instruct',
        label: 'Llama 3.1 8B Instruct',
        shortLabel: 'Llama 3.1 8B',
        provider: 'local',
        matchTokens: ['meta-llama-3.1-8b-instruct', 'llama_3_1_8b', 'llama-3.1-8b'],
    },
    {
        id: 'DeepSeek-R1-Distill-Qwen-14B',
        label: 'DeepSeek-R1 Distill 14B',
        shortLabel: 'DeepSeek-R1 14B',
        provider: 'deepseek',
        matchTokens: ['deepseek-r1-distill-qwen-14b', 'deepseek_r1', 'deepseek-r1', 'r1-14b'],
    },
    {
        id: 'Qwen3-14B',
        label: 'Qwen3 14B',
        shortLabel: 'Qwen3 14B',
        provider: 'qwen',
        matchTokens: ['qwen3-14b', 'qwen3_14b', 'qwen-14b'],
    },
    {
        id: 'gemma-4-12B-it',
        label: 'Gemma 4 12B IT',
        shortLabel: 'Gemma 4 12B',
        provider: 'gemma',
        matchTokens: ['gemma-4-12b-it', 'gemma_4_12b', 'gemma-12b', 'gemma4'],
    },
];

const KNOWN_METHOD_KEYS = [
    'toxicchat_base64',
    'toxicchat_rot13',
    'toxicchat_hex',
    'toxicchat_leetspeak',
    'toxicchat_caesar',
    'toxicchat_cesar',
    'toxicchat_cipher',
    'toxicchat_prefix',
    'toxicchat_gcg',
    'toxicchat',
    'pap',
    'emoji',
];

const KNOWN_PROVIDERS = [
    'gemini',
    'local',
    'deepseek',
    'gemma4',
    'gemma',
    'qwen3',
    'qwen',
    'llama',
];

/**
 * Parses a benchmark log filename into canonical method and model identifiers.
 */
export function parseLogFilename(fileName) {
    if (!fileName) return null;

    let base = fileName.replace(/\.jsonl$/i, '');
    if (base.endsWith('_eval')) {
        base = base.slice(0, -5);
    }

    let methodKey = 'unknown';
    for (const m of KNOWN_METHOD_KEYS) {
        if (base.endsWith('_' + m)) {
            methodKey = m;
            base = base.slice(0, -(m.length + 1));
            break;
        }
    }

    let provider = 'unknown';
    for (const p of KNOWN_PROVIDERS) {
        if (base.startsWith(p + '_')) {
            provider = p;
            base = base.slice(p.length + 1);
            break;
        }
    }

    const rawModel = base;

    // Match to standard model or canonicalize
    const rawModelLower = rawModel.toLowerCase();
    const matchedModel = STANDARD_MODELS.find((sm) =>
        sm.matchTokens.some((token) => rawModelLower.includes(token))
    );

    const modelKey = matchedModel ? matchedModel.id : rawModel;

    return {
        fileName,
        provider,
        rawModel,
        modelKey,
        methodKey,
    };
}

export function getMethodMeta(methodKey) {
    const found = STANDARD_METHODS.find((m) => m.id === methodKey);
    if (found) return found;

    return {
        id: methodKey,
        label: methodKey.replace(/_/g, ' ').toUpperCase(),
        shortLabel: methodKey.replace(/_/g, ' '),
        description: 'Adversarial benchmark',
        color: '#64748b',
    };
}

export function getModelMeta(modelKey) {
    const found = STANDARD_MODELS.find((m) => m.id === modelKey);
    if (found) return found;

    const cleanLabel = modelKey
        .replace(/-Q4_K_M.*$/i, '')
        .replace(/\.gguf$/i, '')
        .replace(/_/g, ' ');

    return {
        id: modelKey,
        label: cleanLabel,
        shortLabel: cleanLabel,
        provider: 'other',
    };
}

/**
 * Rapidly extracts statistics from raw generated log content.
 */
export function parseGeneratedLogText(text, fileName = '') {
    if (!text) return null;

    const lines = text.split('\n').filter((l) => l.trim() !== '');
    if (lines.length === 0) return null;

    let validCount = 0;
    let failedCount = 0;
    let totalTokens = 0;
    let totalOutputTokens = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    let detectedModel = '';

    for (let i = 0; i < lines.length; i++) {
        try {
            const obj = JSON.parse(lines[i]);
            if (!detectedModel && obj.model_config?.model_name) {
                detectedModel = obj.model_config.model_name;
            }

            const isFailed = Boolean(obj.error_log?.failed || obj.error_log?.error_message);
            if (isFailed) {
                failedCount++;
            } else {
                validCount++;
            }

            if (obj.execution_metrics && !isFailed) {
                if (typeof obj.execution_metrics.total_tokens === 'number') {
                    totalTokens += obj.execution_metrics.total_tokens;
                }
                if (typeof obj.execution_metrics.output_tokens === 'number') {
                    totalOutputTokens += obj.execution_metrics.output_tokens;
                }
                if (typeof obj.execution_metrics.latency_seconds === 'number') {
                    totalLatency += obj.execution_metrics.latency_seconds;
                    latencyCount++;
                }
            }
        } catch {
            failedCount++;
        }
    }

    const avgLatency = latencyCount > 0 ? totalLatency / latencyCount : null;

    return {
        fileName,
        rowCount: validCount, // Exclude rows that have errors from rowCount
        validCount,
        failedCount,
        totalLines: lines.length,
        avgLatency,
        totalTokens,
        totalOutputTokens,
        detectedModel,
    };
}

/**
 * Rapidly extracts evaluation stats, ASR rates, and variant breakdowns from evaluated log text.
 */
export function parseEvaluatedLogText(text, fileName = '') {
    if (!text) return null;

    const lines = text.split('\n').filter((l) => l.trim() !== '');
    const totalRecords = lines.length;
    if (totalRecords === 0) return null;

    let hits = 0;
    let evaluatedCount = 0;
    let errorCount = 0;
    let evaluatorName = '';
    let evaluatorModel = '';

    const categories = {
        'plain-en': { total: 0, hits: 0 },
        'attack-en': { total: 0, hits: 0 },
        'plain-ptbr': { total: 0, hits: 0 },
        'attack-ptbr': { total: 0, hits: 0 },
    };

    const specificStyles = {};
    const safetyCategoryCounts = {};

    for (let i = 0; i < lines.length; i++) {
        try {
            const obj = JSON.parse(lines[i]);
            const lang = (obj.inputs?.prompt_language || '').toLowerCase();
            const style = (obj.inputs?.attack_style || '').toLowerCase();
            const isEn = lang.startsWith('en');
            const isPlain = style === 'plain';

            const catKey = isPlain
                ? (isEn ? 'plain-en' : 'plain-ptbr')
                : (isEn ? 'attack-en' : 'attack-ptbr');

            const fullStyleKey = `${isEn ? 'en' : 'ptbr'}-${style || 'unknown'}`;
            if (!specificStyles[fullStyleKey]) {
                specificStyles[fullStyleKey] = { total: 0, hits: 0, label: `${isEn ? 'EN' : 'PT-BR'} ${style}` };
            }

            let isHit = false;
            let isEvalSuccess = false;
            const isGenFailed = Boolean(obj.error_log?.failed || obj.error_log?.error_message);

            if (Array.isArray(obj.evaluations) && obj.evaluations.length > 0) {
                const ev = obj.evaluations[0];
                if (ev.evaluator && !evaluatorName) {
                    evaluatorName = ev.evaluator;
                    evaluatorModel = ev.model || '';
                }

                if (ev.status === 'error' || isGenFailed) {
                    errorCount++;
                } else if (ev.status === 'success') {
                    isEvalSuccess = true;
                    evaluatedCount++;
                }

                if (isEvalSuccess && (ev.flagged === true || String(ev.verdict).toLowerCase() === 'unsafe')) {
                    isHit = true;
                }

                if (isEvalSuccess && Array.isArray(ev.flagged_categories)) {
                    ev.flagged_categories.forEach((cat) => {
                        safetyCategoryCounts[cat] = (safetyCategoryCounts[cat] || 0) + 1;
                    });
                }
            } else if (obj.evaluation) {
                if (obj.evaluation.eval_method && !evaluatorName) {
                    evaluatorName = obj.evaluation.eval_method;
                }
                if (isGenFailed) {
                    errorCount++;
                } else if (obj.evaluation.attack_success_rate_hit !== null && obj.evaluation.attack_success_rate_hit !== undefined) {
                    isEvalSuccess = true;
                    evaluatedCount++;
                    if (obj.evaluation.attack_success_rate_hit === true || obj.evaluation.attack_success_rate_hit === 1) {
                        isHit = true;
                    }
                }
            } else if (isGenFailed) {
                errorCount++;
            }

            if (isEvalSuccess) {
                if (categories[catKey]) {
                    categories[catKey].total++;
                }
                if (specificStyles[fullStyleKey]) {
                    specificStyles[fullStyleKey].total++;
                }
                if (isHit) {
                    hits++;
                    if (categories[catKey]) {
                        categories[catKey].hits++;
                    }
                    if (specificStyles[fullStyleKey]) {
                        specificStyles[fullStyleKey].hits++;
                    }
                }
            }
        } catch {
            errorCount++;
        }
    }

    const overallAsr = evaluatedCount > 0 ? (hits / evaluatedCount) * 100 : 0;

    const formattedCategories = {};
    for (const [k, v] of Object.entries(categories)) {
        const rate = v.total > 0 ? (v.hits / v.total) * 100 : 0;
        formattedCategories[k] = {
            total: v.total,
            hits: v.hits,
            rate: Math.round(rate * 10) / 10,
        };
    }

    const sortedSafetyCategories = Object.entries(safetyCategoryCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    return {
        fileName,
        totalRecords,
        evaluatedCount,
        hits,
        errorCount,
        evaluatorName: evaluatorName || 'Content Safety Judge',
        evaluatorModel,
        overallAsr: Math.round(overallAsr * 10) / 10,
        categories: formattedCategories,
        specificStyles,
        safetyCategories: sortedSafetyCategories,
    };
}
