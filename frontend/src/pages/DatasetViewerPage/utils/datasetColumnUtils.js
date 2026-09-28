export function findTranslationPairs(columnNames) {
    const pairs = [];
    const handled = new Set();

    for (const col of columnNames) {
        if (handled.has(col)) continue;

        let base = null;
        let ptCol = null;

        if (col.endsWith('_pt_internetes')) {
            base = col.slice(0, -14);
        } else if (col.endsWith('_internetes')) {
            base = col.slice(0, -11);
        } else if (col.endsWith('_pt')) {
            base = col.slice(0, -3);
            ptCol = col;
        } else {
            const ptVariant = `${col}_pt`;
            if (columnNames.includes(ptVariant)) {
                base = col;
                ptCol = ptVariant;
            } else if (
                columnNames.includes(`${col}_pt_internetes`) ||
                columnNames.includes(`${col}_internetes`)
            ) {
                base = col;
            }
        }

        if (base && columnNames.includes(base)) {
            if (!ptCol) {
                const ptVariant = `${base}_pt`;
                if (columnNames.includes(ptVariant)) {
                    ptCol = ptVariant;
                }
            }

            const internetesCandidates = [
                `${base}_pt_internetes`,
                `${base}_internetes`,
                `${base}_pt_shitpost`,
                `${base}_shitpost`,
            ];

            const internetesCol =
                internetesCandidates.find((c) => columnNames.includes(c)) || null;

            if (ptCol || internetesCol) {
                pairs.push({
                    key: base,
                    original: base,
                    translation: ptCol || null,
                    internetes: internetesCol || null,
                });

                handled.add(base);
                if (ptCol) handled.add(ptCol);
                for (const c of internetesCandidates) {
                    if (columnNames.includes(c)) {
                        handled.add(c);
                    }
                }
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
        if (pair.original) pairedCols.push(pair.original);
        if (pair.translation) pairedCols.push(pair.translation);
        if (pair.internetes) pairedCols.push(pair.internetes);
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
    if (field.endsWith('_pt_internetes')) {
        const base = field.slice(0, -14).replace(/_/g, ' ');
        return `${base} (Internetês)`;
    }
    if (field.endsWith('_internetes')) {
        const base = field.slice(0, -11).replace(/_/g, ' ');
        return `${base} (Internetês)`;
    }
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
