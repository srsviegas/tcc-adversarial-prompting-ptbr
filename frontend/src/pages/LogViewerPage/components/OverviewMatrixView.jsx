import React, { useState, useEffect, useMemo } from 'react';
import {
    Box,
    Stack,
    Typography,
    Chip,
    CircularProgress,
    Tooltip,
    LinearProgress,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faScaleBalanced,
    faClock,
    faDatabase,
    faArrowUpRightFromSquare,
    faLayerGroup,
    faBullseye,
} from '@fortawesome/free-solid-svg-icons';
import {
    STANDARD_METHODS,
    STANDARD_MODELS,
    parseLogFilename,
    getMethodMeta,
    getModelMeta,
    parseGeneratedLogText,
    parseEvaluatedLogText,
} from '../utils/matrixUtils';
import { EvaluatedCellDetailModal } from './EvaluatedCellDetailModal';

function getAsrColor(rate) {
    if (rate >= 40) return { text: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'High' };
    if (rate >= 20) return { text: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Med' };
    return { text: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Low' };
}

function MetricSummaryCard({ title, value, subtitle, icon, iconColor = '#3b82f6', iconBg = '#eff6ff' }) {
    return (
        <Box
            sx={{
                p: 2.5,
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 2.5,
                flex: 1,
                minWidth: 200,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
            }}
        >
            <Box
                sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    bgcolor: iconBg,
                    color: iconColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.1rem',
                    flexShrink: 0,
                }}
            >
                <FontAwesomeIcon icon={icon} />
            </Box>
            <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em">
                    {title}
                </Typography>
                <Typography variant="h5" fontWeight={800} color="#0f172a" lineHeight={1.2}>
                    {value}
                </Typography>
                {subtitle && (
                    <Typography variant="caption" color="text.secondary" fontSize="0.75rem">
                        {subtitle}
                    </Typography>
                )}
            </Box>
        </Box>
    );
}

export function OverviewMatrixView({
    availableFiles = [],
    evaluatedFiles = [],
    getFileContent,
    getEvaluatedFileContent,
    onNavigateToFile,
}) {
    const [generatedStatsMap, setGeneratedStatsMap] = useState({});
    const [evaluatedStatsMap, setEvaluatedStatsMap] = useState({});
    const [loadingGenerated, setLoadingGenerated] = useState(false);
    const [loadingEvaluated, setLoadingEvaluated] = useState(false);
    const [selectedEvaluatedCell, setSelectedEvaluatedCell] = useState(null);

    // Map files to matrix slots: (methodKey, modelKey) -> { fileName, meta }
    const generatedFileMapping = useMemo(() => {
        const map = new Map();
        availableFiles.forEach((fileName) => {
            const parsed = parseLogFilename(fileName);
            if (parsed) {
                const key = `${parsed.methodKey}__${parsed.modelKey}`;
                map.set(key, { fileName, ...parsed });
            }
        });
        return map;
    }, [availableFiles]);

    const evaluatedFileMapping = useMemo(() => {
        const map = new Map();
        evaluatedFiles.forEach((fileName) => {
            const parsed = parseLogFilename(fileName);
            if (parsed) {
                const key = `${parsed.methodKey}__${parsed.modelKey}`;
                map.set(key, { fileName, ...parsed });
            }
        });
        return map;
    }, [evaluatedFiles]);

    // Discover any additional methods or models not in standard catalog
    const allMethods = useMemo(() => {
        const methodKeys = new Set(STANDARD_METHODS.map((m) => m.id));
        generatedFileMapping.forEach((info) => methodKeys.add(info.methodKey));
        evaluatedFileMapping.forEach((info) => methodKeys.add(info.methodKey));

        const ordered = [];
        STANDARD_METHODS.forEach((m) => {
            if (methodKeys.has(m.id)) {
                ordered.push(m);
                methodKeys.delete(m.id);
            }
        });
        methodKeys.forEach((key) => {
            ordered.push(getMethodMeta(key));
        });
        return ordered;
    }, [generatedFileMapping, evaluatedFileMapping]);

    const allModels = useMemo(() => {
        const modelKeys = new Set(STANDARD_MODELS.map((m) => m.id));
        generatedFileMapping.forEach((info) => modelKeys.add(info.modelKey));
        evaluatedFileMapping.forEach((info) => modelKeys.add(info.modelKey));

        const ordered = [];
        STANDARD_MODELS.forEach((m) => {
            if (modelKeys.has(m.id)) {
                ordered.push(m);
                modelKeys.delete(m.id);
            }
        });
        modelKeys.forEach((key) => {
            ordered.push(getModelMeta(key));
        });
        return ordered;
    }, [generatedFileMapping, evaluatedFileMapping]);

    // Asynchronously load generated log stats
    useEffect(() => {
        if (!getFileContent || availableFiles.length === 0) return;
        let isCancelled = false;

        const loadGenStats = async () => {
            setLoadingGenerated(true);
            const newStats = {};
            for (const fileName of availableFiles) {
                if (isCancelled) break;
                try {
                    const text = await getFileContent(fileName);
                    if (text) {
                        const parsed = parseGeneratedLogText(text, fileName);
                        if (parsed) {
                            newStats[fileName] = parsed;
                        }
                    }
                } catch {
                    // Ignore errors during summary load
                }
            }
            if (!isCancelled) {
                setGeneratedStatsMap(newStats);
                setLoadingGenerated(false);
            }
        };

        loadGenStats();
        return () => {
            isCancelled = true;
        };
    }, [availableFiles, getFileContent]);

    // Asynchronously load evaluated log stats
    useEffect(() => {
        if (!getEvaluatedFileContent || evaluatedFiles.length === 0) return;
        let isCancelled = false;

        const loadEvalStats = async () => {
            setLoadingEvaluated(true);
            const newStats = {};
            for (const fileName of evaluatedFiles) {
                if (isCancelled) break;
                try {
                    const text = await getEvaluatedFileContent(fileName);
                    if (text) {
                        const parsed = parseEvaluatedLogText(text, fileName);
                        if (parsed) {
                            newStats[fileName] = parsed;
                        }
                    }
                } catch {
                    // Ignore errors during summary load
                }
            }
            if (!isCancelled) {
                setEvaluatedStatsMap(newStats);
                setLoadingEvaluated(false);
            }
        };

        loadEvalStats();
        return () => {
            isCancelled = true;
        };
    }, [evaluatedFiles, getEvaluatedFileContent]);

    // KPI aggregates
    const kpis = useMemo(() => {
        const totalMatrixSlots = allMethods.length * allModels.length;
        const generatedCount = generatedFileMapping.size;
        const evaluatedCount = evaluatedFileMapping.size;

        let totalGeneratedRows = 0;
        let totalGeneratedErrors = 0;
        Object.values(generatedStatsMap).forEach((st) => {
            totalGeneratedRows += st.rowCount || 0;
            totalGeneratedErrors += st.failedCount || 0;
        });

        let totalEvaluatedRows = 0;
        let totalEvaluatedErrors = 0;
        let sumAsr = 0;
        let validAsrCount = 0;
        Object.values(evaluatedStatsMap).forEach((st) => {
            totalEvaluatedRows += st.evaluatedCount || 0;
            totalEvaluatedErrors += st.errorCount || 0;
            if (st.evaluatedCount > 0) {
                sumAsr += st.overallAsr;
                validAsrCount++;
            }
        });

        const avgAsr = validAsrCount > 0 ? (sumAsr / validAsrCount).toFixed(1) : '—';

        return {
            totalMatrixSlots,
            generatedCount,
            evaluatedCount,
            totalGeneratedRows,
            totalGeneratedErrors,
            totalEvaluatedRows,
            totalEvaluatedErrors,
            avgAsr,
        };
    }, [allMethods, allModels, generatedFileMapping, evaluatedFileMapping, generatedStatsMap, evaluatedStatsMap]);

    return (
        <Stack spacing={4}>
            {/* Top KPI Summary Banner */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap">
                <MetricSummaryCard
                    title="Generated Runs"
                    value={`${kpis.generatedCount} / ${kpis.totalMatrixSlots}`}
                    subtitle={`${Math.round((kpis.generatedCount / (kpis.totalMatrixSlots || 1)) * 100)}% suite coverage`}
                    icon={faLayerGroup}
                    iconColor="#2563eb"
                    iconBg="#eff6ff"
                />
                <MetricSummaryCard
                    title="Evaluated Runs"
                    value={`${kpis.evaluatedCount} / ${kpis.generatedCount || 0}`}
                    subtitle={
                        kpis.totalEvaluatedErrors > 0
                            ? `${kpis.totalEvaluatedRows.toLocaleString()} evaluated (${kpis.totalEvaluatedErrors.toLocaleString()} errors excluded)`
                            : `${kpis.totalEvaluatedRows.toLocaleString()} responses evaluated`
                    }
                    icon={faScaleBalanced}
                    iconColor="#7c3aed"
                    iconBg="#f5f3ff"
                />
                <MetricSummaryCard
                    title="Average ASR (Evaluated)"
                    value={kpis.avgAsr !== '—' ? `${kpis.avgAsr}%` : '—'}
                    subtitle="Overall attack success rate"
                    icon={faBullseye}
                    iconColor="#dc2626"
                    iconBg="#fef2f2"
                />
                <MetricSummaryCard
                    title="Total Generated Rows"
                    value={kpis.totalGeneratedRows.toLocaleString()}
                    subtitle={
                        kpis.totalGeneratedErrors > 0
                            ? `${availableFiles.length} files (${kpis.totalGeneratedErrors.toLocaleString()} errors excluded)`
                            : `${availableFiles.length} JSONL log files`
                    }
                    icon={faDatabase}
                    iconColor="#059669"
                    iconBg="#ecfdf5"
                />
            </Stack>

            {/* SECTION 1: GENERATED CONTENT MATRIX */}
            <Box
                sx={{
                    bgcolor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 3,
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
            >
                <Box sx={{ p: 2.5, px: 3, bgcolor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                        <Box>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                                <Typography variant="h6" fontWeight={700} color="#0f172a" fontSize="1.05rem">
                                    Generated Content Matrix
                                </Typography>
                                <Chip
                                    label={`${kpis.generatedCount} filled · ${kpis.totalMatrixSlots - kpis.generatedCount} missing`}
                                    size="small"
                                    sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, bgcolor: '#f1f5f9', color: '#475569' }}
                                />
                            </Stack>
                            <Typography variant="body2" color="text.secondary" fontSize="0.8rem" mt={0.25}>
                                Status of generation runs [Method × Model]. Click any filled cell to view rows in the Log Viewer.
                            </Typography>
                        </Box>
                        {loadingGenerated && (
                            <Stack direction="row" spacing={1} alignItems="center">
                                <CircularProgress size={16} thickness={4} />
                                <Typography variant="caption" color="text.secondary">
                                    Indexing logs...
                                </Typography>
                            </Stack>
                        )}
                    </Stack>
                </Box>

                <Box sx={{ overflowX: 'auto' }}>
                    <Box
                        component="table"
                        sx={{
                            width: '100%',
                            borderCollapse: 'separate',
                            borderSpacing: 0,
                            tableLayout: 'fixed',
                            minWidth: 950,
                        }}
                    >
                        <Box component="thead">
                            <Box component="tr" sx={{ bgcolor: '#f8fafc' }}>
                                <Box
                                    component="th"
                                    sx={{
                                        p: 2,
                                        width: 180,
                                        textAlign: 'left',
                                        borderBottom: '1px solid #e2e8f0',
                                        fontWeight: 700,
                                        fontSize: '0.725rem',
                                        color: '#475569',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                    }}
                                >
                                    Method
                                </Box>
                                {allModels.map((model) => (
                                    <Box
                                        component="th"
                                        key={model.id}
                                        sx={{
                                            p: 2,
                                            textAlign: 'center',
                                            borderBottom: '1px solid #e2e8f0',
                                            fontWeight: 700,
                                            fontSize: '0.725rem',
                                            color: '#475569',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                        }}
                                    >
                                        <Tooltip title={model.label} arrow placement="top">
                                            <span>{model.shortLabel}</span>
                                        </Tooltip>
                                    </Box>
                                ))}
                            </Box>
                        </Box>

                        <Box component="tbody">
                            {allMethods.map((method) => (
                                <Box component="tr" key={method.id} sx={{ '&:hover': { bgcolor: '#fbfcfd' } }}>
                                    {/* Method Row Label */}
                                    <Box
                                        component="td"
                                        sx={{
                                            p: 2,
                                            borderBottom: '1px solid #f1f5f9',
                                            verticalAlign: 'middle',
                                        }}
                                    >
                                        <Typography variant="subtitle2" fontWeight={700} color="#1e293b" fontSize="0.825rem">
                                            {method.shortLabel}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" fontSize="0.7rem" display="block">
                                            {method.label}
                                        </Typography>
                                    </Box>

                                    {/* Model Cells */}
                                    {allModels.map((model) => {
                                        const key = `${method.id}__${model.id}`;
                                        const fileInfo = generatedFileMapping.get(key);
                                        const stats = fileInfo ? generatedStatsMap[fileInfo.fileName] : null;

                                        if (!fileInfo) {
                                            return (
                                                <Box
                                                    component="td"
                                                    key={model.id}
                                                    sx={{
                                                        p: 1.25,
                                                        borderBottom: '1px solid #f1f5f9',
                                                        textAlign: 'center',
                                                        verticalAlign: 'middle',
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            p: 1.5,
                                                            bgcolor: '#f8fafc',
                                                            border: '1px dashed #e2e8f0',
                                                            borderRadius: 2,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            minHeight: 58,
                                                        }}
                                                    >
                                                        <Typography variant="caption" color="#94a3b8" fontSize="0.725rem">
                                                            —
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            );
                                        }

                                        return (
                                            <Box
                                                component="td"
                                                key={model.id}
                                                sx={{
                                                    p: 1.25,
                                                    borderBottom: '1px solid #f1f5f9',
                                                    verticalAlign: 'middle',
                                                }}
                                            >
                                                <Box
                                                    onClick={() => onNavigateToFile && onNavigateToFile(fileInfo.fileName, 'raw')}
                                                    sx={{
                                                        p: 1.25,
                                                        px: 1.5,
                                                        bgcolor: '#ffffff',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: 2,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                        minHeight: 58,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'center',
                                                        '&:hover': {
                                                            borderColor: '#94a3b8',
                                                            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                                                            transform: 'translateY(-1px)',
                                                        },
                                                    }}
                                                >
                                                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                                        <Chip
                                                            label={
                                                                stats
                                                                    ? stats.failedCount > 0
                                                                        ? `${stats.rowCount.toLocaleString()} rows (${stats.failedCount} error${stats.failedCount > 1 ? 's' : ''})`
                                                                        : `${stats.rowCount.toLocaleString()} rows`
                                                                    : 'Ready'
                                                            }
                                                            size="small"
                                                            sx={{
                                                                height: 20,
                                                                fontSize: '0.675rem',
                                                                fontWeight: 700,
                                                                bgcolor: stats?.failedCount > 0 ? '#fffbeb' : '#dcfce7',
                                                                color: stats?.failedCount > 0 ? '#b45309' : '#166534',
                                                                border: stats?.failedCount > 0 ? '1px solid #fde68a' : 'none',
                                                            }}
                                                        />
                                                        <FontAwesomeIcon
                                                            icon={faArrowUpRightFromSquare}
                                                            style={{ fontSize: '0.65rem', color: '#94a3b8' }}
                                                        />
                                                    </Stack>

                                                    {stats?.avgLatency && (
                                                        <Stack direction="row" spacing={0.5} alignItems="center" mt={0.5}>
                                                            <FontAwesomeIcon icon={faClock} style={{ fontSize: '0.6rem', color: '#94a3b8' }} />
                                                            <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
                                                                {stats.avgLatency.toFixed(1)}s avg
                                                            </Typography>
                                                        </Stack>
                                                    )}
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            ))}
                        </Box>
                    </Box>
                </Box>
            </Box>

            {/* SECTION 2: EVALUATED CONTENT MATRIX (ASR ANALYSIS) */}
            <Box
                sx={{
                    bgcolor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 3,
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
            >
                <Box sx={{ p: 2.5, px: 3, bgcolor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                        <Box>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                                <Typography variant="h6" fontWeight={700} color="#0f172a" fontSize="1.05rem">
                                    Evaluated Content Matrix (ASR Analysis)
                                </Typography>
                                <Chip
                                    label={`${kpis.evaluatedCount} evaluated logs`}
                                    size="small"
                                    sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, bgcolor: '#f5f3ff', color: '#6d28d9' }}
                                />
                            </Stack>
                            <Typography variant="body2" color="text.secondary" fontSize="0.8rem" mt={0.25}>
                                Content safety evaluations read from <code style={{ color: '#6d28d9', fontSize: '0.75rem' }}>logs/evaluated/</code>. Shows Overall ASR and variant breakdowns (Plain vs Attack in EN and PT-BR). Click any cell for deep-dive.
                            </Typography>
                        </Box>
                        {loadingEvaluated && (
                            <Stack direction="row" spacing={1} alignItems="center">
                                <CircularProgress size={16} thickness={4} color="secondary" />
                                <Typography variant="caption" color="text.secondary">
                                    Computing ASR...
                                </Typography>
                            </Stack>
                        )}
                    </Stack>
                </Box>

                <Box sx={{ overflowX: 'auto' }}>
                    <Box
                        component="table"
                        sx={{
                            width: '100%',
                            borderCollapse: 'separate',
                            borderSpacing: 0,
                            tableLayout: 'fixed',
                            minWidth: 950,
                        }}
                    >
                        <Box component="thead">
                            <Box component="tr" sx={{ bgcolor: '#f8fafc' }}>
                                <Box
                                    component="th"
                                    sx={{
                                        p: 2,
                                        width: 180,
                                        textAlign: 'left',
                                        borderBottom: '1px solid #e2e8f0',
                                        fontWeight: 700,
                                        fontSize: '0.725rem',
                                        color: '#475569',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                    }}
                                >
                                    Method
                                </Box>
                                {allModels.map((model) => (
                                    <Box
                                        component="th"
                                        key={model.id}
                                        sx={{
                                            p: 2,
                                            textAlign: 'center',
                                            borderBottom: '1px solid #e2e8f0',
                                            fontWeight: 700,
                                            fontSize: '0.725rem',
                                            color: '#475569',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                        }}
                                    >
                                        <Tooltip title={model.label} arrow placement="top">
                                            <span>{model.shortLabel}</span>
                                        </Tooltip>
                                    </Box>
                                ))}
                            </Box>
                        </Box>

                        <Box component="tbody">
                            {allMethods.map((method) => (
                                <Box component="tr" key={method.id} sx={{ '&:hover': { bgcolor: '#fbfcfd' } }}>
                                    {/* Method Row Label */}
                                    <Box
                                        component="td"
                                        sx={{
                                            p: 2,
                                            borderBottom: '1px solid #f1f5f9',
                                            verticalAlign: 'middle',
                                        }}
                                    >
                                        <Typography variant="subtitle2" fontWeight={700} color="#1e293b" fontSize="0.825rem">
                                            {method.shortLabel}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" fontSize="0.7rem" display="block">
                                            {method.label}
                                        </Typography>
                                    </Box>

                                    {/* Evaluated Cells */}
                                    {allModels.map((model) => {
                                        const key = `${method.id}__${model.id}`;
                                        const evalFileInfo = evaluatedFileMapping.get(key);
                                        const genFileInfo = generatedFileMapping.get(key);
                                        const stats = evalFileInfo ? evaluatedStatsMap[evalFileInfo.fileName] : null;

                                        if (!evalFileInfo) {
                                            const isPending = !!genFileInfo;
                                            return (
                                                <Box
                                                    component="td"
                                                    key={model.id}
                                                    sx={{
                                                        p: 1.25,
                                                        borderBottom: '1px solid #f1f5f9',
                                                        textAlign: 'center',
                                                        verticalAlign: 'middle',
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            p: 1.5,
                                                            bgcolor: isPending ? '#fffbeb' : '#f8fafc',
                                                            border: isPending ? '1px dashed #fde68a' : '1px dashed #e2e8f0',
                                                            borderRadius: 2,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            minHeight: 88,
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="caption"
                                                            color={isPending ? '#b45309' : '#94a3b8'}
                                                            fontSize="0.7rem"
                                                            fontWeight={isPending ? 600 : 400}
                                                        >
                                                            {isPending ? 'Pending Eval' : '—'}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            );
                                        }

                                        const overallColors = stats ? getAsrColor(stats.overallAsr) : null;

                                        return (
                                            <Box
                                                component="td"
                                                key={model.id}
                                                sx={{
                                                    p: 1.25,
                                                    borderBottom: '1px solid #f1f5f9',
                                                    verticalAlign: 'middle',
                                                }}
                                            >
                                                <Box
                                                    onClick={() => {
                                                        if (stats) {
                                                            setSelectedEvaluatedCell({
                                                                evalData: stats,
                                                                methodMeta: method,
                                                                modelMeta: model,
                                                            });
                                                        }
                                                    }}
                                                    sx={{
                                                        p: 1.25,
                                                        bgcolor: '#ffffff',
                                                        border: `1px solid ${overallColors ? overallColors.border : '#e2e8f0'}`,
                                                        borderRadius: 2,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                        minHeight: 88,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'space-between',
                                                        '&:hover': {
                                                            borderColor: overallColors ? overallColors.text : '#94a3b8',
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                                                            transform: 'translateY(-1px)',
                                                        },
                                                    }}
                                                >
                                                    {/* Overall ASR Badge */}
                                                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                                                        <Typography variant="caption" color="text.secondary" fontWeight={600} fontSize="0.675rem">
                                                            ASR
                                                        </Typography>
                                                        <Chip
                                                            label={stats ? `${stats.overallAsr}%` : 'Calculating...'}
                                                            size="small"
                                                            sx={{
                                                                height: 20,
                                                                fontSize: '0.725rem',
                                                                fontWeight: 800,
                                                                bgcolor: overallColors ? overallColors.bg : '#f1f5f9',
                                                                color: overallColors ? overallColors.text : '#475569',
                                                                border: `1px solid ${overallColors ? overallColors.border : '#e2e8f0'}`,
                                                            }}
                                                        />
                                                    </Stack>

                                                    {/* 4-Variant Mini Grid */}
                                                    {stats?.categories ? (
                                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', mb: 0.5 }}>
                                                            <Tooltip title={`English Plain: ${stats.categories['plain-en']?.hits}/${stats.categories['plain-en']?.total}`} arrow placement="top">
                                                                <Box sx={{ px: 0.6, py: 0.2, bgcolor: '#f8fafc', borderRadius: 0.75, fontSize: '0.625rem', textAlign: 'center', color: '#475569' }}>
                                                                    EN Pl: <strong>{stats.categories['plain-en']?.rate}%</strong>
                                                                </Box>
                              </Tooltip>
                                                            <Tooltip title={`English Attack: ${stats.categories['attack-en']?.hits}/${stats.categories['attack-en']?.total}`} arrow placement="top">
                                                                <Box sx={{ px: 0.6, py: 0.2, bgcolor: '#eff6ff', borderRadius: 0.75, fontSize: '0.625rem', textAlign: 'center', color: '#1d4ed8' }}>
                                                                    EN Atk: <strong>{stats.categories['attack-en']?.rate}%</strong>
                                                                </Box>
                                                            </Tooltip>
                                                            <Tooltip title={`Portuguese Plain: ${stats.categories['plain-ptbr']?.hits}/${stats.categories['plain-ptbr']?.total}`} arrow placement="top">
                                                                <Box sx={{ px: 0.6, py: 0.2, bgcolor: '#f0fdf4', borderRadius: 0.75, fontSize: '0.625rem', textAlign: 'center', color: '#15803d' }}>
                                                                    PT Pl: <strong>{stats.categories['plain-ptbr']?.rate}%</strong>
                                                                </Box>
                                                            </Tooltip>
                                                            <Tooltip title={`Portuguese Attack: ${stats.categories['attack-ptbr']?.hits}/${stats.categories['attack-ptbr']?.total}`} arrow placement="top">
                                                                <Box sx={{ px: 0.6, py: 0.2, bgcolor: '#fef2f2', borderRadius: 0.75, fontSize: '0.625rem', textAlign: 'center', color: '#b91c1c' }}>
                                                                    PT Atk: <strong>{stats.categories['attack-ptbr']?.rate}%</strong>
                                                                </Box>
                                                            </Tooltip>
                                                        </Box>
                                                    ) : (
                                                        <LinearProgress sx={{ my: 1, borderRadius: 1 }} />
                                                    )}

                                                    <Typography variant="caption" color="text.secondary" fontSize="0.625rem" textAlign="right" display="block">
                                                        {stats ? (
                                                            stats.errorCount > 0
                                                                ? `${stats.evaluatedCount.toLocaleString()} rows (${stats.errorCount} error${stats.errorCount > 1 ? 's' : ''})`
                                                                : `${stats.evaluatedCount.toLocaleString()} rows`
                                                        ) : ''}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            ))}
                        </Box>
                    </Box>
                </Box>
            </Box>

            {/* Evaluated Cell Detail Inspection Modal */}
            <EvaluatedCellDetailModal
                open={Boolean(selectedEvaluatedCell)}
                onClose={() => setSelectedEvaluatedCell(null)}
                evalData={selectedEvaluatedCell?.evalData}
                methodMeta={selectedEvaluatedCell?.methodMeta}
                modelMeta={selectedEvaluatedCell?.modelMeta}
                onNavigateToFile={(fileName, targetView) => {
                    setSelectedEvaluatedCell(null);
                    if (onNavigateToFile) onNavigateToFile(fileName, targetView);
                }}
            />
        </Stack>
    );
}
