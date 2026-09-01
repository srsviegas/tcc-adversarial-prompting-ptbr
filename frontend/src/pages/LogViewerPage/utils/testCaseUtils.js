import { getPathValue } from './columnUtils';

export function getSourceFileName(fullPath) {
    if (!fullPath) return 'Unknown';
    const normalized = fullPath.replace(/\\/g, '/');
    return normalized.split('/').pop() || fullPath;
}

export function getTokenColor(tokenCount) {
    if (tokenCount === null || tokenCount === undefined) return { bg: '#f8fafc', text: '#94a3b8', border: '#e2e8f0' };
    if (tokenCount >= 500) return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
    if (tokenCount >= 100) return { bg: '#fffbeb', text: '#d97706', border: '#fde68a' };
    return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
}

export function getTokenLabel(tokenCount) {
    if (tokenCount === null || tokenCount === undefined) return '—';
    return tokenCount.toLocaleString();
}

export function buildVariantKey(language, style) {
    return `${language}::${style}`;
}

export function groupByTestCase(data) {
    if (!data || data.length === 0) return [];

    const groups = new Map();

    for (const row of data) {
        const rowIndex = getPathValue(row, 'dataset_metadata.original_row_index');
        const sourceDataset = getPathValue(row, 'dataset_metadata.source_dataset') || '';
        if (rowIndex === undefined || rowIndex === null) continue;

        const key = `${rowIndex}::${sourceDataset}`;

        if (!groups.has(key)) {
            groups.set(key, {
                key,
                rowIndex,
                sourceDataset,
                sourceFileName: getSourceFileName(sourceDataset),
                attackCategory: getPathValue(row, 'dataset_metadata.attack_category') || 'Unknown',
                userInputRaw: getPathValue(row, 'inputs.user_input_raw') || '',
                entries: [],
            });
        }

        groups.get(key).entries.push(row);
    }

    const testCases = Array.from(groups.values());

    for (const tc of testCases) {
        const languages = new Set();
        const styles = new Set();
        const iterations = new Set();
        let totalTokens = 0;
        let highTokenCount = 0;

        for (const entry of tc.entries) {
            const lang = getPathValue(entry, 'inputs.prompt_language');
            const style = getPathValue(entry, 'inputs.attack_style');
            const iter = getPathValue(entry, 'run_metadata.iteration');
            const outTokens = getPathValue(entry, 'execution_metrics.output_tokens') || 0;

            if (lang) languages.add(lang);
            if (style) styles.add(style);
            if (iter !== undefined && iter !== null) iterations.add(iter);
            totalTokens += outTokens;
            if (outTokens >= 500) highTokenCount++;
        }

        tc.languages = Array.from(languages).sort();
        tc.styles = Array.from(styles).sort();
        tc.iterations = Array.from(iterations).sort((a, b) => a - b);
        tc.totalTokens = totalTokens;
        tc.highTokenCount = highTokenCount;
        tc.entryCount = tc.entries.length;
    }

    testCases.sort((a, b) => a.rowIndex - b.rowIndex);

    return testCases;
}

export function buildVariantMap(entries) {
    const map = new Map();

    for (const entry of entries) {
        const lang = getPathValue(entry, 'inputs.prompt_language') || 'unknown';
        const style = getPathValue(entry, 'inputs.attack_style') || 'unknown';
        const iter = getPathValue(entry, 'run_metadata.iteration');
        if (iter === undefined || iter === null) continue;

        const variantKey = buildVariantKey(lang, style);
        if (!map.has(variantKey)) {
            map.set(variantKey, new Map());
        }
        map.get(variantKey).set(iter, entry);
    }

    return map;
}

export function collectAllDimensions(testCases) {
    const languages = new Set();
    const styles = new Set();
    const iterations = new Set();
    const categories = new Set();

    for (const tc of testCases) {
        tc.languages.forEach((l) => languages.add(l));
        tc.styles.forEach((s) => styles.add(s));
        tc.iterations.forEach((i) => iterations.add(i));
        categories.add(tc.attackCategory);
    }

    return {
        languages: Array.from(languages).sort(),
        styles: Array.from(styles).sort(),
        iterations: Array.from(iterations).sort((a, b) => a - b),
        categories: Array.from(categories).sort(),
    };
}
