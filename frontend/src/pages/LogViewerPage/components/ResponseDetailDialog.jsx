import React from 'react';
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
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faRobot, faClock, faCalculator, faTag } from '@fortawesome/free-solid-svg-icons';
import { getPathValue } from '../utils/columnUtils';
import { getTokenColor, getTokenLabel } from '../utils/testCaseUtils';

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

export function ResponseDetailDialog({ open, onClose, entry }) {
    if (!entry) return null;

    const extractedText = getPathValue(entry, 'output.extracted_text') || '';
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
                            <Stack direction="row" spacing={0.75} mt={0.25}>
                                <Chip label={language} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#f1f5f9', color: '#475569' }} />
                                <Chip label={style} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#f1f5f9', color: '#475569' }} />
                                <Chip label={`Iter ${iteration}`} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#f1f5f9', color: '#475569' }} />
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
                            <Typography variant="subtitle2" fontWeight={700} color="#0f172a" fontSize="0.8rem" mb={1}>
                                Prompt
                            </Typography>
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

                    <Box>
                        <Typography variant="subtitle2" fontWeight={700} color="#0f172a" fontSize="0.8rem" mb={1}>
                            Response
                        </Typography>
                        <Box
                            sx={{
                                p: 2.5,
                                bgcolor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 2,
                                maxHeight: 400,
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
