/**
 * Column utility functions for parsing nested JSON structures into DataGrid column definitions.
 */
import {
    faHashtag,
    faFingerprint,
    faShieldHalved,
    faBullseye,
    faTerminal,
    faFileLines,
    faRobot,
    faMicrochip,
    faBrain,
    faClock,
    faStopwatch,
    faCalculator,
    faScaleBalanced,
    faServer,
    faDesktop,
    faDatabase,
    faTriangleExclamation,
    faCode,
    faFileCode,
    faTag,
    faBolt,
    faSliders,
    faCommentDots,
} from '@fortawesome/free-solid-svg-icons';

export const DEFAULT_VISIBLE_FIELDS = new Set([
    'id',
    'inputs.attack_style',
    'dataset_metadata.attack_category',
    'inputs.user_input_raw',
    'output.extracted_text',
    'model_config.model_name',
    'execution_metrics.latency_seconds',
    'execution_metrics.total_tokens',
    'evaluation.attack_success_rate_hit',
]);

const ACRONYMS = new Set(['id', 'utc', 'os', 'gpu', 'api', 'sdk', 'asr', 'en', 'pt', 'http', 'json', 'url']);

/**
 * Converts a snake_case or dot-separated path into a readable header name.
 */
export function formatHeaderName(field, isObject = false) {
    if (field.toLowerCase() === 'id') return 'ID';

    const parts = field.split('.');
    const lastPart = parts[parts.length - 1];

    const words = lastPart.split('_').map((w) => {
        const lower = w.toLowerCase();
        if (ACRONYMS.has(lower)) return lower.toUpperCase();
        return w.charAt(0).toUpperCase() + w.slice(1);
    });

    let name = words.join(' ');

    if (parts.length > 2) {
        const parentPart = parts[parts.length - 2]
            .split('_')
            .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
            .join(' ');
        name = `${parentPart}: ${name}`;
    }

    if (isObject) {
        name = `${name} (JSON)`;
    }

    return name;
}

/**
 * Returns a human-friendly category name for a field path.
 */
export function getCategoryForField(field, isObject = false) {
    if (field === 'id') return 'General';
    if (isObject && !field.includes('.')) return 'Full Objects';

    const topKey = field.split('.')[0];
    const words = topKey.split('_').map((w) => {
        const lower = w.toLowerCase();
        if (ACRONYMS.has(lower)) return lower.toUpperCase();
        return w.charAt(0).toUpperCase() + w.slice(1);
    });
    return words.join(' ');
}

/**
 * Returns a unique, contextual FontAwesome icon for a specific column field (monochrome style).
 */
export function getFieldIcon(field, isObject = false) {
    if (isObject) return faFileCode;
    const lower = field.toLowerCase();

    if (lower === 'id') return faHashtag;

    // Metrics / Performance / Time
    if (lower.includes('latency') || lower.includes('duration')) return faStopwatch;
    if (lower.includes('token') || lower.includes('count')) return faCalculator;
    if (lower.includes('date') || lower.includes('utc') || lower.includes('time')) return faClock;

    // Attacks & Prompts
    if (lower.includes('attack_style') || lower.includes('attack_category')) return faBullseye;
    if (lower.includes('jailbreak') || lower.includes('refusal')) return faShieldHalved;
    if (lower.includes('system_prompt')) return faTerminal;
    if (lower.includes('user_input') || lower.includes('prompt')) return faCommentDots;

    // Output & Responses
    if (lower.includes('extracted_text') || lower.includes('output') || lower.includes('candidate')) return faRobot;
    if (lower.includes('finish_reason')) return faTag;

    // Models & Configurations
    if (lower.includes('model_name') || lower.includes('model_version')) return faBrain;
    if (
        lower.includes('temperature') ||
        lower.includes('top_p') ||
        lower.includes('seed') ||
        lower.includes('config')
    ) {
        return faSliders;
    }

    // Evaluation
    if (lower.includes('attack_success_rate') || lower.includes('asr')) return faBolt;
    if (lower.includes('judge') || lower.includes('reasoning') || lower.includes('eval')) return faScaleBalanced;

    // Dataset & Database
    if (lower.includes('dataset') || lower.includes('dataset_metadata')) return faDatabase;
    if (lower.includes('index') || lower.includes('row')) return faHashtag;

    // Error & Diagnostics
    if (lower.includes('error') || lower.includes('failed') || lower.includes('traceback')) return faTriangleExclamation;

    // Environment & Hardware
    if (lower.includes('gpu') || lower.includes('hardware')) return faMicrochip;
    if (lower.includes('os') || lower.includes('desktop')) return faDesktop;
    if (lower.includes('server') || lower.includes('environment') || lower.includes('framework')) return faServer;

    return faFileLines;
}

/**
 * Returns a contextual FontAwesome icon for a category header.
 */
export function getCategoryIcon(category) {
    switch (category) {
        case 'General':
            return faFingerprint;
        case 'Dataset Metadata':
            return faDatabase;
        case 'Inputs':
            return faTerminal;
        case 'Output':
            return faRobot;
        case 'Model Config':
            return faSliders;
        case 'Execution Metrics':
            return faStopwatch;
        case 'Evaluation':
            return faScaleBalanced;
        case 'Error Log':
            return faTriangleExclamation;
        case 'Run Metadata':
            return faServer;
        case 'Raw API Payload':
            return faCode;
        case 'Full Objects':
            return faFileCode;
        default:
            return faTag;
    }
}

/**
 * Safely extracts a nested value by dot-notation path.
 */
export function getPathValue(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let curr = obj;
    for (const part of parts) {
        if (curr === null || curr === undefined) return undefined;
        curr = curr[part];
    }
    return curr;
}

/**
 * Calculates appropriate flex and minWidth values based on field name and type.
 */
function getColumnDimensions(field, isObject) {
    const lower = field.toLowerCase();

    if (isObject) {
        return { flex: 1.5, minWidth: 200 };
    }

    if (lower === 'id' || lower.endsWith('.iteration') || lower.endsWith('.failed') || lower.endsWith('.seed')) {
        return { flex: 0.5, minWidth: 80 };
    }

    if (
        lower.endsWith('.temperature') ||
        lower.endsWith('.top_p') ||
        lower.endsWith('.latency_seconds') ||
        lower.endsWith('.input_tokens') ||
        lower.endsWith('.output_tokens') ||
        lower.endsWith('.total_tokens') ||
        lower.endsWith('.attack_success_rate_hit') ||
        lower.endsWith('.prompt_language')
    ) {
        return { flex: 0.6, minWidth: 110 };
    }

    if (
        lower.endsWith('.user_input_raw') ||
        lower.endsWith('.extracted_text') ||
        lower.endsWith('.system_prompt') ||
        lower.endsWith('.judge_reasoning') ||
        lower.endsWith('.baseline_jailbreak_en') ||
        lower.endsWith('.baseline_refusal_en') ||
        lower.endsWith('.error_message') ||
        lower.endsWith('.traceback')
    ) {
        return { flex: 2.0, minWidth: 260 };
    }

    if (
        lower.endsWith('.source_dataset') ||
        lower.endsWith('.timestamp_utc') ||
        lower.endsWith('.eval_date') ||
        lower.endsWith('.run_id') ||
        lower.endsWith('.response_id')
    ) {
        return { flex: 1.3, minWidth: 180 };
    }

    return { flex: 1.0, minWidth: 150 };
}

/**
 * Recursively scans sample objects to discover all field paths.
 */
function discoverFieldPaths(dataSample) {
    const discovered = new Map(); // fieldPath -> { field, isObject, category }

    function traverse(obj, prefix = '') {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;

        for (const [key, value] of Object.entries(obj)) {
            const currentPath = prefix ? `${prefix}.${key}` : key;
            const isPlainObject = value !== null && typeof value === 'object' && !Array.isArray(value);

            if (isPlainObject) {
                if (!discovered.has(currentPath)) {
                    discovered.set(currentPath, {
                        field: currentPath,
                        isObject: true,
                        category: getCategoryForField(currentPath, true),
                    });
                }
                traverse(value, currentPath);
            } else {
                if (!discovered.has(currentPath)) {
                    discovered.set(currentPath, {
                        field: currentPath,
                        isObject: false,
                        category: getCategoryForField(currentPath, false),
                    });
                }
            }
        }
    }

    // Sample multiple rows to ensure all possible dynamic fields are captured
    const samples = dataSample.slice(0, 50);
    for (const row of samples) {
        traverse(row);
    }

    return Array.from(discovered.values());
}

/**
 * Sort order priority for categories.
 */
const CATEGORY_ORDER = [
    'General',
    'Dataset Metadata',
    'Inputs',
    'Output',
    'Model Config',
    'Execution Metrics',
    'Evaluation',
    'Error Log',
    'Run Metadata',
    'Raw API Payload',
    'Full Objects',
];

/**
 * Builds all DataGrid column definitions from the provided dataset.
 */
export function buildAllDataColumns(data) {
    if (!data || data.length === 0) return [];

    const discoveredPaths = discoverFieldPaths(data);

    // Sort columns logically: ID first, then by category order, then leaf fields, then JSON objects
    discoveredPaths.sort((a, b) => {
        if (a.field.toLowerCase() === 'id') return -1;
        if (b.field.toLowerCase() === 'id') return 1;

        const catIndexA = CATEGORY_ORDER.indexOf(a.category);
        const catIndexB = CATEGORY_ORDER.indexOf(b.category);

        const orderA = catIndexA !== -1 ? catIndexA : 999;
        const orderB = catIndexB !== -1 ? catIndexB : 999;

        if (orderA !== orderB) return orderA - orderB;
        if (a.isObject !== b.isObject) return a.isObject ? 1 : -1;

        return a.field.localeCompare(b.field);
    });

    return discoveredPaths.map((item) => {
        const { flex, minWidth } = getColumnDimensions(item.field, item.isObject);
        const headerName = formatHeaderName(item.field, item.isObject);

        return {
            field: item.field,
            headerName,
            category: item.category,
            isObject: item.isObject,
            flex,
            minWidth,
            valueGetter: (value, row) => getPathValue(row, item.field),
        };
    });
}

/**
 * Computes default column visibility mapping.
 */
export function getDefaultColumnVisibility(columns) {
    const model = {};
    let visibleCount = 0;

    columns.forEach((col) => {
        if (col.field === '__expand__' || col.field === '__copy__') {
            model[col.field] = true;
            return;
        }

        if (DEFAULT_VISIBLE_FIELDS.has(col.field)) {
            model[col.field] = true;
            visibleCount++;
        } else {
            model[col.field] = false;
        }
    });

    // Fallback if no matching standard columns were found
    if (visibleCount === 0) {
        const fallbackCols = columns
            .filter((c) => c.field !== '__expand__' && c.field !== '__copy__' && !c.isObject)
            .slice(0, 7);
        fallbackCols.forEach((c) => {
            model[c.field] = true;
        });
    }

    return model;
}
