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
} from '@fortawesome/free-solid-svg-icons';

import { useEvaluationWorkspace } from '../../hooks/useEvaluationWorkspace';
import { InspectionWorkspaceSelector } from './components/InspectionWorkspaceSelector';
import { InspectionStatsBar } from './components/InspectionStatsBar';
import { SideBySideInspectionCard } from './components/SideBySideInspectionCard';
import { InspectionTableView } from './components/InspectionTableView';
import { InspectionDetailModal } from './components/InspectionDetailModal';

export default function EvaluationInspectorPage() {
  const {
    logsDirHandle,
    evaluationsDirHandle,
    availableFiles,
    selectedFile,
    setSelectedFile,
    loading,
    error,
    selectProjectRoot,
    selectLogsDirectory,
    selectEvaluationsDirectory,
    loadEvaluationFile,
  } = useEvaluationWorkspace();

  const [rows, setRows] = useState([]);
  const [fileStats, setFileStats] = useState(null);

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
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
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
              Side-by-side inspection of adversarial inputs, model completions, and multi-evaluator verdicts.
            </Typography>
          </Box>
        </Stack>
      </Stack>

      {/* Workspace Directory & File Selector */}
      <InspectionWorkspaceSelector
        logsDirHandle={logsDirHandle}
        evaluationsDirHandle={evaluationsDirHandle}
        availableFiles={availableFiles}
        selectedFile={selectedFile}
        onFileSelect={setSelectedFile}
        onSelectProjectRoot={selectProjectRoot}
        onSelectLogsDir={selectLogsDirectory}
        onSelectEvaluationsDir={selectEvaluationsDirectory}
        onRefresh={() => setSelectedFile((prev) => prev)}
        loading={loading}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
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

      {/* Loading State */}
      {loading && (
        <Box py={8} textAlign="center">
          <CircularProgress size={36} sx={{ color: '#2563eb', mb: 2 }} />
          <Typography variant="body2" color="#64748b" fontWeight={500}>
            Loading and pairing generation logs with evaluator sidecars...
          </Typography>
        </Box>
      )}

      {/* Main Content when file is loaded */}
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

      {/* Row Detail Fullscreen Modal */}
      <InspectionDetailModal
        open={Boolean(selectedModalRow)}
        onClose={() => setSelectedModalRow(null)}
        currentRow={selectedModalRow}
        currentIndex={modalIndex}
        totalCount={filteredRows.length}
        onNavigate={handleModalNavigate}
      />
    </Box>
  );
}
