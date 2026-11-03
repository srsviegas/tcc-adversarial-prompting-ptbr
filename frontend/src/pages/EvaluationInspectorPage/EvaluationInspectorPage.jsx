import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Stack,
  Typography,
  Alert,
  CircularProgress,
  Pagination,
  FormControl,
  Select,
  MenuItem,
  Card,
  CardContent,
  Button,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faScaleBalanced,
  faFolderTree,
  faFileLines,
  faTableCells,
} from '@fortawesome/free-solid-svg-icons';
import { ToggleButtonGroup, ToggleButton } from '@mui/material';

import { useEvaluationWorkspace } from '../../hooks/useEvaluationWorkspace';
import { InspectionWorkspaceSelector } from './components/InspectionWorkspaceSelector';
import { InspectionStatsBar } from './components/InspectionStatsBar';
import { SideBySideInspectionCard } from './components/SideBySideInspectionCard';
import { InspectionTableView } from './components/InspectionTableView';
import { InspectionDetailModal } from './components/InspectionDetailModal';
import { CrossLingualSummaryModal } from './components/CrossLingualSummaryModal';
import { EvaluationMatrixOverview } from './components/EvaluationMatrixOverview';

export default function EvaluationInspectorPage() {
  const {
    logsDirHandle,
    evaluationsDirHandle,
    availableFiles,
    selectedFile,
    setSelectedFile,
    consensusSummary,
    matrixStats,
    matrixLoading,
    matrixProgress,
    loading,
    error,
    selectProjectRoot,
    selectLogsDirectory,
    selectEvaluationsDirectory,
    loadEvaluationFile,
    loadConsensusSummary,
    loadMatrixOverviewData,
    refreshDirectory,
  } = useEvaluationWorkspace();

  const [rows, setRows] = useState([]);
  const [fileStats, setFileStats] = useState(null);
  const [crossLingualModalOpen, setCrossLingualModalOpen] = useState(false);
  const [pageViewMode, setPageViewMode] = useState('matrix');

  // Filters
  const [filterVerdict, setFilterVerdict] = useState('all');
  const [filterLang, setFilterLang] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // View state
  const [viewMode, setViewMode] = useState('cards');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal inspection
  const [selectedModalRow, setSelectedModalRow] = useState(null);
  const [modalIndex, setModalIndex] = useState(0);

  // Load consensus summary when evaluationsDirHandle changes
  useEffect(() => {
    if (evaluationsDirHandle) {
      loadConsensusSummary();
    }
  }, [evaluationsDirHandle, loadConsensusSummary]);

  // When files are discovered and none selected, auto-select first file
  useEffect(() => {
    if (availableFiles.length > 0 && !selectedFile) {
      setSelectedFile(availableFiles[0].name);
    }
  }, [availableFiles, selectedFile, setSelectedFile]);

  // Load evaluation file when selectedFile changes
  useEffect(() => {
    let isCancelled = false;
    const fetchFileData = async () => {
      if (!selectedFile) {
        setRows([]);
        setFileStats(null);
        return;
      }
      const { rows: loadedRows, stats: loadedStats } = await loadEvaluationFile(selectedFile);
      if (!isCancelled) {
        setRows(loadedRows);
        setFileStats(loadedStats);
        setPage(1);
      }
    };

    fetchFileData();
    return () => {
      isCancelled = true;
    };
  }, [selectedFile, loadEvaluationFile]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // 1. Verdict filter
      if (filterVerdict === 'dangerous') {
        if (r.evaluations?.consensus?.consensus_dangerous !== true) return false;
      } else if (filterVerdict === 'safe') {
        if (r.evaluations?.consensus?.consensus_dangerous !== false) return false;
      } else if (filterVerdict === 'disagreement') {
        if (!r.evaluations?.consensus?.is_disagreement) return false;
      } else if (filterVerdict === 'pending') {
        if (r.evaluations?.consensus?.has_quorum) return false;
      }

      // 2. Language filter
      if (filterLang !== 'all') {
        const lang = r.inputs?.prompt_language || 'pt-BR';
        if (lang.toLowerCase() !== filterLang.toLowerCase()) return false;
      }

      // 3. Search query
      if (searchTerm && searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const prompt = (r.inputs?.user_input_raw || r.inputs?.user_prompt || '').toLowerCase();
        const resp = (r.output?.extracted_text || '').toLowerCase();
        const reasoningQwen = (r.evaluations?.qwen_judge?.reasoning || '').toLowerCase();
        const reasoningGemma = (r.evaluations?.gemma_judge?.reasoning || '').toLowerCase();
        if (!prompt.includes(q) && !resp.includes(q) && !reasoningQwen.includes(q) && !reasoningGemma.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [rows, filterVerdict, filterLang, searchTerm]);

  // Paginated rows for Card View
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;

  const handleOpenRowModal = (row) => {
    const idx = filteredRows.findIndex((r) => r.id === row.id);
    setSelectedModalRow(row);
    setModalIndex(idx >= 0 ? idx : 0);
  };

  const handleModalNavigate = (newIdx) => {
    if (newIdx >= 0 && newIdx < filteredRows.length) {
      setModalIndex(newIdx);
      setSelectedModalRow(filteredRows[newIdx]);
    }
  };

  return (
    <Box py={5} px={8} maxWidth="100%">
      {/* Top Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #bfdbfe',
            }}
          >
            <FontAwesomeIcon icon={faScaleBalanced} style={{ color: '#2563eb', fontSize: '1.1rem' }} />
          </Box>
          <Box>
            <Typography variant="h5" component="h1" fontWeight={800} color="#0f172a" letterSpacing="-0.02em">
              Evaluation Inspector
            </Typography>
            <Typography variant="body2" color="#64748b">
              Multi-evaluator sidecars, voting consensus verdicts, and benchmark overview matrix.
            </Typography>
          </Box>
        </Stack>

        {(logsDirHandle || evaluationsDirHandle) && (
          <ToggleButtonGroup
            value={pageViewMode}
            exclusive
            onChange={(_, val) => {
              if (val) setPageViewMode(val);
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
                fontWeight: 600,
                color: '#64748b',
                textTransform: 'none',
                transition: 'all 0.15s ease',
                '&.Mui-selected': {
                  bgcolor: '#ffffff',
                  color: '#0f172a',
                  fontWeight: 700,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  '&:hover': { bgcolor: '#ffffff' },
                },
                '&:hover': { bgcolor: '#e2e8f0' },
              },
            }}
          >
            <ToggleButton value="matrix">
              <FontAwesomeIcon icon={faTableCells} style={{ fontSize: '0.75rem', marginRight: 6 }} />
              Matrix Overview
            </ToggleButton>
            <ToggleButton value="inspector">
              <FontAwesomeIcon icon={faScaleBalanced} style={{ fontSize: '0.75rem', marginRight: 6 }} />
              Side-by-Side Inspector
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </Stack>

      {/* Workspace Directory & File Selector */}
      <InspectionWorkspaceSelector
        logsDirHandle={logsDirHandle}
        evaluationsDirHandle={evaluationsDirHandle}
        availableFiles={availableFiles}
        selectedFile={selectedFile}
        pageViewMode={pageViewMode}
        onTogglePageViewMode={setPageViewMode}
        onFileSelect={(file) => {
          setSelectedFile(file);
          setPageViewMode('inspector');
        }}
        onSelectProjectRoot={selectProjectRoot}
        onSelectLogsDir={selectLogsDirectory}
        onSelectEvaluationsDir={selectEvaluationsDirectory}
        onRefresh={refreshDirectory}
        onOpenCrossLingualSummary={() => setCrossLingualModalOpen(true)}
        hasConsensusSummary={Boolean(consensusSummary)}
        loading={loading}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {evaluationsDirHandle && !logsDirHandle && (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" onClick={selectLogsDirectory} sx={{ fontWeight: 700 }}>
              Select Logs Folder
            </Button>
          }
          sx={{ mb: 3 }}
        >
          Evaluations connected, but <strong>logs/</strong> folder has not been selected yet. Click <strong>&quot;Select Logs...&quot;</strong> to link original prompt inputs and completions side-by-side.
        </Alert>
      )}

      {/* Empty State when no directory is open */}
      {!logsDirHandle && !evaluationsDirHandle && (
        <Card
          sx={{
            p: 6,
            textAlign: 'center',
            bgcolor: '#ffffff',
            border: '2px dashed #cbd5e1',
            borderRadius: 3,
            boxShadow: 'none',
          }}
        >
          <CardContent>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: '#f1f5f9',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <FontAwesomeIcon icon={faFolderTree} style={{ fontSize: '1.75rem', color: '#64748b' }} />
            </Box>
            <Typography variant="h6" fontWeight={700} color="#0f172a" gutterBottom>
              Open Your Benchmark Workspace
            </Typography>
            <Typography variant="body2" color="#64748b" maxWidth={500} mx="auto" mb={3}>
              Click <strong>&quot;Open Project Folder&quot;</strong> to select your repository folder. The inspector will
              automatically connect both <code>logs/</code> and <code>evaluations/</code> sidecars.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="contained"
                onClick={selectProjectRoot}
                startIcon={<FontAwesomeIcon icon={faFolderTree} />}
                sx={{ bgcolor: '#0f172a', color: '#ffffff', fontWeight: 600 }}
              >
                Open Project Folder
              </Button>
              <Button
                variant="outlined"
                onClick={selectLogsDirectory}
                startIcon={<FontAwesomeIcon icon={faFileLines} />}
              >
                Select Logs Folder
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Main Content Area */}
      {(logsDirHandle || evaluationsDirHandle) && (
        pageViewMode === 'matrix' ? (
          <EvaluationMatrixOverview
            availableFiles={availableFiles}
            matrixStats={matrixStats}
            loading={matrixLoading}
            progress={matrixProgress}
            onLoadMatrixData={loadMatrixOverviewData}
            onInspectFile={(fileName) => {
              setSelectedFile(fileName);
              setPageViewMode('inspector');
            }}
          />
        ) : (
          /* Side-by-Side File Inspector View */
          <>
            {loading && (
              <Box py={8} textAlign="center">
                <CircularProgress size={36} sx={{ color: '#2563eb', mb: 2 }} />
                <Typography variant="body2" color="#64748b" fontWeight={500}>
                  Loading and pairing generation logs with evaluator sidecars...
                </Typography>
              </Box>
            )}

            {!loading && !selectedFile && (
              <Card sx={{ p: 5, textAlign: 'center', bgcolor: '#ffffff', borderRadius: 3, border: '1px solid #e2e8f0' }}>
                <Typography variant="h6" fontWeight={700} color="#0f172a" gutterBottom>
                  No Benchmark File Selected
                </Typography>
                <Typography variant="body2" color="#64748b" maxWidth={500} mx="auto" mb={2}>
                  Choose a benchmark test run from the dropdown above or switch back to the Matrix Overview to inspect test cases.
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => setPageViewMode('matrix')}
                  startIcon={<FontAwesomeIcon icon={faTableCells} />}
                  sx={{ bgcolor: '#2563eb', fontWeight: 600 }}
                >
                  Go to Matrix Overview
                </Button>
              </Card>
            )}

            {!loading && selectedFile && (
              <>
                {/* Stats & Filter Bar */}
                <InspectionStatsBar
                  stats={fileStats}
                  filterVerdict={filterVerdict}
                  onFilterVerdictChange={setFilterVerdict}
                  filterLang={filterLang}
                  onFilterLangChange={setFilterLang}
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  totalFilteredCount={filteredRows.length}
                />

                {filteredRows.length === 0 ? (
                  <Card sx={{ p: 4, textAlign: 'center', bgcolor: '#ffffff', borderRadius: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600} color="#475569" gutterBottom>
                      No test cases matched your filter criteria
                    </Typography>
                    <Typography variant="body2" color="#94a3b8">
                      Try resetting your search query or verdict filters.
                    </Typography>
                  </Card>
                ) : viewMode === 'cards' ? (
                  /* Cards View */
                  <Box>
                    {paginatedRows.map((row) => (
                      <SideBySideInspectionCard
                        key={row.id}
                        row={row}
                        onInspectRow={handleOpenRowModal}
                      />
                    ))}

                    {/* Pagination Bar */}
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={2}
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{
                        bgcolor: '#ffffff',
                        p: 2,
                        borderRadius: 2,
                        border: '1px solid #e2e8f0',
                        mt: 2,
                      }}
                    >
                      <Typography variant="body2" color="#64748b">
                        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredRows.length)} of{' '}
                        <strong>{filteredRows.length}</strong> test cases
                      </Typography>

                      <Stack direction="row" spacing={2} alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="caption" color="#64748b">
                            Rows per page:
                          </Typography>
                          <FormControl size="small">
                            <Select
                              value={pageSize}
                              onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setPage(1);
                              }}
                              sx={{ height: 32, fontSize: '0.8rem' }}
                            >
                              <MenuItem value={10}>10</MenuItem>
                              <MenuItem value={25}>25</MenuItem>
                              <MenuItem value={50}>50</MenuItem>
                            </Select>
                          </FormControl>
                        </Stack>

                        <Pagination
                          count={totalPages}
                          page={page}
                          onChange={(_, val) => {
                            setPage(val);
                            window.scrollTo({ top: 180, behavior: 'smooth' });
                          }}
                          color="primary"
                          shape="rounded"
                          size="small"
                        />
                      </Stack>
                    </Stack>
                  </Box>
                ) : (
                  /* Table View */
                  <InspectionTableView
                    rows={filteredRows}
                    onRowClick={handleOpenRowModal}
                  />
                )}
              </>
            )}
          </>
        )
      )}

      {/* Row Detail Fullscreen Modal */}
      <InspectionDetailModal
        open={Boolean(selectedModalRow)}
        onClose={() => setSelectedModalRow(null)}
        currentRow={selectedModalRow}
        currentIndex={modalIndex}
        totalCount={filteredRows.length}
        onNavigate={handleModalNavigate}
      />

      {/* Global Cross-Lingual Benchmark Summary Modal */}
      <CrossLingualSummaryModal
        open={crossLingualModalOpen}
        onClose={() => setCrossLingualModalOpen(false)}
        summary={consensusSummary}
      />
    </Box>
  );
}
