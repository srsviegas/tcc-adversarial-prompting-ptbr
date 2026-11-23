import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  IconButton,
  Box,
  Chip,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faArrowLeft,
  faArrowRight,
  faCopy,
  faCheck,
  faChevronDown,
  faBrain,
  faShieldHalved,
  faGavel,
  faTriangleExclamation,
  faCircleCheck,
  faClock,
  faCodeCompare,
} from '@fortawesome/free-solid-svg-icons';
import { computeRowCrossModelSummary } from '../utils/modelComparisonUtils';

const getScoreColors = (score) => {
  switch (score) {
    case 5:
      return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', label: '5/5 Severe' };
    case 4:
      return { bg: '#ffedd5', text: '#9a3412', border: '#fdba74', label: '4/5 Unsafe' };
    case 3:
      return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d', label: '3/5 Borderline' };
    case 2:
      return { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc', label: '2/5 Benign' };
    case 1:
      return { bg: '#dcfce7', text: '#166534', border: '#86efac', label: '1/5 Refusal' };
    default:
      return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', label: 'Pending' };
  }
};

function renderConsensusChip(consensus = {}) {
  if (!consensus.has_quorum) {
    return (
      <Chip
        icon={<FontAwesomeIcon icon={faClock} style={{ fontSize: '0.7rem', color: '#64748b' }} />}
        label={`Pending (${consensus.total_voted || 0}/2)`}
        size="small"
        sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}
      />
    );
  }
  if (consensus.consensus_dangerous === true) {
    return (
      <Chip
        icon={<FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: '0.72rem', color: '#b91c1c' }} />}
        label={`Dangerous (${consensus.votes_dangerous}/${consensus.total_voted})`}
        size="small"
        sx={{ height: 22, fontSize: '0.7rem', fontWeight: 800, bgcolor: '#fee2e2', color: '#991b1b', border: '1px solid #f87171' }}
      />
    );
  }
  if (consensus.consensus_dangerous === false) {
    const isSplit = consensus.is_disagreement;
    return (
      <Chip
        icon={
          <FontAwesomeIcon
            icon={isSplit ? faTriangleExclamation : faCircleCheck}
            style={{ fontSize: '0.72rem', color: isSplit ? '#d97706' : '#15803d' }}
          />
        }
        label={isSplit ? `Safe · Split (${consensus.votes_safe}/${consensus.total_voted})` : `Safe (${consensus.votes_safe}/${consensus.total_voted})`}
        size="small"
        sx={{
          height: 22,
          fontSize: '0.7rem',
          fontWeight: 800,
          bgcolor: isSplit ? '#fef3c7' : '#dcfce7',
          color: isSplit ? '#92400e' : '#166534',
          border: '1px solid',
          borderColor: isSplit ? '#fcd34d' : '#86efac',
        }}
      />
    );
  }
  return <Chip label="No Eval" size="small" sx={{ height: 22, fontSize: '0.7rem' }} />;
}

export function RowModelComparisonModal({
  open,
  onClose,
  compRow,
  activeModels = [],
  methodMeta,
  currentIndex,
  totalCount,
  onNavigate,
}) {
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        onNavigate && onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight') {
        onNavigate && onNavigate(currentIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, currentIndex, onNavigate]);

  if (!compRow) return null;

  const activeModelIds = activeModels.map((m) => m.id);
  const summary = computeRowCrossModelSummary(compRow, activeModelIds);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(String(text || ''));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 3,
          maxHeight: '92vh',
        },
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ p: 2, px: 3, borderBottom: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
            <FontAwesomeIcon icon={faCodeCompare} style={{ color: '#2563eb', fontSize: '1rem' }} />
            <Typography variant="subtitle1" fontWeight={800} color="#0f172a">
              Row #{compRow.original_row_index} Comparison
            </Typography>
            {methodMeta && (
              <Chip
                label={methodMeta.shortLabel}
                size="small"
                sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700, bgcolor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
              />
            )}
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
              sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600, bgcolor: '#f1f5f9', color: '#334155' }}
            />
            {compRow.iteration > 1 && (
              <Chip
                label={`Iter ${compRow.iteration}`}
                size="small"
                sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600, bgcolor: '#f1f5f9', color: '#475569' }}
              />
            )}
            {summary.hasDivergence && (
              <Chip
                label={`Divergent (${summary.dangerousCount} Dang / ${summary.safeCount} Safe)`}
                size="small"
                sx={{ height: 22, fontSize: '0.72rem', fontWeight: 800, bgcolor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}
              />
            )}
            <Typography variant="caption" color="#64748b" fontWeight={600}>
              ({currentIndex + 1} of {totalCount})
            </Typography>
          </Stack>

          <IconButton size="small" onClick={onClose}>
            <FontAwesomeIcon icon={faXmark} />
          </IconButton>
        </Stack>
      </DialogTitle>

      {/* Body */}
      <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
        <Stack spacing={2.5}>
          {/* Shared Adversarial Input Prompt */}
          <Box
            sx={{
              p: 2,
              bgcolor: '#ffffff',
              borderRadius: 2,
              border: '1px solid #cbd5e1',
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" fontWeight={800} color="#475569" textTransform="uppercase" letterSpacing="0.05em">
                  Adversarial Input Prompt ({compRow.prompt_language.toUpperCase()})
                </Typography>
                <Typography variant="caption" color="#94a3b8">
                  ({(compRow.prompt || '').length} chars)
                </Typography>
              </Stack>
              <Tooltip title="Copy prompt">
                <IconButton size="small" onClick={() => handleCopy(compRow.prompt, 'prompt')}>
                  <FontAwesomeIcon
                    icon={copiedKey === 'prompt' ? faCheck : faCopy}
                    style={{ fontSize: '0.75rem', color: copiedKey === 'prompt' ? '#16a34a' : '#64748b' }}
                  />
                </IconButton>
              </Tooltip>
            </Stack>
            <Typography
              variant="body2"
              color="#0f172a"
              sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.6,
                maxHeight: 200,
                overflowY: 'auto',
              }}
            >
              {compRow.prompt || '<Prompt unavailable — connect logs/ folder>'}
            </Typography>
          </Box>

          {/* Side-by-Side Model Columns */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: activeModels.length <= 2 ? `repeat(${activeModels.length || 1}, minmax(0, 1fr))` : 'repeat(2, minmax(0, 1fr))',
                xl: `repeat(${Math.min(Math.max(activeModels.length, 1), 3)}, minmax(0, 1fr))`,
              },
              gap: 2,
              alignItems: 'stretch',
            }}
          >
            {activeModels.map((model) => {
              const row = compRow.models[model.id];
              if (!row) {
                return (
                  <Box
                    key={model.id}
                    sx={{
                      p: 2.5,
                      bgcolor: '#ffffff',
                      borderRadius: 2.5,
                      border: '1px dashed #cbd5e1',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      minHeight: 220,
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={800} color="#475569" gutterBottom>
                      {model.label}
                    </Typography>
                    <Typography variant="caption" color="#94a3b8">
                      No record for this interaction
                    </Typography>
                  </Box>
                );
              }

              const { output = {}, execution_metrics = {}, evaluations = {}, error_log = {} } = row;
              const { llamaguard = {}, qwen_judge = {}, gemma_judge = {}, consensus = {} } = evaluations;
              const qwenColors = getScoreColors(qwen_judge.score);
              const gemmaColors = getScoreColors(gemma_judge.score);
              const isDangerous = consensus.consensus_dangerous === true;
              const isSafe = consensus.consensus_dangerous === false;

              return (
                <Box
                  key={model.id}
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: isDangerous ? '#fca5a5' : isSafe ? '#bbf7d0' : '#cbd5e1',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Model Card Header */}
                  <Box
                    sx={{
                      px: 2,
                      py: 1.5,
                      bgcolor: isDangerous ? '#fff5f5' : isSafe ? '#f0fdf4' : '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" fontWeight={800} color="#0f172a" noWrap>
                          {model.label}
                        </Typography>
                        {execution_metrics.latency_seconds !== undefined && (
                          <Typography variant="caption" color="#64748b">
                            {Number(execution_metrics.latency_seconds).toFixed(2)}s
                            {execution_metrics.output_tokens ? ` · ${execution_metrics.output_tokens} tok` : ''}
                          </Typography>
                        )}
                      </Box>
                      {renderConsensusChip(consensus)}
                    </Stack>
                  </Box>

                  {/* Model Response */}
                  <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.75}>
                        <Typography variant="caption" fontWeight={700} color="#2563eb" textTransform="uppercase" letterSpacing="0.05em">
                          Model Response
                        </Typography>
                        <Tooltip title="Copy response">
                          <IconButton size="small" onClick={() => handleCopy(output.extracted_text, `resp_${model.id}`)}>
                            <FontAwesomeIcon
                              icon={copiedKey === `resp_${model.id}` ? faCheck : faCopy}
                              style={{ fontSize: '0.72rem', color: copiedKey === `resp_${model.id}` ? '#16a34a' : '#64748b' }}
                            />
                          </IconButton>
                        </Tooltip>
                      </Stack>

                      <Box
                        sx={{
                          p: 1.5,
                          bgcolor: '#f8fafc',
                          borderRadius: 1.5,
                          border: '1px solid #e2e8f0',
                          maxHeight: 280,
                          overflowY: 'auto',
                        }}
                      >
                        <Typography
                          variant="body2"
                          color="#0f172a"
                          sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55, fontSize: '0.825rem' }}
                        >
                          {output.extracted_text || (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                              {error_log?.failed ? `Execution Failed: ${error_log.error_message}` : '<Empty Response>'}
                            </span>
                          )}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Collapsible Thought Process */}
                    {output.thought_process && (
                      <Accordion
                        disableGutters
                        elevation={0}
                        sx={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 1.5,
                          bgcolor: '#faf5ff',
                          '&:before': { display: 'none' },
                        }}
                      >
                        <AccordionSummary expandIcon={<FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '0.65rem' }} />}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <FontAwesomeIcon icon={faBrain} style={{ color: '#7c3aed', fontSize: '0.75rem' }} />
                            <Typography variant="caption" fontWeight={700} color="#7c3aed">
                              Chain-of-Thought (&lt;think&gt;)
                            </Typography>
                          </Stack>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0, maxHeight: 200, overflowY: 'auto' }}>
                          <Typography
                            variant="caption"
                            color="#475569"
                            sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.72rem' }}
                          >
                            {output.thought_process}
                          </Typography>
                        </AccordionDetails>
                      </Accordion>
                    )}

                    <Divider />

                    {/* Evaluators Breakdown */}
                    <Stack spacing={1}>
                      <Typography variant="caption" fontWeight={800} color="#64748b" textTransform="uppercase" letterSpacing="0.05em">
                        Evaluators
                      </Typography>

                      {/* LlamaGuard */}
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ px: 1.25, py: 0.75, borderRadius: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}
                      >
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: '0.72rem', color: '#475569' }} />
                          <Typography variant="caption" fontWeight={700} color="#1e293b">
                            LlamaGuard
                          </Typography>
                        </Stack>
                        {llamaguard.status === 'missing' ? (
                          <Chip label="—" size="small" sx={{ height: 18, fontSize: '0.68rem' }} />
                        ) : llamaguard.status === 'error' ? (
                          <Chip label="Error" size="small" color="error" sx={{ height: 18, fontSize: '0.68rem' }} />
                        ) : llamaguard.flagged ? (
                          <Chip label="Unsafe" size="small" sx={{ height: 18, fontSize: '0.68rem', fontWeight: 800, bgcolor: '#fee2e2', color: '#991b1b' }} />
                        ) : (
                          <Chip label="Safe" size="small" sx={{ height: 18, fontSize: '0.68rem', fontWeight: 700, bgcolor: '#dcfce7', color: '#166534' }} />
                        )}
                      </Stack>

                      {llamaguard.flagged_categories?.length > 0 && (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} pl={0.5}>
                          {llamaguard.flagged_categories.map((cat, i) => (
                            <Chip
                              key={i}
                              label={cat}
                              size="small"
                              sx={{ height: 17, fontSize: '0.62rem', bgcolor: '#fecaca', color: '#991b1b', fontWeight: 600 }}
                            />
                          ))}
                        </Stack>
                      )}

                      {/* Qwen Judge */}
                      <Accordion
                        disableGutters
                        elevation={0}
                        disabled={!qwen_judge.reasoning}
                        sx={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px !important',
                          bgcolor: '#f8fafc',
                          '&:before': { display: 'none' },
                          '&.Mui-disabled': { bgcolor: '#f8fafc', opacity: 1 },
                        }}
                      >
                        <AccordionSummary
                          expandIcon={qwen_judge.reasoning ? <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '0.65rem' }} /> : null}
                          sx={{ minHeight: 34, px: 1.25, '& .MuiAccordionSummary-content': { my: 0.5 } }}
                        >
                          <Stack direction="row" alignItems="center" justifyContent="space-between" width="100%" pr={1}>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <FontAwesomeIcon icon={faGavel} style={{ fontSize: '0.72rem', color: '#475569' }} />
                              <Typography variant="caption" fontWeight={700} color="#1e293b">
                                Qwen Judge
                              </Typography>
                            </Stack>
                            {qwen_judge.status === 'missing' || qwen_judge.score === null ? (
                              <Chip label="—" size="small" sx={{ height: 18, fontSize: '0.68rem' }} />
                            ) : (
                              <Chip
                                label={qwenColors.label}
                                size="small"
                                sx={{ height: 18, fontSize: '0.68rem', fontWeight: 800, bgcolor: qwenColors.bg, color: qwenColors.text }}
                              />
                            )}
                          </Stack>
                        </AccordionSummary>
                        {qwen_judge.reasoning && (
                          <AccordionDetails sx={{ pt: 0, px: 1.25, pb: 1.25 }}>
                            <Typography variant="caption" color="#334155" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.45, display: 'block' }}>
                              {qwen_judge.reasoning}
                            </Typography>
                          </AccordionDetails>
                        )}
                      </Accordion>

                      {/* Gemma Judge */}
                      <Accordion
                        disableGutters
                        elevation={0}
                        disabled={!gemma_judge.reasoning}
                        sx={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px !important',
                          bgcolor: '#f8fafc',
                          '&:before': { display: 'none' },
                          '&.Mui-disabled': { bgcolor: '#f8fafc', opacity: 1 },
                        }}
                      >
                        <AccordionSummary
                          expandIcon={gemma_judge.reasoning ? <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '0.65rem' }} /> : null}
                          sx={{ minHeight: 34, px: 1.25, '& .MuiAccordionSummary-content': { my: 0.5 } }}
                        >
                          <Stack direction="row" alignItems="center" justifyContent="space-between" width="100%" pr={1}>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <FontAwesomeIcon icon={faGavel} style={{ fontSize: '0.72rem', color: '#7c3aed' }} />
                              <Typography variant="caption" fontWeight={700} color="#1e293b">
                                Gemma Judge
                              </Typography>
                            </Stack>
                            {gemma_judge.status === 'missing' || gemma_judge.score === null ? (
                              <Chip label="—" size="small" sx={{ height: 18, fontSize: '0.68rem' }} />
                            ) : (
                              <Chip
                                label={gemmaColors.label}
                                size="small"
                                sx={{ height: 18, fontSize: '0.68rem', fontWeight: 800, bgcolor: gemmaColors.bg, color: gemmaColors.text }}
                              />
                            )}
                          </Stack>
                        </AccordionSummary>
                        {gemma_judge.reasoning && (
                          <AccordionDetails sx={{ pt: 0, px: 1.25, pb: 1.25 }}>
                            <Typography variant="caption" color="#334155" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.45, display: 'block' }}>
                              {gemma_judge.reasoning}
                            </Typography>
                          </AccordionDetails>
                        )}
                      </Accordion>
                    </Stack>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Stack>
      </DialogContent>

      {/* Footer Navigation */}
      <DialogActions sx={{ p: 2, px: 3, borderTop: '1px solid #e2e8f0', justifyContent: 'space-between', bgcolor: '#ffffff' }}>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => onNavigate && onNavigate(currentIndex - 1)}
            disabled={currentIndex <= 0}
            startIcon={<FontAwesomeIcon icon={faArrowLeft} />}
          >
            Previous Row
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => onNavigate && onNavigate(currentIndex + 1)}
            disabled={currentIndex >= totalCount - 1}
            endIcon={<FontAwesomeIcon icon={faArrowRight} />}
          >
            Next Row
          </Button>
        </Stack>

        <Button variant="contained" size="small" onClick={onClose} sx={{ bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
