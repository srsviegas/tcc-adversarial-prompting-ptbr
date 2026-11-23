import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Stack,
  Typography,
  Chip,
  Button,
  FormControl,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  LinearProgress,
  Pagination,
  Paper,
  Tooltip,
  Divider,
  Card,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCodeCompare,
  faMagnifyingGlass,
  faXmark,
  faRotateRight,
  faTable,
  faTableColumns,
  faTriangleExclamation,
  faShieldHalved,
  faScaleUnbalanced,
  faClock,
  faExpand,
  faCircleCheck,
} from '@fortawesome/free-solid-svg-icons';
import {
  groupFilesByMethod,
  buildMethodComparisonRows,
  computeRowCrossModelSummary,
  computeComparisonStats,
} from '../utils/modelComparisonUtils';
import { RowModelComparisonModal } from './RowModelComparisonModal';

function ModelCellBadge({ row }) {
  if (!row) {
    return (
      <Chip
        label="— Missing"
        size="small"
        sx={{ height: 20, fontSize: '0.68rem', bgcolor: '#f8fafc', color: '#94a3b8', border: '1px dashed #cbd5e1' }}
      />
    );
  }

  const cons = row.evaluations?.consensus || {};
  if (!cons.has_quorum) {
    return (
      <Chip
        icon={<FontAwesomeIcon icon={faClock} style={{ fontSize: '0.65rem', color: '#64748b' }} />}
        label={`Pending (${cons.total_voted || 0}/2)`}
        size="small"
        sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569' }}
      />
    );
  }
  if (cons.consensus_dangerous === true) {
    return (
      <Chip
        icon={<FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: '0.65rem', color: '#dc2626' }} />}
        label={`Dangerous (${cons.votes_dangerous}/${cons.total_voted})`}
        size="small"
        sx={{ height: 20, fontSize: '0.68rem', fontWeight: 800, bgcolor: '#fee2e2', color: '#991b1b' }}
      />
    );
  }
  if (cons.consensus_dangerous === false) {
    const isSplit = cons.is_disagreement;
    return (
      <Chip
        icon={
          <FontAwesomeIcon
            icon={isSplit ? faScaleUnbalanced : faCircleCheck}
            style={{ fontSize: '0.65rem', color: isSplit ? '#d97706' : '#16a34a' }}
          />
        }
        label={isSplit ? `Safe · Split (${cons.votes_safe}/${cons.total_voted})` : `Safe (${cons.votes_safe}/${cons.total_voted})`}
        size="small"
        sx={{
          height: 20,
          fontSize: '0.68rem',
          fontWeight: 800,
          bgcolor: isSplit ? '#fef3c7' : '#dcfce7',
          color: isSplit ? '#92400e' : '#166534',
        }}
      />
    );
  }
  return <Chip label="No Eval" size="small" sx={{ height: 20, fontSize: '0.68rem' }} />;
}

function MiniJudgePills({ evaluations = {} }) {
  const { llamaguard = {}, qwen_judge = {}, gemma_judge = {} } = evaluations;

  const llamaText = llamaguard.status === 'missing'
    ? '—'
    : llamaguard.status === 'error'
      ? 'Err'
      : llamaguard.flagged
        ? 'Unsafe'
        : 'Safe';
  const llamaColor = llamaguard.status === 'missing'
    ? '#94a3b8'
    : llamaguard.flagged
      ? '#b91c1c'
      : '#15803d';

  const formatScore = (ev) => {
    if (ev.status === 'missing' || ev.score === null || ev.score === undefined) return { text: '—', color: '#94a3b8' };
    const color = ev.score >= 4 ? '#b91c1c' : ev.score === 3 ? '#b45309' : '#15803d';
    return { text: `${ev.score}/5`, color };
  };

  const qwenFmt = formatScore(qwen_judge);
  const gemmaFmt = formatScore(gemma_judge);

  return (
    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" sx={{ fontSize: '0.675rem', color: '#64748b' }}>
      <span>
        L: <strong style={{ color: llamaColor }}>{llamaText}</strong>
      </span>
      <span style={{ color: '#cbd5e1' }}>·</span>
      <span>
        Q: <strong style={{ color: qwenFmt.color }}>{qwenFmt.text}</strong>
      </span>
      <span style={{ color: '#cbd5e1' }}>·</span>
      <span>
        G: <strong style={{ color: gemmaFmt.color }}>{gemmaFmt.text}</strong>
      </span>
    </Stack>
  );
}

export function ModelComparisonView({
  availableFiles = [],
  selectedMethodId,
  onSelectMethodId,
  loadEvaluationFilesBatch,
}) {
  const { methods, modelsByMethod } = useMemo(
    () => groupFilesByMethod(availableFiles),
    [availableFiles]
  );

  // Cache loaded method comparison data to avoid re-reading files when switching back
  const cacheRef = useRef(new Map());

  // Clear cache whenever availableFiles list changes (e.g. directory changed or refreshed)
  useEffect(() => {
    cacheRef.current.clear();
  }, [availableFiles]);

  // Ensure a valid method is selected
  useEffect(() => {
    if (methods.length === 0) return;
    if (!selectedMethodId || !modelsByMethod.has(selectedMethodId)) {
      // Prefer a method that has 2+ models if available
      const multiModelMethod = methods.find((m) => (modelsByMethod.get(m.id)?.length || 0) >= 2);
      onSelectMethodId((multiModelMethod || methods[0]).id);
    }
  }, [methods, modelsByMethod, selectedMethodId, onSelectMethodId]);

  const methodMeta = useMemo(
    () => methods.find((m) => m.id === selectedMethodId) || null,
    [methods, selectedMethodId]
  );

  const methodModelEntries = useMemo(
    () => (selectedMethodId ? modelsByMethod.get(selectedMethodId) || [] : []),
    [modelsByMethod, selectedMethodId]
  );

  // Selected models for comparison (all models in method enabled by default)
  const [enabledModelIds, setEnabledModelIds] = useState([]);
  useEffect(() => {
    setEnabledModelIds(methodModelEntries.map((entry) => entry.model.id));
  }, [methodModelEntries]);

  const activeModels = useMemo(
    () => methodModelEntries.filter((e) => enabledModelIds.includes(e.model.id)).map((e) => e.model),
    [methodModelEntries, enabledModelIds]
  );

  // Loaded data state for current method
  const [comparisonRows, setComparisonRows] = useState([]);
  const [availableStyles, setAvailableStyles] = useState([]);
  const [availableIterations, setAvailableIterations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [reloadNonce, setReloadNonce] = useState(0);

  // Filters
  const [filterLang, setFilterLang] = useState('all');
  const [filterStyle, setFilterStyle] = useState('all');
  const [filterIter, setFilterIter] = useState('all');
  const [filterOutcome, setFilterOutcome] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [displayMode, setDisplayMode] = useState('table'); // 'table' | 'cards'

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal state
  const [modalRowIndex, setModalRowIndex] = useState(null);

  // Load all model files for selectedMethodId
  useEffect(() => {
    if (!selectedMethodId || methodModelEntries.length === 0) {
      setComparisonRows([]);
      setAvailableStyles([]);
      setAvailableIterations([]);
      return;
    }

    let isCancelled = false;

    const loadMethod = async () => {
      const cacheKey = selectedMethodId;
      if (cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey);
        setComparisonRows(cached.comparisonRows);
        setAvailableStyles(cached.availableStyles);
        setAvailableIterations(cached.availableIterations);
        setFilterStyle('all');
        setFilterIter('all');
        setPage(1);
        return;
      }

      setLoading(true);
      setProgress({ loaded: 0, total: methodModelEntries.length });

      const fileNames = methodModelEntries.map((e) => e.fileName);
      const batchMap = await loadEvaluationFilesBatch(fileNames, (prog) => {
        if (!isCancelled) setProgress(prog);
      });

      if (isCancelled) return;

      const modelDatasets = methodModelEntries.map((entry) => ({
        model: entry.model,
        fileName: entry.fileName,
        rows: batchMap[entry.fileName]?.rows || [],
      }));

      const built = buildMethodComparisonRows(modelDatasets);
      cacheRef.current.set(cacheKey, built);

      setComparisonRows(built.comparisonRows);
      setAvailableStyles(built.availableStyles);
      setAvailableIterations(built.availableIterations);
      setFilterStyle('all');
      setFilterIter('all');
      setPage(1);
      setLoading(false);
    };

    loadMethod();

    return () => {
      isCancelled = true;
    };
  }, [selectedMethodId, methodModelEntries, loadEvaluationFilesBatch, reloadNonce]);

  const handleForceReload = () => {
    if (selectedMethodId) {
      cacheRef.current.delete(selectedMethodId);
      setReloadNonce((n) => n + 1);
    }
  };

  const toggleModel = (modelId) => {
    setEnabledModelIds((prev) => {
      if (prev.includes(modelId)) {
        // Always keep at least 1 model active
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== modelId);
      }
      return [...prev, modelId];
    });
  };

  // Pre-outcome filtered rows (by lang, style, iter, search) so outcome filter counts stay accurate
  const baseFilteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const numericQuery = q.replace(/^#/, '');

    return comparisonRows.filter((compRow) => {
      if (filterLang !== 'all' && compRow.prompt_language.toLowerCase() !== filterLang.toLowerCase()) {
        return false;
      }
      if (filterStyle !== 'all' && compRow.attack_style !== filterStyle) {
        return false;
      }
      if (filterIter !== 'all' && compRow.iteration !== Number(filterIter)) {
        return false;
      }
      if (q) {
        const matchesRowNum = String(compRow.original_row_index) === numericQuery;
        const matchesPrompt = (compRow.prompt || '').toLowerCase().includes(q);
        let matchesResponse = false;
        if (!matchesRowNum && !matchesPrompt) {
          for (const m of activeModels) {
            const resp = (compRow.models[m.id]?.output?.extracted_text || '').toLowerCase();
            if (resp.includes(q)) {
              matchesResponse = true;
              break;
            }
          }
        }
        if (!matchesRowNum && !matchesPrompt && !matchesResponse) return false;
      }
      return true;
    });
  }, [comparisonRows, filterLang, filterStyle, filterIter, searchTerm, activeModels]);

  // Compute stats over baseFilteredRows (for filter badge counts)
  const baseStats = useMemo(
    () => computeComparisonStats(baseFilteredRows, activeModels),
    [baseFilteredRows, activeModels]
  );

  // Final filtered rows including outcome filter
  const filteredRows = useMemo(() => {
    const activeIds = activeModels.map((m) => m.id);
    if (filterOutcome === 'all') return baseFilteredRows;

    return baseFilteredRows.filter((compRow) => {
      const summary = computeRowCrossModelSummary(compRow, activeIds);
      if (filterOutcome === 'divergent') return summary.hasDivergence;
      if (filterOutcome === 'any_dangerous') return summary.dangerousCount > 0;
      if (filterOutcome === 'all_dangerous') return summary.allDangerous;
      if (filterOutcome === 'all_safe') return summary.allSafe;
      return true;
    });
  }, [baseFilteredRows, filterOutcome, activeModels]);

  // Stats over final filtered rows (for per-model ASR chips)
  const displayedStats = useMemo(
    () => computeComparisonStats(filteredRows, activeModels),
    [filteredRows, activeModels]
  );

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterLang, filterStyle, filterIter, filterOutcome, searchTerm, selectedMethodId]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const handleOpenRowModal = (compRow) => {
    const idx = filteredRows.findIndex((r) => r.key === compRow.key);
    setModalRowIndex(idx >= 0 ? idx : 0);
  };

  const handleModalNavigate = (newIdx) => {
    if (newIdx >= 0 && newIdx < filteredRows.length) {
      setModalRowIndex(newIdx);
    }
  };

  if (methods.length === 0) {
    return (
      <Card sx={{ p: 5, textAlign: 'center', bgcolor: '#ffffff', borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Typography variant="h6" fontWeight={700} color="#0f172a" gutterBottom>
          No Adversarial Methods Found
        </Typography>
        <Typography variant="body2" color="#64748b">
          Connect a workspace with benchmark logs or evaluation files to compare models row-by-row.
        </Typography>
      </Card>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Top Control Card: Method Picker + Active Model Toggles */}
      <Box
        sx={{
          bgcolor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 2.5,
          p: 2.5,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <Stack spacing={2}>
          {/* Row 1: Method Selector & Refresh */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <FontAwesomeIcon icon={faCodeCompare} style={{ color: '#2563eb', fontSize: '0.95rem' }} />
                <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                  Adversarial Method:
                </Typography>
              </Stack>

              <FormControl size="small" sx={{ minWidth: 280 }}>
                <Select
                  value={selectedMethodId || ''}
                  onChange={(e) => onSelectMethodId(e.target.value)}
                  disabled={loading}
                  sx={{ height: 38, fontSize: '0.85rem', fontWeight: 700, bgcolor: '#f8fafc' }}
                >
                  {methods.map((m) => {
                    const count = modelsByMethod.get(m.id)?.length || 0;
                    return (
                      <MenuItem key={m.id} value={m.id}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" width="100%" spacing={2}>
                          <Box>
                            <Typography variant="body2" fontWeight={700} color="#0f172a">
                              {m.label}
                            </Typography>
                          </Box>
                          <Chip
                            label={`${count} model${count !== 1 ? 's' : ''}`}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              bgcolor: count >= 2 ? '#dbeafe' : '#f1f5f9',
                              color: count >= 2 ? '#1e40af' : '#64748b',
                            }}
                          />
                        </Stack>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center">
              <ToggleButtonGroup
                value={displayMode}
                exclusive
                onChange={(_, val) => val && setDisplayMode(val)}
                size="small"
                sx={{
                  height: 36,
                  '& .MuiToggleButton-root': {
                    px: 1.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    color: '#475569',
                    '&.Mui-selected': { bgcolor: '#eff6ff', color: '#2563eb' },
                  },
                }}
              >
                <ToggleButton value="table">
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <FontAwesomeIcon icon={faTable} />
                    <span>Row Table</span>
                  </Stack>
                </ToggleButton>
                <ToggleButton value="cards">
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <FontAwesomeIcon icon={faTableColumns} />
                    <span>Side-by-Side Cards</span>
                  </Stack>
                </ToggleButton>
              </ToggleButtonGroup>

              <Button
                variant="outlined"
                size="small"
                onClick={handleForceReload}
                disabled={loading}
                startIcon={<FontAwesomeIcon icon={faRotateRight} spin={loading} />}
                sx={{ height: 36, fontSize: '0.8rem', fontWeight: 600, borderColor: '#cbd5e1', color: '#475569' }}
              >
                Reload
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ borderColor: '#f1f5f9' }} />

          {/* Row 2: Model Toggles + Per-Model ASR for current slice */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} flexWrap="wrap">
            <Typography variant="caption" fontWeight={700} color="#475569" textTransform="uppercase">
              Models ({activeModels.length}/{methodModelEntries.length}):
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {methodModelEntries.map(({ model }) => {
                const isActive = enabledModelIds.includes(model.id);
                const pm = displayedStats.perModel[model.id];
                const asrSuffix = isActive && pm && pm.asr !== null ? ` · ${pm.asr}% ASR` : '';
                return (
                  <Chip
                    key={model.id}
                    label={`${model.shortLabel}${asrSuffix}`}
                    clickable
                    onClick={() => toggleModel(model.id)}
                    size="small"
                    sx={{
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.75rem',
                      bgcolor: isActive ? '#0f172a' : '#f8fafc',
                      color: isActive ? '#ffffff' : '#64748b',
                      border: isActive ? '1px solid #0f172a' : '1px solid #cbd5e1',
                      '&:hover': {
                        bgcolor: isActive ? '#1e293b' : '#f1f5f9',
                      },
                    }}
                  />
                );
              })}
            </Stack>
          </Stack>
        </Stack>
      </Box>

      {/* Loading Banner */}
      {loading && (
        <Box sx={{ bgcolor: '#ffffff', p: 3, borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <CircularProgress size={22} thickness={5} sx={{ color: '#2563eb' }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" color="#0f172a" fontWeight={700}>
                Loading and aligning models for {methodMeta?.label || selectedMethodId} ({progress.loaded} / {progress.total} models)...
              </Typography>
              <LinearProgress
                variant="determinate"
                value={progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0}
                sx={{ height: 6, borderRadius: 3, bgcolor: '#e2e8f0', mt: 1, '& .MuiLinearProgress-bar': { bgcolor: '#2563eb' } }}
              />
            </Box>
          </Stack>
        </Box>
      )}

      {/* Filter & Summary Bar */}
      {!loading && (
        <Box
          sx={{
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 2.5,
            p: 2.25,
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <Stack spacing={2}>
            {/* Outcome & Language Filters */}
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ lg: 'center' }} justifyContent="space-between">
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                <Chip
                  label={`All Interactions (${baseStats.totalRows})`}
                  clickable
                  color={filterOutcome === 'all' ? 'primary' : 'default'}
                  variant={filterOutcome === 'all' ? 'filled' : 'outlined'}
                  onClick={() => setFilterOutcome('all')}
                  sx={{ fontWeight: 700, fontSize: '0.78rem' }}
                />
                <Chip
                  icon={<FontAwesomeIcon icon={faScaleUnbalanced} style={{ fontSize: '0.72rem', color: '#d97706' }} />}
                  label={`Divergent Models (${baseStats.divergentCount})`}
                  clickable
                  onClick={() => setFilterOutcome('divergent')}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    bgcolor: filterOutcome === 'divergent' ? '#fef3c7' : '#ffffff',
                    color: '#92400e',
                    border: '1px solid #fcd34d',
                  }}
                />
                <Chip
                  icon={<FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: '0.72rem', color: '#dc2626' }} />}
                  label={`Any Dangerous (${baseStats.anyDangerousCount})`}
                  clickable
                  onClick={() => setFilterOutcome('any_dangerous')}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    bgcolor: filterOutcome === 'any_dangerous' ? '#fee2e2' : '#ffffff',
                    color: '#991b1b',
                    border: '1px solid #fca5a5',
                  }}
                />
                <Chip
                  label={`All Dangerous (${baseStats.allDangerousCount})`}
                  clickable
                  onClick={() => setFilterOutcome('all_dangerous')}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    bgcolor: filterOutcome === 'all_dangerous' ? '#fecaca' : '#ffffff',
                    color: '#7f1d1d',
                    border: '1px solid #f87171',
                  }}
                />
                <Chip
                  icon={<FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: '0.72rem', color: '#16a34a' }} />}
                  label={`All Safe (${baseStats.allSafeCount})`}
                  clickable
                  onClick={() => setFilterOutcome('all_safe')}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    bgcolor: filterOutcome === 'all_safe' ? '#dcfce7' : '#ffffff',
                    color: '#166534',
                    border: '1px solid #86efac',
                  }}
                />
              </Stack>

              {/* Search Input */}
              <TextField
                size="small"
                placeholder="Search row #, prompt, or model response..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{
                  minWidth: 260,
                  maxWidth: 360,
                  '& .MuiOutlinedInput-root': { height: 36, fontSize: '0.825rem' },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <FontAwesomeIcon icon={faMagnifyingGlass} style={{ color: '#94a3b8', fontSize: '0.78rem' }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchTerm('')}>
                        <FontAwesomeIcon icon={faXmark} style={{ fontSize: '0.75rem' }} />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </Stack>

            {/* Secondary Filters: Language (PT-BR vs EN), Style, Iteration */}
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <ToggleButtonGroup
                value={filterLang}
                exclusive
                onChange={(_, val) => val && setFilterLang(val)}
                size="small"
                sx={{
                  height: 30,
                  '& .MuiToggleButton-root': { px: 1.25, py: 0, fontSize: '0.75rem', fontWeight: 700 },
                }}
              >
                <ToggleButton value="all">Lang: All</ToggleButton>
                <ToggleButton value="pt-BR">PT-BR</ToggleButton>
                <ToggleButton value="en">EN</ToggleButton>
              </ToggleButtonGroup>

              {availableStyles.length > 1 && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <Select
                    value={filterStyle}
                    onChange={(e) => setFilterStyle(e.target.value)}
                    sx={{ height: 30, fontSize: '0.75rem', fontWeight: 600, bgcolor: '#f8fafc' }}
                  >
                    <MenuItem value="all">Style: All ({availableStyles.length})</MenuItem>
                    {availableStyles.map((st) => (
                      <MenuItem key={st} value={st}>
                        Style: {st}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {availableIterations.length > 1 && (
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <Select
                    value={filterIter}
                    onChange={(e) => setFilterIter(e.target.value)}
                    sx={{ height: 30, fontSize: '0.75rem', fontWeight: 600, bgcolor: '#f8fafc' }}
                  >
                    <MenuItem value="all">Iter: All ({availableIterations.length})</MenuItem>
                    {availableIterations.map((it) => (
                      <MenuItem key={it} value={String(it)}>
                        Iteration {it}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <Typography variant="caption" color="#64748b" fontWeight={600} sx={{ ml: 'auto !important' }}>
                Each row is a single interaction (strictly PT-BR or EN) · Showing <strong>{filteredRows.length}</strong> of{' '}
                {comparisonRows.length}
              </Typography>
            </Stack>
          </Stack>
        </Box>
      )}

      {/* Main Comparison Content */}
      {!loading && filteredRows.length === 0 && (
        <Card sx={{ p: 4, textAlign: 'center', bgcolor: '#ffffff', borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
          <Typography variant="subtitle1" fontWeight={700} color="#475569" gutterBottom>
            No interactions matched your filter criteria
          </Typography>
          <Typography variant="body2" color="#94a3b8">
            Try resetting your outcome, language, style, or search filters.
          </Typography>
        </Card>
      )}

      {!loading && filteredRows.length > 0 && displayMode === 'table' && (
        <Box
          sx={{
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 2.5,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <Box sx={{ overflowX: 'auto' }}>
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                minWidth: Math.max(880, 320 + activeModels.length * 220),
              }}
            >
              <Box component="thead">
                <Box component="tr" sx={{ bgcolor: '#f8fafc' }}>
                  <Box
                    component="th"
                    sx={{
                      p: 1.75,
                      width: 310,
                      minWidth: 280,
                      textAlign: 'left',
                      borderBottom: '1px solid #e2e8f0',
                      borderRight: '1px solid #e2e8f0',
                      fontWeight: 700,
                      fontSize: '0.73rem',
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Interaction (Row · Lang · Prompt)
                  </Box>
                  {activeModels.map((model) => {
                    const pm = displayedStats.perModel[model.id];
                    return (
                      <Box
                        component="th"
                        key={model.id}
                        sx={{
                          p: 1.75,
                          textAlign: 'left',
                          borderBottom: '1px solid #e2e8f0',
                          borderRight: '1px solid #f1f5f9',
                          minWidth: 210,
                        }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                          <Tooltip title={model.label} arrow placement="top">
                            <Typography variant="caption" fontWeight={800} color="#0f172a" fontSize="0.78rem" noWrap>
                              {model.shortLabel}
                            </Typography>
                          </Tooltip>
                          {pm && pm.asr !== null && (
                            <Chip
                              label={`${pm.asr}% ASR`}
                              size="small"
                              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#f1f5f9', color: '#334155' }}
                            />
                          )}
                        </Stack>
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              <Box component="tbody">
                {paginatedRows.map((compRow) => {
                  const activeIds = activeModels.map((m) => m.id);
                  const summary = computeRowCrossModelSummary(compRow, activeIds);

                  return (
                    <Box
                      component="tr"
                      key={compRow.key}
                      onClick={() => handleOpenRowModal(compRow)}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: summary.hasDivergence ? '#fffdf5' : '#ffffff',
                        transition: 'background-color 0.12s ease',
                        '&:hover': { bgcolor: '#f1f5f9' },
                      }}
                    >
                      {/* Interaction Column */}
                      <Box
                        component="td"
                        sx={{
                          p: 1.5,
                          borderBottom: '1px solid #e2e8f0',
                          borderRight: '1px solid #e2e8f0',
                          verticalAlign: 'top',
                        }}
                      >
                        <Stack spacing={0.75}>
                          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" gap={0.5}>
                            <Chip
                              label={`Row ${compRow.original_row_index}`}
                              size="small"
                              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 800, bgcolor: '#0f172a', color: '#ffffff' }}
                            />
                            <Chip
                              label={compRow.prompt_language.toUpperCase()}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                bgcolor: compRow.prompt_language === 'en' ? '#e0f2fe' : '#fef3c7',
                                color: compRow.prompt_language === 'en' ? '#0369a1' : '#92400e',
                              }}
                            />
                            <Chip
                              label={compRow.attack_style}
                              size="small"
                              sx={{ height: 20, fontSize: '0.66rem', fontWeight: 600, bgcolor: '#f1f5f9', color: '#334155' }}
                            />
                            {availableIterations.length > 1 && (
                              <Chip
                                label={`#${compRow.iteration}`}
                                size="small"
                                sx={{ height: 20, fontSize: '0.66rem', fontWeight: 600, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}
                              />
                            )}
                            {summary.hasDivergence && (
                              <Tooltip title="Models disagreed on this interaction (some Dangerous, some Safe)">
                                <Chip
                                  label="Split"
                                  size="small"
                                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800, bgcolor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}
                                />
                              </Tooltip>
                            )}
                          </Stack>

                          <Typography
                            variant="caption"
                            color="#334155"
                            sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.4,
                              fontSize: '0.76rem',
                            }}
                          >
                            {compRow.prompt || '<Prompt unavailable>'}
                          </Typography>
                        </Stack>
                      </Box>

                      {/* Per-Model Cells */}
                      {activeModels.map((model) => {
                        const row = compRow.models[model.id];
                        const responseText = row?.output?.extracted_text || '';
                        const isFailed = row?.error_log?.failed;

                        return (
                          <Box
                            component="td"
                            key={model.id}
                            sx={{
                              p: 1.5,
                              borderBottom: '1px solid #e2e8f0',
                              borderRight: '1px solid #f1f5f9',
                              verticalAlign: 'top',
                            }}
                          >
                            <Stack spacing={0.75}>
                              <ModelCellBadge row={row} />
                              {row && <MiniJudgePills evaluations={row.evaluations} />}
                              {row && (
                                <Typography
                                  variant="caption"
                                  color={responseText ? '#0f172a' : '#94a3b8'}
                                  sx={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    lineHeight: 1.4,
                                    fontSize: '0.74rem',
                                    fontStyle: responseText ? 'normal' : 'italic',
                                  }}
                                >
                                  {responseText || (isFailed ? `Failed: ${row.error_log.error_message}` : '<Empty response>')}
                                </Typography>
                              )}
                            </Stack>
                          </Box>
                        );
                      })}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* Side-by-Side Cards View */}
      {!loading && filteredRows.length > 0 && displayMode === 'cards' && (
        <Stack spacing={2.5}>
          {paginatedRows.map((compRow) => {
            const activeIds = activeModels.map((m) => m.id);
            const summary = computeRowCrossModelSummary(compRow, activeIds);

            return (
              <Paper
                key={compRow.key}
                elevation={0}
                sx={{
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: summary.hasDivergence ? '#fcd34d' : '#e2e8f0',
                  overflow: 'hidden',
                  bgcolor: '#ffffff',
                }}
              >
                {/* Card Header */}
                <Box
                  sx={{
                    px: 2.5,
                    py: 1.5,
                    bgcolor: summary.hasDivergence ? '#fffbeb' : '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Chip
                        label={`Row ${compRow.original_row_index}`}
                        size="small"
                        sx={{ height: 22, fontSize: '0.72rem', fontWeight: 800, bgcolor: '#0f172a', color: '#ffffff' }}
                      />
                      <Chip
                        label={compRow.prompt_language.toUpperCase()}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          bgcolor: compRow.prompt_language === 'en' ? '#e0f2fe' : '#fef3c7',
                          color: compRow.prompt_language === 'en' ? '#0369a1' : '#92400e',
                        }}
                      />
                      <Chip
                        label={`Style: ${compRow.attack_style}`}
                        size="small"
                        sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600, bgcolor: '#ffffff', border: '1px solid #cbd5e1' }}
                      />
                      {availableIterations.length > 1 && (
                        <Chip
                          label={`Iter ${compRow.iteration}`}
                          size="small"
                          sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600, bgcolor: '#ffffff', border: '1px solid #cbd5e1' }}
                        />
                      )}
                      {summary.hasDivergence && (
                        <Chip
                          label={`Divergent (${summary.dangerousCount} Dang / ${summary.safeCount} Safe)`}
                          size="small"
                          sx={{ height: 22, fontSize: '0.72rem', fontWeight: 800, bgcolor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}
                        />
                      )}
                    </Stack>

                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleOpenRowModal(compRow)}
                      startIcon={<FontAwesomeIcon icon={faExpand} style={{ fontSize: '0.7rem' }} />}
                      sx={{
                        height: 26,
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        textTransform: 'none',
                        color: '#2563eb',
                        borderColor: '#bfdbfe',
                        bgcolor: '#ffffff',
                        '&:hover': { bgcolor: '#eff6ff', borderColor: '#93c5fd' },
                      }}
                    >
                      Deep Compare
                    </Button>
                  </Stack>
                </Box>

                <Box sx={{ p: 2.5 }}>
                  {/* Shared Prompt */}
                  <Box sx={{ p: 1.75, mb: 2, bgcolor: '#fafaf9', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" fontWeight={700} color="#64748b" textTransform="uppercase" display="block" mb={0.5}>
                      Adversarial Input Prompt ({compRow.prompt_language.toUpperCase()})
                    </Typography>
                    <Typography
                      variant="body2"
                      color="#1e293b"
                      sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 150, overflowY: 'auto', lineHeight: 1.55 }}
                    >
                      {compRow.prompt || '<Prompt unavailable>'}
                    </Typography>
                  </Box>

                  {/* Horizontal Model Grid */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        md: `repeat(${Math.min(Math.max(activeModels.length, 1), 2)}, minmax(0, 1fr))`,
                        xl: `repeat(${Math.min(Math.max(activeModels.length, 1), 3)}, minmax(0, 1fr))`,
                      },
                      gap: 1.75,
                    }}
                  >
                    {activeModels.map((model) => {
                      const row = compRow.models[model.id];
                      const cons = row?.evaluations?.consensus || {};
                      const isDang = cons.consensus_dangerous === true;
                      const isSafe = cons.consensus_dangerous === false;

                      return (
                        <Box
                          key={model.id}
                          sx={{
                            p: 1.75,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: !row ? '#e2e8f0' : isDang ? '#fca5a5' : isSafe ? '#bbf7d0' : '#cbd5e1',
                            bgcolor: !row ? '#fafafa' : '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                          }}
                        >
                          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                            <Typography variant="subtitle2" fontWeight={800} color="#0f172a" fontSize="0.825rem" noWrap>
                              {model.shortLabel}
                            </Typography>
                            <ModelCellBadge row={row} />
                          </Stack>

                          {row ? (
                            <>
                              <MiniJudgePills evaluations={row.evaluations} />
                              <Box
                                sx={{
                                  p: 1.25,
                                  bgcolor: '#f8fafc',
                                  borderRadius: 1.5,
                                  border: '1px solid #f1f5f9',
                                  maxHeight: 190,
                                  overflowY: 'auto',
                                  flex: 1,
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  color="#0f172a"
                                  sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.8rem', lineHeight: 1.5 }}
                                >
                                  {row.output?.extracted_text || (
                                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                      {row.error_log?.failed ? `Failed: ${row.error_log.error_message}` : '<Empty response>'}
                                    </span>
                                  )}
                                </Typography>
                              </Box>
                            </>
                          ) : (
                            <Typography variant="caption" color="#94a3b8" sx={{ py: 2, textAlign: 'center' }}>
                              No record for this interaction
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* Pagination Bar */}
      {!loading && filteredRows.length > 0 && (
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
          }}
        >
          <Typography variant="body2" color="#64748b">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredRows.length)} of{' '}
            <strong>{filteredRows.length}</strong> interactions
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
      )}

      {/* Fullscreen Row Comparison Modal */}
      <RowModelComparisonModal
        open={modalRowIndex !== null}
        onClose={() => setModalRowIndex(null)}
        compRow={modalRowIndex !== null ? filteredRows[modalRowIndex] : null}
        activeModels={activeModels}
        methodMeta={methodMeta}
        currentIndex={modalRowIndex ?? 0}
        totalCount={filteredRows.length}
        onNavigate={handleModalNavigate}
      />
    </Stack>
  );
}
