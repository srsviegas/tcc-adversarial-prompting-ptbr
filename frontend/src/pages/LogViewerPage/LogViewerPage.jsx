import React, { useState, useEffect, useMemo } from 'react';
import { Box, Stack, Typography, Alert, CircularProgress, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTable, faFlask, faLayerGroup } from '@fortawesome/free-solid-svg-icons';
import { useLogDirectory } from '../../hooks/useLogDirectory';
import { LogDirectorySelector } from './components/LogDirectorySelector';
import { LogFileSelect, ALL_LOGS_OPTION } from './components/LogFileSelect';
import { LogDataGrid } from './components/LogDataGrid';
import { ColumnSelectorButton } from './components/ColumnSelectorButton';
import { ColumnSelectorModal } from './components/ColumnSelectorModal';
import { buildAllDataColumns } from './utils/columnUtils';
import { useColumnVisibility } from './hooks/useColumnVisibility';
import { TestCaseAnalysisView } from './components/TestCaseAnalysisView';
import { LogRowDetailModal } from './components/LogRowDetailModal';
import { OverviewMatrixView } from './components/OverviewMatrixView';

export default function LogViewerPage() {
    const {
        directoryHandle,
        availableFiles,
        evaluatedFiles,
        error,
        selectDirectory,
        refreshDirectory,
        getFileContent,
        getEvaluatedFileContent,
    } = useLogDirectory();
    const [selectedFile, setSelectedFile] = useState('');
    const [logData, setLogData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [parseError, setParseError] = useState(null);
    const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
    const [activeView, setActiveView] = useState('overview');
    const [selectedModalRow, setSelectedModalRow] = useState(null);
    const [modalRowIndex, setModalRowIndex] = useState(0);

    const handleOpenRowModal = (row) => {
        const idx = logData.findIndex((r) => r.id === row.id);
        setSelectedModalRow(row);
        setModalRowIndex(idx >= 0 ? idx : 0);
    };

    const handleModalNavigate = (newIndex) => {
        if (newIndex >= 0 && newIndex < logData.length) {
            setModalRowIndex(newIndex);
            setSelectedModalRow(logData[newIndex]);
        }
    };

    const handleNavigateToFile = (fileName, targetView = 'raw') => {
        if (fileName) {
            setSelectedFile(fileName);
        }
        setActiveView(targetView);
    };

    const handleFileSelect = (file) => {
        setSelectedFile(file);
        if (activeView === 'overview') {
            setActiveView('raw');
        }
    };

    const loadData = React.useCallback(async (fileToLoad, filesList = availableFiles) => {
        if (!fileToLoad || !filesList || filesList.length === 0) {
            setLogData([]);
            return;
        }
        setLoading(true);
        setParseError(null);

        try {
            const normalizeLogRow = (obj, index) => {
                if (obj.id === undefined) {
                    obj.id = index;
                }
                if (obj.evaluations && Array.isArray(obj.evaluations) && obj.evaluations.length > 0) {
                    const ev = obj.evaluations[obj.evaluations.length - 1];
                    obj.evaluation_result = {
                        verdict: ev.verdict || (ev.flagged ? 'unsafe' : 'safe'),
                        flagged: Boolean(ev.flagged),
                        evaluator: ev.evaluator || 'aegis',
                        evaluator_model: ev.model || '',
                        flagged_categories: Array.isArray(ev.flagged_categories) ? ev.flagged_categories.join(', ') : '',
                        status: ev.status || 'success',
                        latency_seconds: ev.latency_seconds,
                    };
                    if (!obj.evaluation || obj.evaluation.attack_success_rate_hit === null || obj.evaluation.attack_success_rate_hit === undefined) {
                        obj.evaluation = {
                            ...(obj.evaluation || {}),
                            attack_success_rate_hit: ev.flagged === true || String(ev.verdict).toLowerCase() === 'unsafe',
                            eval_method: ev.evaluator,
                            eval_date: ev.evaluated_at,
                        };
                    }
                }
                return obj;
            };

            if (fileToLoad === ALL_LOGS_OPTION) {
                const fileResults = await Promise.all(
                    filesList.map(async (fileName) => {
                        const text = await getFileContent(fileName);
                        return { fileName, text };
                    })
                );

                let globalIndex = 0;
                const allRows = [];
                for (const { fileName, text } of fileResults) {
                    if (!text) continue;
                    const lines = text.split('\n').filter((line) => line.trim() !== '');
                    for (const line of lines) {
                        try {
                            const obj = JSON.parse(line);
                            allRows.push(normalizeLogRow(obj, globalIndex++));
                        } catch (err) {
                            throw new Error(`Failed to parse line in ${fileName}: ${err.message}`);
                        }
                    }
                }
                setLogData(allRows);
            } else {
                const content = await getFileContent(fileToLoad);
                if (content) {
                    const lines = content.split('\n').filter((line) => line.trim() !== '');
                    const parsed = lines.map((line, index) => {
                        const obj = JSON.parse(line);
                        return normalizeLogRow(obj, index);
                    });
                    setLogData(parsed);
                } else {
                    setLogData([]);
                }
            }
        } catch (err) {
            setParseError(err.message || 'Failed to parse JSONL');
            setLogData([]);
        } finally {
            setLoading(false);
        }
    }, [availableFiles, getFileContent]);

    useEffect(() => {
        if (availableFiles && availableFiles.length > 0) {
            setSelectedFile((prev) => {
                if (prev === ALL_LOGS_OPTION || availableFiles.includes(prev)) {
                    return prev;
                }
                return ALL_LOGS_OPTION;
            });
        } else {
            setSelectedFile('');
        }
    }, [availableFiles]);

    useEffect(() => {
        if (selectedFile) {
            loadData(selectedFile, availableFiles);
        } else {
            setLogData([]);
        }
    }, [selectedFile, availableFiles, loadData]);

    const handleRefresh = async () => {
        await refreshDirectory();
        if (selectedFile) {
            await loadData(selectedFile, availableFiles);
        }
    };

    const rawColumns = useMemo(() => {
        return buildAllDataColumns(logData);
    }, [logData]);

    const {
        columnVisibilityModel,
        setColumnVisibilityModel,
        toggleColumn,
        selectAll,
        deselectAll,
        resetToDefaults,
        toggleCategory,
    } = useColumnVisibility(rawColumns);

    const selectableColumns = useMemo(() => {
        return rawColumns.filter((c) => c.field !== '__expand__' && c.field !== '__copy__' && c.field !== '__details__');
    }, [rawColumns]);

    const visibleCount = useMemo(() => {
        return selectableColumns.filter((c) => columnVisibilityModel[c.field] !== false).length;
    }, [selectableColumns, columnVisibilityModel]);

    return (
        <Box py={6} px={8} maxWidth="100%">
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
                <Typography variant="h5" component="h1" fontWeight={700} color="#0f172a" letterSpacing="-0.02em">
                    Log Viewer
                </Typography>

                {directoryHandle && (
                    <ToggleButtonGroup
                        value={activeView}
                        exclusive
                        onChange={(e, val) => { if (val) setActiveView(val); }}
                        size="small"
                        sx={{
                            bgcolor: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            borderRadius: 2,
                            p: 0.375,
                            '& .MuiToggleButton-root': {
                                border: 'none',
                                borderRadius: '6px !important',
                                px: 2,
                                py: 0.625,
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                color: '#64748b',
                                textTransform: 'none',
                                transition: 'all 0.15s ease',
                                '&.Mui-selected': {
                                    bgcolor: '#ffffff',
                                    color: '#0f172a',
                                    fontWeight: 600,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                    '&:hover': { bgcolor: '#ffffff' },
                                },
                                '&:hover': { bgcolor: '#e2e8f0' },
                            },
                        }}
                    >
                        <ToggleButton value="overview">
                            <FontAwesomeIcon icon={faLayerGroup} style={{ fontSize: '0.75rem', marginRight: 6 }} />
                            Overview
                        </ToggleButton>
                        <ToggleButton value="raw">
                            <FontAwesomeIcon icon={faTable} style={{ fontSize: '0.75rem', marginRight: 6 }} />
                            Raw Logs
                        </ToggleButton>
                        <ToggleButton value="testcases">
                            <FontAwesomeIcon icon={faFlask} style={{ fontSize: '0.75rem', marginRight: 6 }} />
                            Test Cases
                        </ToggleButton>
                    </ToggleButtonGroup>
                )}
            </Stack>

            {(error || parseError) && (
                <Alert severity="error" borderRadius={2} mb={3}>
                    {error || parseError}
                </Alert>
            )}

            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" spacing={2} mb={2.5}>
                <LogDirectorySelector
                    onSelect={selectDirectory}
                    isSelected={!!directoryHandle}
                />

                {directoryHandle && (
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        {selectedFile && logData.length > 0 && activeView === 'raw' && (
                            <ColumnSelectorButton
                                onClick={() => setIsColumnModalOpen(true)}
                                visibleCount={visibleCount}
                                totalCount={selectableColumns.length}
                            />
                        )}
                        <LogFileSelect
                            availableFiles={availableFiles}
                            evaluatedFiles={evaluatedFiles}
                            selectedFile={selectedFile}
                            onFileSelect={handleFileSelect}
                            onRefresh={handleRefresh}
                            isRefreshing={loading}
                        />
                    </Stack>
                )}
            </Stack>

            {/* Column Selector Modal */}
            <ColumnSelectorModal
                open={isColumnModalOpen}
                onClose={() => setIsColumnModalOpen(false)}
                columns={rawColumns}
                columnVisibilityModel={columnVisibilityModel}
                onToggleColumn={toggleColumn}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
                onResetToDefaults={resetToDefaults}
                onToggleCategory={toggleCategory}
            />

            {!directoryHandle ? (
                <Box
                    sx={{
                        py: 8,
                        px: 4,
                        bgcolor: '#ffffff',
                        border: '1px dashed #cbd5e1',
                        borderRadius: 3,
                        textAlign: 'center',
                    }}
                >
                    <Typography variant="h6" fontWeight={700} color="#0f172a" mb={1}>
                        No Log Directory Connected
                    </Typography>
                    <Typography variant="body2" color="text.secondary" maxWidth={500} mx="auto">
                        Connect your project's <code>logs/</code> directory using the button above to view benchmark matrices and detailed evaluation results.
                    </Typography>
                </Box>
            ) : activeView === 'overview' ? (
                <OverviewMatrixView
                    availableFiles={availableFiles}
                    evaluatedFiles={evaluatedFiles}
                    getFileContent={getFileContent}
                    getEvaluatedFileContent={getEvaluatedFileContent}
                    onNavigateToFile={handleNavigateToFile}
                />
            ) : loading ? (
                <Stack alignItems="center" justifyContent="center" p={8}>
                    <CircularProgress size={32} thickness={4} />
                </Stack>
            ) : (
                selectedFile && (
                    activeView === 'raw' ? (
                        <LogDataGrid
                            data={logData}
                            columnVisibilityModel={columnVisibilityModel}
                            onColumnVisibilityModelChange={setColumnVisibilityModel}
                            onOpenRowDetails={handleOpenRowModal}
                        />
                    ) : (
                        <TestCaseAnalysisView data={logData} />
                    )
                )
            )}

            {/* Row Detail Modal */}
            <LogRowDetailModal
                open={Boolean(selectedModalRow)}
                onClose={() => setSelectedModalRow(null)}
                row={selectedModalRow}
                rowIndex={modalRowIndex}
                totalRows={logData.length}
                onNavigate={handleModalNavigate}
            />
        </Box>
    );
}
