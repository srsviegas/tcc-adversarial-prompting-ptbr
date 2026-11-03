import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Stack,
  Typography,
  Chip,
  Tooltip,
  CircularProgress,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Divider,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLayerGroup,
  faScaleBalanced,
  faBullseye,
  faCheckCircle,
  faFilter,
  faRotateRight,
  faSearch,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons';

import {
  STANDARD_METHODS,
  STANDARD_MODELS,
  METHOD_CATEGORIES,
  parseLogFilename,
  getMethodMeta,
  getModelMeta,
  getAsrColor,
  getCompletionColor,
  computeSuiteMatrixKPIs,
} from '../utils/evaluationMatrixUtils';

export function EvaluationMatrixOverview({
  availableFiles = [],
  matrixStats = {},
  loading = false,
  progress = { loaded: 0, total: 0 },
  onLoadMatrixData,
  onInspectFile,
}) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMetric, setSelectedMetric] = useState('consensus_asr');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCellData, setSelectedCellData] = useState(null);

  // Trigger loading matrix stats if not already loaded
  useEffect(() => {
    if (onLoadMatrixData && availableFiles.length > 0 && Object.keys(matrixStats).length === 0) {
      onLoadMatrixData(false);
    }
  }, [availableFiles, matrixStats, onLoadMatrixData]);

  // Map available files by methodKey and modelKey
  const fileKeyMapping = useMemo(() => {
    const map = new Map();
    availableFiles.forEach((fileInfo) => {
      const fileName = fileInfo.name;
      const parsed = parseLogFilename(fileName);
      if (parsed) {
        const key = `${parsed.methodKey}__${parsed.modelKey}`;
        map.set(key, { fileName, ...parsed });
      }
    });
    return map;
  }, [availableFiles]);

  // Compute distinct methods across catalog + discovered files
  const allMethods = useMemo(() => {
    const methodKeys = new Set(STANDARD_METHODS.map((m) => m.id));
    fileKeyMapping.forEach((info) => {
      methodKeys.add(info.methodKey);
    });

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
  }, [fileKeyMapping]);

  // Models across catalog + discovered files
  const allModels = useMemo(() => {
    const modelKeys = new Set(STANDARD_MODELS.map((m) => m.id));
    fileKeyMapping.forEach((info) => {
      modelKeys.add(info.modelKey);
    });

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
  }, [fileKeyMapping]);

  // Filter methods by category and search
  const displayedMethods = useMemo(() => {
    return allMethods.filter((m) => {
      if (selectedCategory !== 'all' && m.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = m.label.toLowerCase().includes(q) || m.shortLabel.toLowerCase().includes(q);
        if (!matchName) return false;
      }
      return true;
    });
  }, [allMethods, selectedCategory, searchQuery]);

  // Compute suite-wide KPIs
  const kpis = useMemo(() => {
    return computeSuiteMatrixKPIs(matrixStats, allMethods, allModels);
  }, [matrixStats, allMethods, allModels]);

  // Helper to extract the value for the selected metric from cell stats
  const getCellMetricValue = (stats) => {
    if (!stats) return { label: '—', value: null };
    switch (selectedMetric) {
      case 'llamaguard_asr':
        return {
          label: stats.evaluators?.llamaguard?.asr !== null ? `${stats.evaluators.llamaguard.asr}%` : '—',
          value: stats.evaluators?.llamaguard?.asr,
          sublabel: 'LlamaGuard',
        };
      case 'qwen_asr':
        return {
          label: stats.evaluators?.qwen_judge?.asr !== null ? `${stats.evaluators.qwen_judge.asr}%` : '—',
          value: stats.evaluators?.qwen_judge?.asr,
          sublabel: 'Qwen Judge',
        };
      case 'gemma_asr':
        return {
          label: stats.evaluators?.gemma_judge?.asr !== null ? `${stats.evaluators.gemma_judge.asr}%` : '—',
          value: stats.evaluators?.gemma_judge?.asr,
          sublabel: 'Gemma Judge',
        };
      case 'pt_asr':
        return {
          label: stats.languages?.pt?.asr !== null ? `${stats.languages.pt.asr}%` : '—',
          value: stats.languages?.pt?.asr,
          sublabel: 'pt-BR ASR',
        };
      case 'en_asr':
        return {
          label: stats.languages?.en?.asr !== null ? `${stats.languages.en.asr}%` : '—',
          value: stats.languages?.en?.asr,
          sublabel: 'en ASR',
        };
      case 'cross_lingual_gap':
        return {
          label: stats.languages?.gap !== null ? (stats.languages.gap >= 0 ? `+${stats.languages.gap}%` : `${stats.languages.gap}%`) : '—',
          value: stats.languages?.gap,
          sublabel: 'pt - en Gap',
        };
      case 'consensus_asr':
      default:
        return {
          label: stats.consensusAsr !== null ? `${stats.consensusAsr}%` : '—',
          value: stats.consensusAsr,
          sublabel: 'Consensus ASR',
        };
    }
  };

  return (
    <Stack spacing={3.5}>
      {/* Top Suite KPI Summary Cards */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
        {/* KPI 1: Evaluated Suite Runs */}
        <Box
          sx={{
            flex: 1,
            minWidth: 200,
            p: 2.25,
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 2.5,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: '#f1f5f9',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FontAwesomeIcon icon={faLayerGroup} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
                Suite Coverage
              </Typography>
              <Typography variant="h6" fontWeight={800} color="#0f172a" lineHeight={1.1}>
                {kpis.totalEvaluatedRuns} / {kpis.totalSlots}
              </Typography>
            </Box>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {kpis.totalSlots > 0 ? Math.round((kpis.totalEvaluatedRuns / kpis.totalSlots) * 100) : 0}% benchmark matrix slots active
          </Typography>
        </Box>

        {/* KPI 2: Evaluated Entries Completion Count */}
        <Box
          sx={{
            flex: 1.3,
            minWidth: 240,
            p: 2.25,
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 2.5,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5} mb={0.75}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: '#f1f5f9',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FontAwesomeIcon icon={faCheckCircle} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
                Total Quorum Completion
              </Typography>
              <Typography variant="h6" fontWeight={800} color="#0f172a" lineHeight={1.1}>
                {kpis.totalQuorumRows.toLocaleString()} / {kpis.totalLogRows.toLocaleString()}
              </Typography>
            </Box>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={kpis.suiteCompletionRate}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: '#e2e8f0',
              mb: 0.5,
              '& .MuiLinearProgress-bar': { bgcolor: '#0f172a', borderRadius: 3 },
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {kpis.suiteCompletionRate}% evaluated with quorum ({kpis.totalPendingRows.toLocaleString()} pending)
          </Typography>
        </Box>

        {/* KPI 3: Average Consensus ASR */}
        <Box
          sx={{
            flex: 1,
            minWidth: 200,
            p: 2.25,
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 2.5,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: '#f1f5f9',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FontAwesomeIcon icon={faBullseye} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
                Consensus ASR
              </Typography>
              <Typography variant="h6" fontWeight={800} color="#0f172a" lineHeight={1.1}>
                {kpis.overallAsr !== '—' ? `${kpis.overallAsr}%` : '—'}
              </Typography>
            </Box>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {kpis.totalConsensusDangerous.toLocaleString()} jailbroken / {kpis.totalQuorumRows.toLocaleString()} evaluated
          </Typography>
        </Box>

        {/* KPI 4: 100% Fully Completed Runs */}
        <Box
          sx={{
            flex: 1,
            minWidth: 200,
            p: 2.25,
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 2.5,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: '#f1f5f9',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FontAwesomeIcon icon={faScaleBalanced} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
                Fully Complete Runs
              </Typography>
              <Typography variant="h6" fontWeight={800} color="#0f172a" lineHeight={1.1}>
                {kpis.totalFullyCompletedRuns} / {kpis.totalEvaluatedRuns}
              </Typography>
            </Box>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {kpis.totalPartialRuns + kpis.totalPendingQuorumRuns} runs have pending entries
          </Typography>
        </Box>
      </Stack>

      {/* Control Bar: Metric Selector, Category Chips, Status Filter, Search */}
      <Box
        sx={{
          bgcolor: '#ffffff',
          p: 2.5,
          border: '1px solid #e2e8f0',
          borderRadius: 2.5,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <Stack spacing={2}>
          {/* Top Row: Metric & Filters */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ md: 'center' }}
            justifyContent="space-between"
            spacing={2}
          >
            {/* Metric Selector */}
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Typography variant="subtitle2" fontWeight={700} color="#1e293b" fontSize="0.85rem">
                Displayed Metric:
              </Typography>
              <FormControl size="small" sx={{ minWidth: 230 }}>
                <Select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value)}
                  sx={{ height: 36, fontSize: '0.825rem', fontWeight: 600, bgcolor: '#f8fafc' }}
                >
                  <MenuItem value="consensus_asr">⚖️ Consensus ASR % (Quorum 2+)</MenuItem>
                  <MenuItem value="llamaguard_asr">🛡️ LlamaGuard 3 8B ASR %</MenuItem>
                  <MenuItem value="qwen_asr">🤖 Qwen 2.5 72B Judge ASR %</MenuItem>
                  <MenuItem value="gemma_asr">💎 Gemma 2 27B Judge ASR %</MenuItem>
                  <MenuItem value="pt_asr">🇧🇷 Portuguese (pt-BR) ASR %</MenuItem>
                  <MenuItem value="en_asr">🇺🇸 English (en) ASR %</MenuItem>
                  <MenuItem value="cross_lingual_gap">🌐 Cross-Lingual Gap (pt - en)</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            {/* Status Filter & Search */}
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <Select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  sx={{ height: 36, fontSize: '0.8rem', bgcolor: '#f8fafc' }}
                >
                  <MenuItem value="all">All Completion States</MenuItem>
                  <MenuItem value="complete">✅ 100% Complete Only</MenuItem>
                  <MenuItem value="partial">⏳ Incomplete / Pending Only</MenuItem>
                  <MenuItem value="pending_quorum">⚠️ Pending 2nd Judge Only</MenuItem>
                  <MenuItem value="missing">❌ Missing / Not Evaluated</MenuItem>
                </Select>
              </FormControl>

              <TextField
                size="small"
                placeholder="Search methods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <FontAwesomeIcon icon={faSearch} style={{ color: '#94a3b8', fontSize: '0.75rem' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  width: 180,
                  '& .MuiInputBase-root': { height: 36, fontSize: '0.8rem', bgcolor: '#f8fafc' },
                }}
              />

              <Button
                variant="outlined"
                size="small"
                onClick={() => onLoadMatrixData && onLoadMatrixData(true)}
                disabled={loading}
                startIcon={<FontAwesomeIcon icon={faRotateRight} spin={loading} />}
                sx={{ height: 36, fontSize: '0.8rem', fontWeight: 600, borderColor: '#cbd5e1', color: '#475569' }}
              >
                Refresh
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ borderColor: '#f1f5f9' }} />

          {/* Bottom Row: Category Chips */}
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1.5}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <FontAwesomeIcon icon={faFilter} style={{ fontSize: '0.75rem', color: '#64748b' }} />
              <Typography variant="caption" fontWeight={700} color="#475569" textTransform="uppercase">
                Category:
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {METHOD_CATEGORIES.map((cat) => {
                const count = cat.id === 'all'
                  ? allMethods.length
                  : allMethods.filter((m) => m.category === cat.id).length;
                const isSelected = selectedCategory === cat.id;
                return (
                  <Chip
                    key={cat.id}
                    label={`${cat.label} (${count})`}
                    onClick={() => setSelectedCategory(cat.id)}
                    size="small"
                    sx={{
                      cursor: 'pointer',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '0.75rem',
                      bgcolor: isSelected ? '#0f172a' : '#f8fafc',
                      color: isSelected ? '#ffffff' : '#475569',
                      border: isSelected ? '1px solid #0f172a' : '1px solid #e2e8f0',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        bgcolor: isSelected ? '#1e293b' : '#f1f5f9',
                      },
                    }}
                  />
                );
              })}
            </Stack>
          </Stack>
        </Stack>
      </Box>

      {/* Progress banner when loading files */}
      {loading && (
        <Box sx={{ bgcolor: '#f8fafc', p: 1.5, px: 2.5, borderRadius: 2, border: '1px solid #e2e8f0' }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <CircularProgress size={18} thickness={5} sx={{ color: '#0f172a' }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" color="#0f172a" fontWeight={600} fontSize="0.825rem">
                Analyzing benchmark consensus files ({progress.loaded} of {progress.total} files indexed)...
              </Typography>
              <LinearProgress
                variant="determinate"
                value={progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0}
                sx={{ height: 4, borderRadius: 2, bgcolor: '#e2e8f0', mt: 0.5, '& .MuiLinearProgress-bar': { bgcolor: '#0f172a' } }}
              />
            </Box>
          </Stack>
        </Box>
      )}

      {/* Main Matrix Table */}
      <Box
        sx={{
          bgcolor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <Box sx={{ p: 2.5, px: 3, borderBottom: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Box>
              <Typography variant="h6" fontWeight={800} color="#0f172a" fontSize="1.05rem">
                Adversarial Evaluation Matrix
              </Typography>
              <Typography variant="body2" color="text.secondary" fontSize="0.8rem">
                Pairing <strong>Percentages</strong> (Consensus ASR, PT-BR vs EN) with <strong>Completion Counts</strong> (quorum vs total log entries). Click any cell to inspect breakdown or view test cases.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Chip
                label="Judges: [L] LlamaGuard · [Q] Qwen · [G] Gemma"
                size="small"
                sx={{ fontSize: '0.7rem', fontWeight: 600, bgcolor: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' }}
              />
            </Stack>
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
              minWidth: 980,
            }}
          >
            <Box component="thead">
              <Box component="tr" sx={{ bgcolor: '#f8fafc' }}>
                <Box
                  component="th"
                  sx={{
                    p: 2,
                    width: 220,
                    textAlign: 'left',
                    borderBottom: '1px solid #e2e8f0',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Adversarial Method
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
                      fontSize: '0.75rem',
                      color: '#475569',
                      letterSpacing: '0.03em',
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
              {displayedMethods.map((method) => (
                <Box component="tr" key={method.id} sx={{ '&:hover': { bgcolor: '#fbfcfd' } }}>
                  {/* Method Header Column */}
                  <Box
                    component="td"
                    sx={{
                      p: 1.75,
                      borderBottom: '1px solid #f1f5f9',
                      verticalAlign: 'middle',
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Box
                        sx={{
                          width: 4,
                          height: 32,
                          borderRadius: 1,
                          bgcolor: '#475569',
                          flexShrink: 0,
                        }}
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" fontWeight={700} color="#1e293b" fontSize="0.825rem" noWrap>
                          {method.shortLabel}
                        </Typography>
                        <Tooltip title={method.description || method.label} arrow placement="top">
                          <Typography variant="caption" color="text.secondary" fontSize="0.7rem" display="block" noWrap>
                            {method.label}
                          </Typography>
                        </Tooltip>
                      </Box>
                    </Stack>
                  </Box>

                  {/* Model Cells */}
                  {allModels.map((model) => {
                    const key = `${method.id}__${model.id}`;
                    const fileInfo = fileKeyMapping.get(key);
                    const stats = fileInfo ? matrixStats[fileInfo.fileName] : null;

                    // Filter matching
                    if (selectedStatusFilter !== 'all') {
                      if (selectedStatusFilter === 'complete' && stats?.status !== 'complete') {
                        return <EmptyCell key={model.id} text="Filtered out" />;
                      }
                      if (selectedStatusFilter === 'partial' && stats?.status !== 'partial') {
                        return <EmptyCell key={model.id} text="Filtered out" />;
                      }
                      if (selectedStatusFilter === 'pending_quorum' && stats?.status !== 'pending_quorum') {
                        return <EmptyCell key={model.id} text="Filtered out" />;
                      }
                      if (selectedStatusFilter === 'missing' && stats) {
                        return <EmptyCell key={model.id} text="Filtered out" />;
                      }
                    }

                    if (!fileInfo) {
                      return (
                        <Box
                          component="td"
                          key={model.id}
                          sx={{ p: 1.25, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}
                        >
                          <Box
                            sx={{
                              p: 1.5,
                              bgcolor: '#f8fafc',
                              border: '1px dashed #e2e8f0',
                              borderRadius: 2,
                              minHeight: 88,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Typography variant="caption" color="#94a3b8" fontSize="0.7rem">
                              — Not Generated
                            </Typography>
                          </Box>
                        </Box>
                      );
                    }

                    if (!stats) {
                      return (
                        <Box
                          component="td"
                          key={model.id}
                          sx={{ p: 1.25, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}
                        >
                          <Box
                            sx={{
                              p: 1.5,
                              bgcolor: '#fffbeb',
                              border: '1px dashed #fde68a',
                              borderRadius: 2,
                              minHeight: 88,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 0.5,
                            }}
                          >
                            <CircularProgress size={14} thickness={4} sx={{ color: '#d97706' }} />
                            <Typography variant="caption" color="#b45309" fontSize="0.675rem" fontWeight={600}>
                              Reading...
                            </Typography>
                          </Box>
                        </Box>
                      );
                    }

                    const metricInfo = getCellMetricValue(stats);
                    const asrColors = getAsrColor(metricInfo.value);
                    const compColors = getCompletionColor(stats.completionRate);

                    return (
                      <Box
                        component="td"
                        key={model.id}
                        sx={{ p: 1, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}
                      >
                        <Box
                          onClick={() => {
                            setSelectedCellData({
                              stats,
                              method,
                              model,
                              fileInfo,
                            });
                          }}
                          sx={{
                            p: 1.25,
                            bgcolor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 2,
                            cursor: 'pointer',
                            minHeight: 90,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            transition: 'all 0.15s ease',
                            '&:hover': {
                              borderColor: '#475569',
                              boxShadow: '0 3px 10px rgba(0,0,0,0.08)',
                              transform: 'translateY(-1px)',
                            },
                          }}
                        >
                          {/* Row 1: Percentage Badge & Monochromatic Judge Dots */}
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Chip
                              label={metricInfo.label}
                              size="small"
                              sx={{
                                height: 21,
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                bgcolor: asrColors.badgeBg,
                                color: asrColors.text,
                                border: `1px solid ${asrColors.border}`,
                              }}
                            />

                            {/* Evaluator presence pills (Monochromatic) */}
                            <Stack direction="row" spacing={0.5}>
                              <JudgeDot
                                active={stats.evaluators?.llamaguard?.present}
                                label="L"
                                tooltip={`LlamaGuard 3 8B: ${stats.evaluators?.llamaguard?.present ? 'Evaluated' : 'Not Evaluated'}`}
                              />
                              <JudgeDot
                                active={stats.evaluators?.qwen_judge?.present}
                                label="Q"
                                tooltip={`Qwen 2.5 72B Judge: ${stats.evaluators?.qwen_judge?.present ? 'Evaluated' : 'Not Evaluated'}`}
                              />
                              <JudgeDot
                                active={stats.evaluators?.gemma_judge?.present}
                                label="G"
                                tooltip={`Gemma 2 27B Judge: ${stats.evaluators?.gemma_judge?.present ? 'Evaluated' : 'Not Evaluated'}`}
                              />
                            </Stack>
                          </Stack>

                          {/* Row 2: Completion Count & Percentage */}
                          <Box my={0.5}>
                            <Stack direction="row" alignItems="baseline" justifyContent="space-between">
                              <Typography variant="body2" fontWeight={800} color="#0f172a" fontSize="0.825rem">
                                {stats.quorumRows.toLocaleString()}
                                <span style={{ fontWeight: 500, color: '#64748b', fontSize: '0.725rem' }}>
                                  {' '}/ {stats.totalLogRows.toLocaleString()}
                                </span>
                              </Typography>
                              <Typography
                                variant="caption"
                                fontWeight={700}
                                fontSize="0.675rem"
                                sx={{ color: compColors.badgeText }}
                              >
                                {stats.completionRate.toFixed(0)}%
                              </Typography>
                            </Stack>

                            {/* Mini Progress Bar */}
                            <Box
                              sx={{
                                height: 4,
                                width: '100%',
                                bgcolor: '#f1f5f9',
                                borderRadius: 2,
                                mt: 0.5,
                                overflow: 'hidden',
                                display: 'flex',
                              }}
                            >
                              <Box
                                sx={{
                                  width: `${Math.min(stats.completionRate, 100)}%`,
                                  bgcolor: compColors.barColor,
                                }}
                              />
                              {stats.pendingRows > 0 && (
                                <Box
                                  sx={{
                                    width: `${Math.min((stats.pendingRows / (stats.totalLogRows || 1)) * 100, 100)}%`,
                                    bgcolor: '#cbd5e1',
                                  }}
                                />
                              )}
                            </Box>
                          </Box>

                          {/* Row 3: Language Breakdown (PT-BR vs EN ASR when available) */}
                          {(stats.languages?.pt?.total > 0 || stats.languages?.en?.total > 0) && (
                            <Stack
                              direction="row"
                              alignItems="center"
                              justifyContent="space-between"
                              sx={{
                                bgcolor: '#f8fafc',
                                border: '1px solid #f1f5f9',
                                borderRadius: 1,
                                px: 0.75,
                                py: 0.3,
                                my: 0.35,
                                fontSize: '0.675rem',
                              }}
                            >
                              <Box>
                                <span style={{ color: '#64748b', fontWeight: 600 }}>PT: </span>
                                <strong style={{ color: stats.languages?.pt?.asr !== null ? '#0f172a' : '#94a3b8' }}>
                                  {stats.languages?.pt?.asr !== null ? `${stats.languages.pt.asr}%` : '—'}
                                </strong>
                              </Box>
                              <Box sx={{ color: '#cbd5e1' }}>·</Box>
                              <Box>
                                <span style={{ color: '#64748b', fontWeight: 600 }}>EN: </span>
                                <strong style={{ color: stats.languages?.en?.asr !== null ? '#0f172a' : '#94a3b8' }}>
                                  {stats.languages?.en?.asr !== null ? `${stats.languages.en.asr}%` : '—'}
                                </strong>
                              </Box>
                              {stats.languages?.gap !== null && (
                                <>
                                  <Box sx={{ color: '#cbd5e1' }}>·</Box>
                                  <Box sx={{ color: '#475569', fontWeight: 700, fontSize: '0.625rem' }}>
                                    Δ {stats.languages.gap >= 0 ? `+${stats.languages.gap}%` : `${stats.languages.gap}%`}
                                  </Box>
                                </>
                              )}
                            </Stack>
                          )}

                          {/* Row 4: Status Indicator (Subtle slate) */}
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            {stats.status === 'complete' ? (
                              <Typography variant="caption" color="#334155" fontWeight={700} fontSize="0.675rem">
                                ✓ Quorum Reached
                              </Typography>
                            ) : stats.status === 'pending_quorum' ? (
                              <Typography variant="caption" color="#64748b" fontWeight={700} fontSize="0.675rem">
                                Pending 2nd Judge
                              </Typography>
                            ) : stats.pendingRows > 0 ? (
                              <Typography variant="caption" color="#64748b" fontWeight={600} fontSize="0.675rem">
                                {stats.pendingRows.toLocaleString()} pending
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="#64748b" fontSize="0.675rem">
                                Ready
                              </Typography>
                            )}
                          </Stack>
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

      {/* Cell Detail Modal */}
      {selectedCellData && (
        <CellDetailModal
          open={Boolean(selectedCellData)}
          onClose={() => setSelectedCellData(null)}
          cellData={selectedCellData}
          onInspectFile={onInspectFile}
        />
      )}
    </Stack>
  );
}

// Subcomponent: Mini indicator for an evaluator (Monochromatic)
function JudgeDot({ active, label, tooltip }) {
  const dot = (
    <Box
      sx={{
        width: 15,
        height: 15,
        borderRadius: '50%',
        bgcolor: active ? '#0f172a' : '#ffffff',
        color: active ? '#ffffff' : '#94a3b8',
        fontSize: '0.55rem',
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: active ? '1px solid #0f172a' : '1px solid #cbd5e1',
        userSelect: 'none',
      }}
    >
      {label}
    </Box>
  );

  if (tooltip) {
    return (
      <Tooltip title={tooltip} arrow placement="top">
        {dot}
      </Tooltip>
    );
  }
  return dot;
}

// Subcomponent: Empty Cell for Filtered items
function EmptyCell({ text }) {
  return (
    <Box component="td" sx={{ p: 1.25, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
      <Box
        sx={{
          p: 1.5,
          bgcolor: '#fafafa',
          border: '1px dashed #e2e8f0',
          borderRadius: 2,
          minHeight: 88,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="caption" color="#cbd5e1" fontSize="0.7rem">
          {text}
        </Typography>
      </Box>
    </Box>
  );
}

// Subcomponent: Cell Detail Modal with deep dive and direct navigation
function CellDetailModal({ open, onClose, cellData, onInspectFile }) {
  if (!cellData) return null;
  const { stats, method, model, fileInfo } = cellData;

  const handleInspect = () => {
    onClose();
    if (onInspectFile && fileInfo?.fileName) {
      onInspectFile(fileInfo.fileName);
    }
  };

  const asrColors = getAsrColor(stats.consensusAsr);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1, borderBottom: '1px solid #e2e8f0' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: '#0f172a',
                }}
              />
              <Typography variant="h6" fontWeight={800} color="#0f172a" fontSize="1.1rem">
                {method.label}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" fontSize="0.825rem">
              Model: <strong>{model.label}</strong>
            </Typography>
          </Box>
          <Chip
            label={stats.consensusAsr !== null ? `${stats.consensusAsr}% ASR` : 'No Quorum'}
            sx={{
              fontWeight: 800,
              fontSize: '0.85rem',
              bgcolor: asrColors.badgeBg,
              color: asrColors.text,
              border: `1px solid ${asrColors.border}`,
            }}
          />
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ py: 3 }}>
        <Stack spacing={3}>
          {/* File Name */}
          <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
              Log Filename:
            </Typography>
            <Typography variant="body2" fontWeight={600} color="#334155" fontFamily="monospace" fontSize="0.775rem">
              {stats.fileName}
            </Typography>
          </Box>

          {/* Section 1: Completion Count Breakdown */}
          <Box>
            <Typography variant="subtitle2" fontWeight={700} color="#1e293b" gutterBottom>
              Evaluation Completion Breakdown
            </Typography>
            <Stack direction="row" spacing={1.5} mb={1.5}>
              <Box sx={{ flex: 1, p: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Total Log Entries
                </Typography>
                <Typography variant="h6" fontWeight={800} color="#0f172a">
                  {stats.totalLogRows.toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, p: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Quorum Evaluated
                </Typography>
                <Typography variant="h6" fontWeight={800} color="#0f172a">
                  {stats.quorumRows.toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, p: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Pending Quorum
                </Typography>
                <Typography variant="h6" fontWeight={800} color="#64748b">
                  {stats.pendingRows.toLocaleString()}
                </Typography>
              </Box>
            </Stack>

            <LinearProgress
              variant="determinate"
              value={stats.completionRate}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: '#e2e8f0',
                '& .MuiLinearProgress-bar': { bgcolor: '#0f172a', borderRadius: 4 },
              }}
            />
            <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
              {stats.completionRate.toFixed(1)}% of all entries have reached 2+ judge quorum
            </Typography>
          </Box>

          <Divider />

          {/* Section 2: Multi-Judge Sidecar Breakdown */}
          <Box>
            <Typography variant="subtitle2" fontWeight={700} color="#1e293b" gutterBottom>
              Individual Evaluator Breakdown
            </Typography>
            <Stack spacing={1.25}>
              <EvaluatorCard
                name="LlamaGuard 3 8B (Aegis)"
                data={stats.evaluators?.llamaguard}
                totalLogRows={stats.totalLogRows}
              />
              <EvaluatorCard
                name="Qwen 2.5 72B Judge"
                data={stats.evaluators?.qwen_judge}
                totalLogRows={stats.totalLogRows}
              />
              <EvaluatorCard
                name="Gemma 2 27B Judge"
                data={stats.evaluators?.gemma_judge}
                totalLogRows={stats.totalLogRows}
              />
            </Stack>
          </Box>

          <Divider />

          {/* Section 3: Cross-Lingual Breakdown */}
          <Box>
            <Typography variant="subtitle2" fontWeight={700} color="#1e293b" gutterBottom>
              Cross-Lingual Comparison (pt-BR vs EN)
            </Typography>
            <Stack direction="row" spacing={2}>
              <Box sx={{ flex: 1, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  Portuguese (pt-BR)
                </Typography>
                <Typography variant="h6" fontWeight={800} color="#0f172a">
                  {stats.languages?.pt?.asr !== null ? `${stats.languages.pt.asr}% ASR` : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {stats.languages?.pt?.dangerous || 0} jailbroken / {stats.languages?.pt?.quorum || 0} quorum
                </Typography>
              </Box>

              <Box sx={{ flex: 1, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  English (en)
                </Typography>
                <Typography variant="h6" fontWeight={800} color="#0f172a">
                  {stats.languages?.en?.asr !== null ? `${stats.languages.en.asr}% ASR` : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {stats.languages?.en?.dangerous || 0} jailbroken / {stats.languages?.en?.quorum || 0} quorum
                </Typography>
              </Box>
            </Stack>

            {stats.languages?.gap !== null && (
              <Box sx={{ mt: 1.5, p: 1.25, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" color="#0f172a" fontWeight={600}>
                  Cross-Lingual Gap: <strong>{stats.languages.gap >= 0 ? `+${stats.languages.gap}%` : `${stats.languages.gap}%`}</strong>
                  {stats.languages.gap > 0
                    ? ' (Vulnerability is higher in Portuguese than in English)'
                    : ' (Vulnerability is higher in English than in Portuguese)'}
                </Typography>
              </Box>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, px: 3, borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
        <Button onClick={onClose} sx={{ color: '#64748b', fontWeight: 600 }}>
          Close
        </Button>
        <Button
          variant="contained"
          onClick={handleInspect}
          endIcon={<FontAwesomeIcon icon={faArrowRight} />}
          sx={{ bgcolor: '#0f172a', fontWeight: 700, '&:hover': { bgcolor: '#1e293b' } }}
        >
          Inspect Test Cases
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Subcomponent: Evaluator breakdown line (Monochromatic)
function EvaluatorCard({ name, data, totalLogRows }) {
  const isPresent = Boolean(data?.present);
  return (
    <Box
      sx={{
        p: 1.5,
        bgcolor: isPresent ? '#ffffff' : '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 2,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: isPresent ? '#0f172a' : '#cbd5e1' }} />
          <Typography variant="body2" fontWeight={700} color={isPresent ? '#0f172a' : '#94a3b8'}>
            {name}
          </Typography>
        </Stack>
        {isPresent ? (
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="caption" color="text.secondary">
              {data.total.toLocaleString()} / {totalLogRows.toLocaleString()} evaluated
            </Typography>
            <Chip
              label={`${data.asr !== null ? `${data.asr}%` : '—'} ASR`}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                fontWeight: 800,
                bgcolor: '#f1f5f9',
                color: '#1e293b',
              }}
            />
          </Stack>
        ) : (
          <Typography variant="caption" color="#94a3b8" fontWeight={500}>
            Not Evaluated
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
