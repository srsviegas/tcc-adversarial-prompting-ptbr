export function findTranslationPairs(columnNames) {
    const pairs = [];
    const handled = new Set();

    for (const col of columnNames) {
        if (handled.has(col)) continue;

        if (col.endsWith('_pt')) {
            const base = col.slice(0, -3);
            if (columnNames.includes(base)) {
                pairs.push({ original: base, translation: col, key: base });
                handled.add(base);
                handled.add(col);
            }
        } else {
            const ptVariant = `${col}_pt`;
            if (columnNames.includes(ptVariant)) {
                pairs.push({ original: col, translation: ptVariant, key: col });
                handled.add(col);
                handled.add(ptVariant);
            }
        }
    }

    return { pairs, handled };
}

export function orderColumnsSideBySide(columnNames) {
    const { pairs, handled } = findTranslationPairs(columnNames);
    const prefixCols = [];
    const pairedCols = [];
    const suffixCols = [];

    const metaOrder = ['id', 'sample_rounds', 'conv_id', 'ss_category'];
    for (const meta of metaOrder) {
        if (columnNames.includes(meta) && !handled.has(meta)) {
            prefixCols.push(meta);
            handled.add(meta);
        }
    }

    for (const pair of pairs) {
        pairedCols.push(pair.original);
        pairedCols.push(pair.translation);
    }

    for (const col of columnNames) {
        if (!handled.has(col)) {
            suffixCols.push(col);
        }
    }

    return [...prefixCols, ...pairedCols, ...suffixCols];
}

export function formatDatasetHeader(field) {
    if (field === 'id') return 'ID';
    if (field.endsWith('_pt')) {
        const base = field.slice(0, -3).replace(/_/g, ' ');
        return `${base} (PT-BR)`;
    }
    return field.replace(/_/g, ' ');
}

export function getDatasetColumnDimensions(field) {
    const lower = field.toLowerCase();
    if (
        lower === 'id' ||
        lower === 'sample_rounds' ||
        lower === 'toxicity' ||
        lower === 'jailbreaking'
    ) {
        return { flex: 0.5, minWidth: 90 };
    }
    if (
        lower === 'conv_id' ||
        lower === 'ss_category' ||
        lower === 'human_annotation'
    ) {
        return { flex: 0.8, minWidth: 140 };
    }
    if (
        lower.includes('prompt') ||
        lower.includes('input') ||
        lower.includes('bad_q') ||
        lower.includes('output')
    ) {
        return { flex: 2.2, minWidth: 280 };
    }
    return { flex: 1.0, minWidth: 160 };
}

export function checkCharacterAnomaly(origText, transText) {
    const orig = String(origText ?? '').trim();
    const trans = String(transText ?? '').trim();

    if (!orig && !trans) return null;

    const origLen = orig.length;
    const transLen = trans.length;

    if (origLen > 0 && transLen === 0) {
        return {
            type: 'missing',
            label: 'Missing translation',
            diffChars: -origLen,
            diffPercent: -100,
            severity: 'error',
        };
    }

    if (transLen > 0 && origLen === 0) {
        return {
            type: 'orphan',
            label: 'Missing original',
            diffChars: transLen,
            diffPercent: 100,
            severity: 'warning',
        };
    }

    if (origLen >= 15) {
        const ratio = transLen / origLen;
        const diffChars = transLen - origLen;
        const diffPercent = Math.round((diffChars / origLen) * 100);

        if (ratio < 0.75) {
            return {
                type: 'short',
                label: `${diffPercent}% chars (much shorter)`,
                diffChars,
                diffPercent,
                severity: 'warning',
            };
        }

        if (ratio > 1.5 && diffChars > 40) {
            return {
                type: 'long',
                label: `+${diffPercent}% chars (much longer)`,
                diffChars,
                diffPercent,
                severity: 'warning',
            };
        }
    }

    return null;
}
