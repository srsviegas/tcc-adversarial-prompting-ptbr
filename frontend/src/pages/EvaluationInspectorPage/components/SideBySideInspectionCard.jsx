import React, { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Chip,
  IconButton,
  Button,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Paper,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCopy,
  faCheck,
  faChevronDown,
  faBrain,
  faShieldHalved,
  faGavel,
  faTriangleExclamation,
  faCircleCheck,
  faClock,
} from '@fortawesome/free-solid-svg-icons';

// Score color scheme for 1-5 rating scale
const getScoreColors = (score) => {
  switch (score) {
    case 5:
      return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', label: 'Severe Harm (5/5)' };
    case 4:
      return { bg: '#ffedd5', text: '#9a3412', border: '#fdba74', label: 'Unsafe (4/5)' };
    case 3:
      return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d', label: 'Borderline (3/5)' };
    case 2:
      return { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc', label: 'Benign Ed. (2/5)' };
    case 1:
      return { bg: '#dcfce7', text: '#166534', border: '#86efac', label: 'Full Refusal (1/5)' };
    default:
      return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', label: 'Pending' };
  }
};

export function SideBySideInspectionCard({ row, onInspectRow }) {
  const [copiedSection, setCopiedSection] = useState(null);

  const {
    id,
    original_row_index,
    inputs = {},
    model_config = {},
    output = {},
    execution_metrics = {},
    evaluations = {},
  } = row;

  const { llamaguard = {}, qwen_judge = {}, gemma_judge = {}, consensus = {} } = evaluations;

  const handleCopy = (text, section) => {
    navigator.clipboard.writeText(String(text || ''));
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 1500);
  };

  // Determine consensus visual badge
  const renderConsensusBadge = () => {
    if (!consensus.has_quorum) {
      return (
        <Chip
          icon={<FontAwesomeIcon icon={faClock} style={{ fontSize: '0.75rem', color: '#64748b' }} />}
          label={`PENDING QUORUM (${consensus.total_voted || 0}/2 Judges)`}
          size="small"
          sx={{
            bgcolor: '#f1f5f9',
            color: '#334155',
            fontWeight: 700,
            fontSize: '0.75rem',
            border: '1px solid #cbd5e1',
          }}
        />
      );
    }

    if (consensus.consensus_dangerous === true) {
      return (
        <Chip
          icon={<FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: '0.8rem', color: '#b91c1c' }} />}
          label={`CONSENSUS: DANGEROUS (${consensus.votes_dangerous}/${consensus.total_voted} Votes)`}
          size="small"
          sx={{
            bgcolor: '#fee2e2',
            color: '#991b1b',
            fontWeight: 800,
            fontSize: '0.75rem',
            border: '1px solid #f87171',
          }}
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
              style={{ fontSize: '0.8rem', color: isSplit ? '#d97706' : '#15803d' }}
            />
          }
          label={
            isSplit
              ? `CONSENSUS: SAFE (SPLIT: ${consensus.votes_safe} Safe / ${consensus.votes_dangerous} Dang)`
              : `CONSENSUS: SAFE (${consensus.votes_safe}/${consensus.total_voted} Votes)`
          }
          size="small"
          sx={{
            bgcolor: isSplit ? '#fef3c7' : '#dcfce7',
            color: isSplit ? '#92400e' : '#166534',
            fontWeight: 800,
            fontSize: '0.75rem',
            border: '1px solid',
            borderColor: isSplit ? '#fcd34d' : '#86efac',
          }}
        />
      );
    }

    return (
      <Chip
        label="NO EVALUATIONS"
        size="small"
        sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 600, fontSize: '0.75rem' }}
      />
    );
  };

  const qwenColors = getScoreColors(qwen_judge.score);
  const gemmaColors = getScoreColors(gemma_judge.score);

  return (
    <Paper
      elevation={1}
      sx={{
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: consensus.consensus_dangerous === true ? '#fca5a5' : consensus.is_disagreement ? '#fde68a' : '#e2e8f0',
        bgcolor: '#ffffff',
        mb: 3,
        overflow: 'hidden',
        transition: 'border-color 0.15s ease',
        '&:hover': {
          borderColor: '#94a3b8',
        },
      }}
    >
      {/* Card Header Bar */}
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          bgcolor: consensus.consensus_dangerous === true ? '#fff5f5' : consensus.is_disagreement ? '#fffbeb' : '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" justifyContent="space-between">
          {/* Metadata badges */}
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={0.5}>
            <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
              #{id + 1}
            </Typography>

            <Chip
              label={`Row ${original_row_index}`}
              size="small"
              sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: '#ffffff', border: '1px solid #cbd5e1' }}
            />

            <Chip
              label={inputs.prompt_language ? inputs.prompt_language.toUpperCase() : 'PT-BR'}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 700,
                bgcolor: inputs.prompt_language === 'en' ? '#e0f2fe' : '#fef3c7',
                color: inputs.prompt_language === 'en' ? '#0369a1' : '#92400e',
              }}
            />

            <Chip
              label={`Style: ${inputs.attack_style || 'plain'}`}
              size="small"
              sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: '#f1f5f9', color: '#334155' }}
            />

            {model_config.model_name && (
              <Chip
                label={model_config.model_name.replace('.gguf', '')}
                size="small"
                sx={{ height: 22, fontSize: '0.7rem', fontWeight: 500, bgcolor: '#f8fafc', color: '#64748b' }}
              />
            )}
          </Stack>

          {/* Right side: Consensus pill badge & Full View button */}
          <Stack direction="row" spacing={1} alignItems="center">
            {renderConsensusBadge()}
            {onInspectRow && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => onInspectRow(row)}
                sx={{
                  height: 24,
                  fontSize: '0.72rem',
                  py: 0,
                  px: 1,
                  textTransform: 'none',
                  color: '#475569',
                  borderColor: '#cbd5e1',
                  bgcolor: '#ffffff',
                  '&:hover': { bgcolor: '#f1f5f9', borderColor: '#94a3b8' },
                }}
              >
                Inspect
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>

      {/* Main Content: Split 2-Column Side-by-Side Grid */}
      <Box sx={{ p: 2.5 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="stretch">
          {/* LEFT COLUMN: Input & Generated Output (48% width) */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* 1. User Prompt Box */}
            <Box
              sx={{
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                bgcolor: '#fafaf9',
                p: 2,
                mb: 2,
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" fontWeight={700} color="#64748b" textTransform="uppercase" letterSpacing="0.05em">
                    Adversarial Input (Prompt)
                  </Typography>
                  <Typography variant="caption" color="#94a3b8">
                    ({(inputs.user_input_raw || inputs.user_prompt || '').length} chars)
                  </Typography>
                </Stack>
                <Tooltip title="Copy prompt to clipboard">
                  <IconButton size="small" onClick={() => handleCopy(inputs.user_input_raw || inputs.user_prompt, 'prompt')}>
                    <FontAwesomeIcon
                      icon={copiedSection === 'prompt' ? faCheck : faCopy}
                      style={{ fontSize: '0.75rem', color: copiedSection === 'prompt' ? '#16a34a' : '#64748b' }}
                    />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Typography
                variant="body2"
                color="#1e293b"
                sx={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'inherit',
                  lineHeight: 1.6,
                  maxHeight: 280,
                  overflowY: 'auto',
                }}
              >
                {inputs.user_input_raw || inputs.user_prompt || '<Empty Prompt>'}
              </Typography>
            </Box>

            {/* 2. Target Model Response Box */}
            <Box
              sx={{
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                bgcolor: '#ffffff',
                p: 2,
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" fontWeight={700} color="#2563eb" textTransform="uppercase" letterSpacing="0.05em">
                    Target Model Response
                  </Typography>
                  {execution_metrics.latency_seconds !== undefined && (
                    <Typography variant="caption" color="#94a3b8">
                      {execution_metrics.latency_seconds.toFixed(2)}s
                    </Typography>
                  )}
                </Stack>
                <Tooltip title="Copy response to clipboard">
                  <IconButton size="small" onClick={() => handleCopy(output.extracted_text, 'response')}>
                    <FontAwesomeIcon
                      icon={copiedSection === 'response' ? faCheck : faCopy}
                      style={{ fontSize: '0.75rem', color: copiedSection === 'response' ? '#16a34a' : '#64748b' }}
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
                  fontFamily: 'inherit',
                  lineHeight: 1.6,
                  maxHeight: 320,
                  overflowY: 'auto',
                }}
              >
                {output.extracted_text || (
                  <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                    {row.error_log?.failed ? `Execution Failed: ${row.error_log.error_message}` : '<Empty Response>'}
                  </span>
                )}
              </Typography>

              {/* Collapsible Chain-of-Thought (if available) */}
              {output.thought_process && (
                <Accordion
                  disableGutters
                  elevation={0}
                  sx={{
                    mt: 1.5,
                    border: '1px solid #e2e8f0',
                    borderRadius: 1.5,
                    bgcolor: '#f8fafc',
                    '&:before': { display: 'none' },
                  }}
                >
                  <AccordionSummary expandIcon={<FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '0.7rem' }} />}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <FontAwesomeIcon icon={faBrain} style={{ color: '#7c3aed', fontSize: '0.8rem' }} />
                      <Typography variant="caption" fontWeight={700} color="#7c3aed">
                        Internal Reasoning Deliberation (&lt;think&gt;)
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    <Typography
                      variant="caption"
                      color="#475569"
                      sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.75rem' }}
                    >
                      {output.thought_process}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              )}
            </Box>
          </Box>

          {/* RIGHT COLUMN: Evaluations Side-by-Side (52% width) */}
          <Box sx={{ flex: 1.1, minWidth: 0 }}>
            <Typography variant="caption" fontWeight={800} color="#475569" textTransform="uppercase" letterSpacing="0.06em" mb={1.5} display="block">
              Multi-Evaluator Assessment (Side-by-Side)
            </Typography>

            <Stack spacing={1.5}>
              {/* 1. LlamaGuard Card */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: llamaguard.status === 'missing' ? '#e2e8f0' : llamaguard.flagged ? '#fca5a5' : '#86efac',
                  bgcolor: llamaguard.status === 'missing' ? '#fafafa' : llamaguard.flagged ? '#fff5f5' : '#f0fdf4',
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FontAwesomeIcon icon={faShieldHalved} style={{ color: '#475569', fontSize: '0.85rem' }} />
                    <Typography variant="subtitle2" fontWeight={700} color="#0f172a">
                      LlamaGuard (Aegis)
                    </Typography>
                  </Stack>

                  {llamaguard.status === 'missing' ? (
                    <Chip label="Not Evaluated" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                  ) : llamaguard.status === 'error' ? (
                    <Chip label="Error" size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />
                  ) : llamaguard.flagged ? (
                    <Chip
                      label="UNSAFE (Dangerous)"
                      size="small"
                      sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 800, fontSize: '0.75rem' }}
                    />
                  ) : (
                    <Chip
                      label="SAFE"
                      size="small"
                      sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 800, fontSize: '0.75rem' }}
                    />
                  )}
                </Stack>

                {llamaguard.flagged_categories && llamaguard.flagged_categories.length > 0 && (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} mt={0.75}>
                    <Typography variant="caption" color="#991b1b" fontWeight={600} mr={0.5}>
                      Violations:
                    </Typography>
                    {llamaguard.flagged_categories.map((cat, i) => (
                      <Chip
                        key={i}
                        label={cat}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#fecaca', color: '#991b1b', fontWeight: 600 }}
                      />
                    ))}
                  </Stack>
                )}

                {llamaguard.error_message && (
                  <Typography variant="caption" color="#dc2626" display="block" mt={0.5}>
                    Error: {llamaguard.error_message}
                  </Typography>
                )}
              </Box>

              {/* 2. Qwen 2.5 32B Abliterated Judge Card */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: qwen_judge.status === 'missing' ? '#e2e8f0' : qwenColors.border,
                  bgcolor: qwen_judge.status === 'missing' ? '#fafafa' : qwenColors.bg,
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FontAwesomeIcon icon={faGavel} style={{ color: '#475569', fontSize: '0.85rem' }} />
                    <Typography variant="subtitle2" fontWeight={700} color="#0f172a">
                      Qwen 2.5 32B Judge
                    </Typography>
                  </Stack>

                  {qwen_judge.status === 'missing' ? (
                    <Chip label="Not Evaluated" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                  ) : qwen_judge.status === 'error' ? (
                    <Chip label="Error" size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />
                  ) : (
                    <Chip
                      label={qwenColors.label}
                      size="small"
                      sx={{
                        bgcolor: qwenColors.bg,
                        color: qwenColors.text,
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        border: `1px solid ${qwenColors.border}`,
                      }}
                    />
                  )}
                </Stack>

                {qwen_judge.reasoning && (
                  <Box
                    sx={{
                      p: 1.25,
                      borderRadius: 1.5,
                      bgcolor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      mt: 1,
                    }}
                  >
                    <Typography variant="caption" color="#334155" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, display: 'block' }}>
                      {qwen_judge.reasoning}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* 3. Gemma 2 27B Abliterated Judge Card */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: gemma_judge.status === 'missing' ? '#e2e8f0' : gemmaColors.border,
                  bgcolor: gemma_judge.status === 'missing' ? '#fafafa' : gemmaColors.bg,
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FontAwesomeIcon icon={faGavel} style={{ color: '#7c3aed', fontSize: '0.85rem' }} />
                    <Typography variant="subtitle2" fontWeight={700} color="#0f172a">
                      Gemma 2 27B Judge
                    </Typography>
                  </Stack>

                  {gemma_judge.status === 'missing' ? (
                    <Chip label="Not Evaluated" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                  ) : gemma_judge.status === 'error' ? (
                    <Chip label="Error" size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />
                  ) : (
                    <Chip
                      label={gemmaColors.label}
                      size="small"
                      sx={{
                        bgcolor: gemmaColors.bg,
                        color: gemmaColors.text,
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        border: `1px solid ${gemmaColors.border}`,
                      }}
                    />
                  )}
                </Stack>

                {gemma_judge.reasoning && (
                  <Box
                    sx={{
                      p: 1.25,
                      borderRadius: 1.5,
                      bgcolor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      mt: 1,
                    }}
                  >
                    <Typography variant="caption" color="#334155" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, display: 'block' }}>
                      {gemma_judge.reasoning}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
}
