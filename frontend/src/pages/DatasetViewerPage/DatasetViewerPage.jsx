import React, { useState, useEffect, useMemo } from 'react';
import {
    Box,
    Stack,
    Typography,
    Alert,
    CircularProgress,
    ToggleButtonGroup,
    ToggleButton,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTable, faCodeCompare } from '@fortawesome/free-solid-svg-icons';
import { useDatasetDirectory } from './hooks/useDatasetDirectory';
import { parseDatasetFile } from './utils/datasetReader';
import { findTranslationPairs } from './utils/datasetColumnUtils';
import { DatasetSourceSelector } from './components/DatasetSourceSelector';
import { DatasetDataGrid } from './components/DatasetDataGrid';
import { SideBySideReviewView } from './components/SideBySideReviewView';
import { SideBySideModal } from './components/SideBySideModal';

export default function DatasetViewerPage() {
    const {
        directoryHandle,
        availableFiles,
        error: dirError,
        selectDirectory,
        getFileHandle,
    } = useDatasetDirectory();
    const [selectedFileName, setSelectedFileName] = useState('');
    const [datasetRows, setDatasetRows] = useState([]);
    const [datasetColumns, setDatasetColumns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [parseError, setParseError] = useState(null);
    const [activeView, setActiveView] = useState('grid');
    const [selectedModalRow, setSelectedModalRow] = useState(null);
    const [modalRowIndex, setModalRowIndex] = useState(0);
    const [columnVisibilityModel, setColumnVisibilityModel] = useState({});

    const { pairs } = useMemo(() => {
        return findTranslationPairs(datasetColumns);
    }, [datasetColumns]);

    const loadFileObject = React.useCallback(async (file) => {
        if (!file) return;
        setLoading(true);
        setParseError(null);
        try {
            const { rows, columns, fileName } = await parseDatasetFile(file);
            setDatasetRows(rows);
            setDatasetColumns(columns);
            setSelectedFileName(fileName);
        } catch (err) {
            setParseError(err.message || 'failed to parse dataset file');
            setDatasetRows([]);
            setDatasetColumns([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSelectFromDirectory = React.useCallback(
        async (fileName) => {
            setSelectedFileName(fileName);
            const file = await getFileHandle(fileName);
            if (file) {
                await loadFileObject(file);
            }
        },
        [getFileHandle, loadFileObject],
    );

    useEffect(() => {
        if (availableFiles && availableFiles.length > 0) {
            handleSelectFromDirectory(availableFiles[0]);
        }
    }, [availableFiles, handleSelectFromDirectory]);

    const handleOpenModal = (row) => {
        const idx = datasetRows.findIndex((r) => r.id === row.id);
        setSelectedModalRow(row);
        setModalRowIndex(idx >= 0 ? idx : 0);
    };

    const handleModalNavigate = (newIndex) => {
        if (newIndex >= 0 && newIndex < datasetRows.length) {
            setModalRowIndex(newIndex);
            setSelectedModalRow(datasetRows[newIndex]);
        }
    };

    return (
        <Box py={6} px={8} maxWidth="100%">
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                flexWrap="wrap"
                gap={2}
                mb={3}
            >
                <Stack
                    direction="row"
                    alignItems="center"
                    spacing={3}
                    flexWrap="wrap"
                    gap={1.5}
                >
                    <Typography
                        variant="h5"
                        component="h1"
                        fontWeight={700}
                        color="#0f172a"
                        letterSpacing="-0.02em"
                    >
                        Dataset Viewer
                    </Typography>

                    <DatasetSourceSelector
                        onFileSelect={loadFileObject}
                        availableFiles={availableFiles}
                        selectedFileName={selectedFileName}
                        onSelectFromDirectory={handleSelectFromDirectory}
                        onPickDirectory={selectDirectory}
                        hasDirectory={!!directoryHandle}
                        rowCount={datasetRows.length}
                    />
                </Stack>

                {datasetRows.length > 0 && (
                    <ToggleButtonGroup
                        value={activeView}
                        exclusive
                        onChange={(_, val) => {
                            if (val) setActiveView(val);
                        }}
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
                                '&.Mui-selected': {
                                    bgcolor: '#ffffff',
                                    color: '#0f172a',
                                    fontWeight: 600,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                },
                                '&:hover': { bgcolor: '#e2e8f0' },
                            },
                        }}
                    >
                        <ToggleButton value="grid">
                            <FontAwesomeIcon
                                icon={faTable}
                                style={{ fontSize: '0.75rem', marginRight: 6 }}
                            />
                            Table Grid
                        </ToggleButton>
                        <ToggleButton value="sidebyside">
                            <FontAwesomeIcon
                                icon={faCodeCompare}
                                style={{ fontSize: '0.75rem', marginRight: 6 }}
                            />
                            Side-by-Side Review
                        </ToggleButton>
                    </ToggleButtonGroup>
                )}
            </Stack>

            {(dirError || parseError) && (
                <Alert severity="error" sx={{ borderRadius: 2, mb: 3 }}>
                    {dirError || parseError}
                </Alert>
            )}

            {loading ? (
                <Stack alignItems="center" justifyContent="center" p={8}>
                    <CircularProgress size={32} thickness={4} />
                </Stack>
            ) : activeView === 'grid' ? (
                <DatasetDataGrid
                    data={datasetRows}
                    columns={datasetColumns}
                    onOpenSideBySide={handleOpenModal}
                    columnVisibilityModel={columnVisibilityModel}
                    onColumnVisibilityModelChange={setColumnVisibilityModel}
                />
            ) : (
                <SideBySideReviewView
                    data={datasetRows}
                    columns={datasetColumns}
                />
            )}

            <SideBySideModal
                open={Boolean(selectedModalRow)}
                onClose={() => setSelectedModalRow(null)}
                row={selectedModalRow}
                pairs={pairs}
                rowIndex={modalRowIndex}
                totalRows={datasetRows.length}
                onNavigate={handleModalNavigate}
            />
        </Box>
    );
}
