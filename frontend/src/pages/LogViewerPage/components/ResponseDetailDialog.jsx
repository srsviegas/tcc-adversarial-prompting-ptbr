import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Typography,
    IconButton,
    Stack,
    Chip,
    Divider,
    Button,
    Tooltip,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faXmark,
    faRobot,
    faClock,
    faCalculator,
    faTag,
    faBrain,
    faCopy,
    faCheck,
    faCode,
} from '@fortawesome/free-solid-svg-icons';
import { getPathValue } from '../utils/columnUtils';
import { getTokenColor } from '../utils/testCaseUtils';

function MetricItem({ icon, label, value, highlight }) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 1,
                bgcolor: highlight ? getTokenColor(typeof value === 'number' ? value : 0).bg : '#f8fafc',
                border: '1px solid',
                borderColor: highlight ? getTokenColor(typeof value === 'number' ? value : 0).border : '#e2e8f0',
                borderRadius: 1.5,
            }}
        >
            <FontAwesomeIcon icon={icon} style={{ fontSize: '0.75rem', color: '#64748b' }} />
            <Box>
                <Typography variant="caption" color="text.secondary" fontSize="0.675rem" lineHeight={1} display="block">
                    {label}
                </Typography>
                <Typography
                    variant="body2"
                    fontWeight={600}
                    fontSize="0.825rem"
                    color={highlight && typeof value === 'number' ? getTokenColor(value).text : '#0f172a'}
                >
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </Typography>
            </Box>
        </Box>
    );
}

function extractThoughtProcess(entry) {
    if (!entry) return '';

    // 1. Direct fields in log output or root
    const direct =
        getPathValue(entry, 'output.thought_process') ||
        getPathValue(entry, 'thought_process') ||
        getPathValue(entry, 'raw_api_payload.candidates.0.content.parts.0.thought');

    if (direct && typeof direct === 'string' && direct.trim()) {
        return direct.trim();
    }

    // 2. Check for <think>...</think> tags in raw responses or payload choices
    const candidates = [
        getPathValue(entry, 'output.raw_response'),
        getPathValue(entry, 'raw_api_payload.choices.0.message.content'),
        getPathValue(entry, 'output.extracted_text'),
    ];

    for (const text of candidates) {
        if (typeof text === 'string' && text.includes('<think>')) {
            const match = text.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
            if (match && match[1] && match[1].trim()) {
                return match[1].trim();
            }
        }
    }

    return '';
}

export function ResponseDetailDialog({ open, onClose, entry }) {
    const [copiedPrompt, setCopiedPrompt] = useState(false);
    const [copiedThought, setCopiedThought] = useState(false);
    const [copiedResponse, setCopiedResponse] = useState(false);
    const [copiedCipher, setCopiedCipher] = useState(false);

    if (!entry) return null;

    let extractedText = getPathValue(entry, 'output.extracted_text') || '';
    const cipheredText = getPathValue(entry, 'output.ciphered_text') || '';
    const thoughtProcess = extractThoughtProcess(entry);

    // If extracted_text still contains <think> tags, strip them for the response display
    if (extractedText && extractedText.includes('<think>')) {
        extractedText = extractedText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    }

    const modelName = getPathValue(entry, 'model_config.model_name') || '—';
    const latency = getPathValue(entry, 'execution_metrics.latency_seconds');
    const inputTokens = getPathValue(entry, 'execution_metrics.input_tokens') || 0;
    const outputTokens = getPathValue(entry, 'execution_metrics.output_tokens') || 0;
    const totalTokens = getPathValue(entry, 'execution_metrics.total_tokens') || 0;
    const finishReason = getPathValue(entry, 'output.finish_reason') || '—';
    const language = getPathValue(entry, 'inputs.prompt_language') || '—';
    const style = getPathValue(entry, 'inputs.attack_style') || '—';
    const iteration = getPathValue(entry, 'run_metadata.iteration') || '—';
    const failed = getPathValue(entry, 'error_log.failed');
    const errorMessage = getPathValue(entry, 'error_log.error_message');
    const userInput = getPathValue(entry, 'inputs.user_input_raw') || '';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    maxHeight: '85vh',
                },
            }}
        >
            <DialogTitle sx={{ pb: 1.5, pt: 2.5, px: 3 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                borderRadius: 2,
                                bgcolor: '#f1f5f9',
                                color: '#334155',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <FontAwesomeIcon icon={faRobot} style={{ fontSize: '0.9rem' }} />
                        </Box>
                        <Box>
                            <Typography variant="h6" fontWeight={700} fontSize="1.05rem" color="#0f172a" lineHeight={1.2}>
                                Response Detail
                            </Typography>
                            <Stack direction="row" spacing={0.75} mt={0.25} alignItems="center" flexWrap="wrap">
                                <Chip label={language} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#f1f5f9', color: '#475569' }} />
                                <Chip label={style} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#f1f5f9', color: '#475569' }} />
                                <Chip label={`Iter ${iteration}`} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#f1f5f9', color: '#475569' }} />
                                {thoughtProcess && (
                                    <Chip
                                        icon={<FontAwesomeIcon icon={faBrain} style={{ fontSize: '0.6rem', color: '#7c3aed' }} />}
                                        label="Has Reasoning"
                                        size="small"
                                        sx={{
                                            height: 18,
                                            fontSize: '0.65rem',
                                            fontWeight: 600,
                                            bgcolor: '#f5f3ff',
                                            color: '#6d28d9',
                                            border: '1px solid #ddd6fe',
                                            '& .MuiChip-icon': { ml: '4px', mr: '-2px' },
                                        }}
                                    />
                                )}
                            </Stack>
                        </Box>
                    </Stack>
                    <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
                        <FontAwesomeIcon icon={faXmark} />
                    </IconButton>
                </Stack>
            </DialogTitle>

            <Divider />

            <DialogContent sx={{ p: 3 }}>
                <Stack spacing={2.5}>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <MetricItem icon={faCalculator} label="Output Tokens" value={outputTokens} highlight />
                        <MetricItem icon={faCalculator} label="Input Tokens" value={inputTokens} />
                        <MetricItem icon={faCalculator} label="Total Tokens" value={totalTokens} />
                        <MetricItem icon={faClock} label="Latency" value={latency !== null && latency !== undefined ? `${latency.toFixed(2)}s` : '—'} />
                        <MetricItem icon={faTag} label="Finish Reason" value={finishReason} />
                        <MetricItem icon={faRobot} label="Model" value={modelName} />
                    </Stack>

                    {failed && (
                        <Box
                            sx={{
                                p: 2,
                                bgcolor: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: 2,
                            }}
                        >
                            <Typography variant="subtitle2" fontWeight={700} color="#dc2626" fontSize="0.8rem" mb={0.5}>
                                Error
                            </Typography>
                            <Typography variant="body2" fontSize="0.8rem" color="#991b1b" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {errorMessage || 'Unknown error'}
                            </Typography>
                        </Box>
                    )}

                    {userInput && (
                        <Box>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                                <Typography variant="subtitle2" fontWeight={700} color="#0f172a" fontSize="0.8rem">
                                    Prompt
                                </Typography>
                                <Tooltip title={copiedPrompt ? 'Copied' : 'Copy prompt'}>
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            navigator.clipboard.writeText(userInput);
                                            setCopiedPrompt(true);
                                            setTimeout(() => setCopiedPrompt(false), 1500);
                                        }}
                                        sx={{ width: 24, height: 24 }}
                                    >
                                        <FontAwesomeIcon
                                            icon={copiedPrompt ? faCheck : faCopy}
                                            style={{ fontSize: '0.75rem', color: copiedPrompt ? '#16a34a' : '#64748b' }}
                                        />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                            <Box
                                sx={{
                                    p: 2,
                                    bgcolor: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 2,
                                    maxHeight: 120,
                                    overflow: 'auto',
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    fontSize="0.8rem"
                                    color="#334155"
                                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                >
                                    {userInput}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {/* Thought Process / Reasoning Trace */}
                    {thoughtProcess && (
                        <Box>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Box
                                        sx={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: 1,
                                            bgcolor: '#f5f3ff',
                                            color: '#7c3aed',
                                            border: '1px solid #ddd6fe',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <FontAwesomeIcon icon={faBrain} style={{ fontSize: '0.7rem' }} />
                                    </Box>
                                    <Typography variant="subtitle2" fontWeight={700} color="#0f172a" fontSize="0.8rem">
                                        Thought Process
                                    </Typography>
                                    <Chip
                                        label="Reasoning Trace"
                                        size="small"
                                        sx={{
                                            height: 18,
                                            fontSize: '0.625rem',
                                            fontWeight: 600,
                                            bgcolor: '#f5f3ff',
                                            color: '#6d28d9',
                                            border: '1px solid #ddd6fe',
                                        }}
                                    />
                                    <Typography variant="caption" color="#7c3aed" fontSize="0.7rem" fontWeight={500}>
                                        {thoughtProcess.trim().split(/\s+/).length} words · {thoughtProcess.length} chars
                                    </Typography>
                                </Stack>
                                <Tooltip title={copiedThought ? 'Copied' : 'Copy thought process'}>
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            navigator.clipboard.writeText(thoughtProcess);
                                            setCopiedThought(true);
                                            setTimeout(() => setCopiedThought(false), 1500);
                                        }}
                                        sx={{ width: 24, height: 24 }}
                                    >
                                        <FontAwesomeIcon
                                            icon={copiedThought ? faCheck : faCopy}
                                            style={{ fontSize: '0.75rem', color: copiedThought ? '#16a34a' : '#64748b' }}
                                        />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                            <Box
                                sx={{
                                    p: 2,
                                    bgcolor: '#faf5ff',
                                    border: '1px solid #e9d5ff',
                                    borderRadius: 2,
                                    maxHeight: 260,
                                    overflow: 'auto',
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    fontSize="0.8rem"
                                    color="#3b0764"
                                    lineHeight={1.65}
                                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                >
                                    {thoughtProcess}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {/* Ciphered Response (When available!) */}
                    {cipheredText && (
                        <Box>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Box
                                        sx={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: 1,
                                            bgcolor: '#eef2ff',
                                            color: '#4f46e5',
                                            border: '1px solid #c7d2fe',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <FontAwesomeIcon icon={faCode} style={{ fontSize: '0.7rem' }} />
                                    </Box>
                                    <Typography variant="subtitle2" fontWeight={700} color="#0f172a" fontSize="0.8rem">
                                        Ciphered Response (Raw Model Output)
                                    </Typography>
                                    <Chip
                                        label="Cipher Text"
                                        size="small"
                                        sx={{
                                            height: 18,
                                            fontSize: '0.625rem',
                                            fontWeight: 600,
                                            bgcolor: '#eef2ff',
                                            color: '#4338ca',
                                            border: '1px solid #c7d2fe',
                                        }}
                                    />
                                    <Typography variant="caption" color="#4338ca" fontSize="0.7rem" fontWeight={500}>
                                        {cipheredText.length} chars
                                    </Typography>
                                </Stack>
                                <Tooltip title={copiedCipher ? 'Copied' : 'Copy ciphered response'}>
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            navigator.clipboard.writeText(cipheredText);
                                            setCopiedCipher(true);
                                            setTimeout(() => setCopiedCipher(false), 1500);
                                        }}
                                        sx={{ width: 24, height: 24 }}
                                    >
                                        <FontAwesomeIcon
                                            icon={copiedCipher ? faCheck : faCopy}
                                            style={{ fontSize: '0.75rem', color: copiedCipher ? '#16a34a' : '#64748b' }}
                                        />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                            <Box
                                sx={{
                                    p: 2,
                                    bgcolor: '#f8faff',
                                    border: '1px solid #c7d2fe',
                                    borderRadius: 2,
                                    maxHeight: 240,
                                    overflow: 'auto',
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    fontSize="0.78rem"
                                    fontFamily="monospace"
                                    color="#312e81"
                                    lineHeight={1.65}
                                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                                >
                                    {cipheredText}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    <Box>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography variant="subtitle2" fontWeight={700} color="#0f172a" fontSize="0.8rem">
                                    {cipheredText ? 'Response (Decoded Plaintext)' : 'Response'}
                                </Typography>
                                {cipheredText && (
                                    <Chip
                                        label="Algorithmic Decoded"
                                        size="small"
                                        sx={{
                                            height: 18,
                                            fontSize: '0.625rem',
                                            fontWeight: 600,
                                            bgcolor: '#ecfdf5',
                                            color: '#047857',
                                            border: '1px solid #a7f3d0',
                                        }}
                                    />
                                )}
                            </Stack>
                            {extractedText && (
                                <Tooltip title={copiedResponse ? 'Copied' : 'Copy response'}>
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            navigator.clipboard.writeText(extractedText);
                                            setCopiedResponse(true);
                                            setTimeout(() => setCopiedResponse(false), 1500);
                                        }}
                                        sx={{ width: 24, height: 24 }}
                                    >
                                        <FontAwesomeIcon
                                            icon={copiedResponse ? faCheck : faCopy}
                                            style={{ fontSize: '0.75rem', color: copiedResponse ? '#16a34a' : '#64748b' }}
                                        />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Stack>
                        <Box
                            sx={{
                                p: 2.5,
                                bgcolor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 2,
                                maxHeight: 380,
                                overflow: 'auto',
                            }}
                        >
                            {extractedText ? (
                                <Typography
                                    variant="body2"
                                    fontSize="0.825rem"
                                    color="#1e293b"
                                    lineHeight={1.7}
                                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                >
                                    {extractedText}
                                </Typography>
                            ) : (
                                <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                    No response text available.
                                </Typography>
                            )}
                        </Box>
                    </Box>
                </Stack>
            </DialogContent>

            <Divider />

            <DialogActions sx={{ px: 3, py: 1.5, bgcolor: '#f8fafc' }}>
                <Button variant="contained" onClick={onClose} sx={{ minWidth: 80, fontWeight: 600 }}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}
