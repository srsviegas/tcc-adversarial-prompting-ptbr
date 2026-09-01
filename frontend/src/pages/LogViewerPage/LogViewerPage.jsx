import React, { useState, useEffect, useMemo } from 'react';
import { Box, Stack, Typography, Alert, CircularProgress } from '@mui/material';
import { useLogDirectory } from '../../hooks/useLogDirectory';
import { LogDirectorySelector } from './components/LogDirectorySelector';
import { LogFileSelect } from './components/LogFileSelect';
import { LogDataGrid } from './components/LogDataGrid';
import { ColumnSelectorButton } from './components/ColumnSelectorButton';
import { ColumnSelectorModal } from './components/ColumnSelectorModal';
import { buildAllDataColumns } from './utils/columnUtils';
import { useColumnVisibility } from './hooks/useColumnVisibility';

export default function LogViewerPage() {
    const { directoryHandle, availableFiles, error, selectDirectory, refreshDirectory, getFileContent } = useLogDirectory();
    const [selectedFile, setSelectedFile] = useState('');
    const [logData, setLogData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [parseError, setParseError] = useState(null);
    const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);

    const loadData = async (fileToLoad) => {
        if (!fileToLoad) {
            setLogData([]);
            return;
        }
        setLoading(true);
        setParseError(null);

        const content = await getFileContent(fileToLoad);
        if (content) {
            try {
                const lines = content.split('\n').filter(line => line.trim() !== '');
                const parsed = lines.map((line, index) => {
                    const obj = JSON.parse(line);
                    if (obj.id === undefined) {
                        obj.id = index;
                    }
                    return obj;
                });
                setLogData(parsed);
            } catch (err) {
                setParseError('Failed to parse JSONL: ' + err.message);
                setLogData([]);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        if (availableFiles && availableFiles.length > 0) {
            if (!selectedFile || !availableFiles.includes(selectedFile)) {
                setSelectedFile(availableFiles[0]);
            }
        } else {
            setSelectedFile('');
        }
    }, [availableFiles]);

    useEffect(() => {
        loadData(selectedFile);
    }, [selectedFile, getFileContent]);

    const handleRefresh = async () => {
        await refreshDirectory();
        if (selectedFile) {
            await loadData(selectedFile);
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
        return rawColumns.filter((c) => c.field !== '__expand__' && c.field !== '__copy__');
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
                        {selectedFile && logData.length > 0 && (
                            <ColumnSelectorButton
                                onClick={() => setIsColumnModalOpen(true)}
                                visibleCount={visibleCount}
                                totalCount={selectableColumns.length}
                            />
                        )}
                        <LogFileSelect
                            availableFiles={availableFiles}
                            selectedFile={selectedFile}
                            onFileSelect={setSelectedFile}
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

            {loading ? (
                <Stack alignItems="center" justifyContent="center" p={8}>
                    <CircularProgress size={32} thickness={4} />
                </Stack>
            ) : (
                selectedFile && (
                    <LogDataGrid
                        data={logData}
                        columnVisibilityModel={columnVisibilityModel}
                        onColumnVisibilityModelChange={setColumnVisibilityModel}
                    />
                )
            )}
        </Box>
    );
}
