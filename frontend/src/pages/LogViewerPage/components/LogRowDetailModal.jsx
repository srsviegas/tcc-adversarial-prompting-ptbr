import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Stack,
    Typography,
    Chip,
    IconButton,
    Tooltip,
    Divider,
    ToggleButtonGroup,
    ToggleButton,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChevronLeft,
    faChevronRight,
    faXmark,
    faCopy,
    faCheck,
    faRobot,
    faBrain,
    faClock,
    faCalculator,
    faTag,
    faSliders,
    faServer,
    faScaleBalanced,
    faDatabase,
    faTerminal,
    faTriangleExclamation,
    faCode,
    faTableList,
} from '@fortawesome/free-solid-svg-icons';
import { getPathValue } from '../utils/columnUtils';
import { getTokenColor } from '../utils/testCaseUtils';

function MetricBadge({ icon, label, value, highlight = false }) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.875,
                bgcolor: highlight ? getTokenColor(typeof value === 'number' ? value : 0).bg : '#f8fafc',
                border: '1px solid',
                borderColor: highlight ? getTokenColor(typeof value === 'number' ? value : 0).border : '#e2e8f0',
                borderRadius: 1.5,
                minWidth: 100,
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
                    {typeof value === 'number' ? value.toLocaleString() : (value || '—')}
                </Typography>
            </Box>
        </Box>
    );
}

function SectionCard({ title, icon, action, children, bgcolor = '#ffffff', borderColor = '#e2e8f0' }) {
    return (
        <Box
            sx={{
                bgcolor,
                border: '1px solid',
                borderColor,
                borderRadius: 2,
                overflow: 'hidden',
            }}
        >
            <Box
                sx={{
                    px: 2,
                    py: 1,
                    bgcolor: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Stack direction="row" alignItems="center" spacing={1}>
                    {icon && <FontAwesomeIcon icon={icon} style={{ fontSize: '0.75rem', color: '#64748b' }} />}
                    <Typography variant="subtitle2" fontWeight={600} color="#334155" fontSize="0.8rem">
                        {title}
                    </Typography>
                </Stack>
                {action}
            </Box>
            <Box sx={{ p: 2 }}>{children}</Box>
        </Box>
    );
}

function CopyableTextCard({ title, icon, text, badge, maxContentHeight = 240, specialStyle = 'default' }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(String(text || ''));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const isThought = specialStyle === 'thought';
    const isCipher = specialStyle === 'cipher';

    const getBgColor = () => {
        if (isThought) return '#faf5ff';
        if (isCipher) return '#f8faff';
        return '#ffffff';
    };

    const getBorderColor = () => {
        if (isThought) return '#e9d5ff';
        if (isCipher) return '#c7d2fe';
        return '#e2e8f0';
    };

    const getHeaderBg = () => {
        if (isThought) return '#f5f3ff';
        if (isCipher) return '#eef2ff';
        return '#f8fafc';
    };

    const getHeaderColor = () => {
        if (isThought) return '#581c87';
        if (isCipher) return '#3730a3';
        return '#334155';
    };

    const getIconColor = () => {
        if (isThought) return '#7c3aed';
        if (isCipher) return '#4f46e5';
        return '#64748b';
    };

    const getTextColor = () => {
        if (isThought) return '#3b0764';
        if (isCipher) return '#312e81';
        return '#1e293b';
    };

    return (
        <Box
            sx={{
                bgcolor: getBgColor(),
                border: '1px solid',
                borderColor: getBorderColor(),
                borderRadius: 2,
                overflow: 'hidden',
            }}
        >
            <Box
                sx={{
                    px: 2,
                    py: 1,
                    bgcolor: getHeaderBg(),
                    borderBottom: '1px solid',
                    borderColor: getBorderColor(),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Stack direction="row" alignItems="center" spacing={1}>
                    {icon && (
                        <FontAwesomeIcon
                            icon={icon}
                            style={{ fontSize: '0.75rem', color: getIconColor() }}
                        />
                    )}
                    <Typography
                        variant="subtitle2"
                        fontWeight={600}
                        color={getHeaderColor()}
                        fontSize="0.8rem"
                    >
                        {title}
                    </Typography>
                    {badge}
                </Stack>
                <Tooltip title={copied ? 'Copied' : `Copy ${title}`}>
                    <IconButton size="small" onClick={handleCopy} sx={{ width: 26, height: 26 }}>
                        <FontAwesomeIcon
                            icon={copied ? faCheck : faCopy}
                            style={{ fontSize: '0.75rem', color: copied ? '#16a34a' : '#64748b' }}
                        />
                    </IconButton>
                </Tooltip>
            </Box>
            <Box
                sx={{
                    p: 2,
                    maxHeight: maxContentHeight,
                    overflow: 'auto',
                }}
            >
                {text ? (
                    <Typography
                        variant="body2"
                        fontSize={isCipher ? '0.78rem' : '0.825rem'}
                        fontFamily={isCipher ? 'monospace' : 'inherit'}
                        color={getTextColor()}
                        lineHeight={1.65}
                        sx={{ whiteSpace: 'pre-wrap', wordBreak: isCipher ? 'break-all' : 'break-word' }}
                    >
                        {text}
                    </Typography>
                ) : (
                    <Typography variant="body2" color="text.secondary" fontStyle="italic" fontSize="0.8rem">
                        Not available
                    </Typography>
                )}
            </Box>
        </Box>
    );
}

export function LogRowDetailModal({
    open,
    onClose,
    row,
    rowIndex = 0,
    totalRows = 0,
    onNavigate,
}) {
    const [viewMode, setViewMode] = useState('structured');
    const [copiedAll, setCopiedAll] = useState(false);

    // Keyboard navigation: Left/Right arrows for previous/next
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowLeft' && rowIndex > 0 && onNavigate) {
                e.preventDefault();
                onNavigate(rowIndex - 1);
            } else if (e.key === 'ArrowRight' && rowIndex < totalRows - 1 && onNavigate) {
                e.preventDefault();
                onNavigate(rowIndex + 1);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, rowIndex, totalRows, onNavigate]);

    if (!row) return null;

    const handleCopyAllJson = () => {
        navigator.clipboard.writeText(JSON.stringify(row, null, 2));
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 1500);
    };

    // Extract core fields
    const userInput = getPathValue(row, 'inputs.user_input_raw') || '';
    const systemPrompt = getPathValue(row, 'inputs.system_prompt') || '';
    const extractedText = getPathValue(row, 'output.extracted_text') || '';
    const cipheredText = getPathValue(row, 'output.ciphered_text') || '';
    const thoughtProcess =
        getPathValue(row, 'output.thought_process') ||
        getPathValue(row, 'thought_process') ||
        getPathValue(row, 'raw_api_payload.candidates.0.content.parts.0.thought') ||
        '';

    const modelName = getPathValue(row, 'model_config.model_name') || '—';
    const latency = getPathValue(row, 'execution_metrics.latency_seconds');
    const inputTokens = getPathValue(row, 'execution_metrics.input_tokens') || 0;
    const outputTokens = getPathValue(row, 'execution_metrics.output_tokens') || 0;
    const totalTokens = getPathValue(row, 'execution_metrics.total_tokens') || 0;
    const finishReason = getPathValue(row, 'output.finish_reason') || '—';
    const language = getPathValue(row, 'inputs.prompt_language') || '—';
    const style = getPathValue(row, 'inputs.attack_style') || '—';
    const attackCategory = getPathValue(row, 'dataset_metadata.attack_category') || '';
    const iteration = getPathValue(row, 'run_metadata.iteration') || '—';
    const failed = getPathValue(row, 'error_log.failed');
    const errorMessage = getPathValue(row, 'error_log.error_message');
    const traceback = getPathValue(row, 'error_log.traceback');

    // Evaluation fields
    const asrHit = getPathValue(row, 'evaluation.attack_success_rate_hit');
    const judgeReasoning = getPathValue(row, 'evaluation.judge_reasoning');
    const evalMethod = getPathValue(row, 'evaluation.eval_method') || getPathValue(row, 'evaluation_result.evaluator');
    const evalDate = getPathValue(row, 'evaluation.eval_date');
    const evalVerdict = getPathValue(row, 'evaluation_result.verdict');
    const evalCategories = getPathValue(row, 'evaluation_result.flagged_categories');
    const evalModel = getPathValue(row, 'evaluation_result.evaluator_model');

    // Model configs
    const temperature = getPathValue(row, 'model_config.temperature');
    const topP = getPathValue(row, 'model_config.top_p');
    const maxTokens = getPathValue(row, 'model_config.max_output_tokens');
    const seed = getPathValue(row, 'model_config.seed');

    // Run metadata & Environment
    const runId = getPathValue(row, 'run_metadata.run_id');
    const timestampUtc = getPathValue(row, 'run_metadata.timestamp_utc');
    const envOs = getPathValue(row, 'run_metadata.environment.os');
    const envGpu = getPathValue(row, 'run_metadata.environment.gpu');
    const envFramework = getPathValue(row, 'run_metadata.environment.framework');
    const envExecutionType = getPathValue(row, 'run_metadata.environment.execution_type');

    // Dataset metadata
    const sourceDataset = getPathValue(row, 'dataset_metadata.source_dataset');
    const originalRowIndex = getPathValue(row, 'dataset_metadata.original_row_index');
    const baselineRefusal = getPathValue(row, 'dataset_metadata.baseline_refusal_en');
    const baselineJailbreak = getPathValue(row, 'dataset_metadata.baseline_jailbreak_en');

    // Discover any additional top-level keys not handled explicitly
    const knownKeys = new Set([
        'id',
        'run_metadata',
        'dataset_metadata',
        'inputs',
        'model_config',
        'execution_metrics',
        'output',
        'thought_process',
        'error_log',
        'evaluation',
        'raw_api_payload',
    ]);
    const extraKeys = Object.keys(row).filter((k) => !knownKeys.has(k));

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    maxHeight: '90vh',
                },
            }}
        >
            {/* Header */}
            <DialogTitle sx={{ p: 2.5, pb: 1.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                        <Typography variant="h6" fontWeight={700} color="#0f172a" fontSize="1.1rem">
                            Log Entry #{row.id !== undefined ? row.id : rowIndex}
                        </Typography>

                        {attackCategory && (
                            <Chip
                                label={attackCategory}
                                size="small"
                                sx={{
                                    bgcolor: '#f1f5f9',
                                    color: '#334155',
                                    fontWeight: 600,
                                    fontSize: '0.725rem',
                                    border: '1px solid #e2e8f0',
                                }}
                            />
                        )}

                        <Chip
                            label={language === 'pt-BR' || language === 'pt' ? 'PT-BR' : 'EN'}
                            size="small"
                            sx={{
                                bgcolor: language.startsWith('pt') ? '#dcfce7' : '#dbeafe',
                                color: language.startsWith('pt') ? '#166534' : '#1e40af',
                                fontWeight: 600,
                                fontSize: '0.725rem',
                            }}
                        />

                        <Chip
                            label={style}
                            size="small"
                            sx={{
                                bgcolor: '#f1f5f9',
                                color: '#475569',
                                fontWeight: 600,
                                fontSize: '0.725rem',
                            }}
                        />

                        <Chip
                            label={`Iter ${iteration}`}
                            size="small"
                            sx={{
                                bgcolor: '#f1f5f9',
                                color: '#475569',
                                fontWeight: 600,
                                fontSize: '0.725rem',
                            }}
                        />

                        {asrHit === true && (
                            <Chip
                                label="ASR Hit (Harmful)"
                                size="small"
                                sx={{
                                    bgcolor: '#fee2e2',
                                    color: '#991b1b',
                                    fontWeight: 700,
                                    fontSize: '0.725rem',
                                    border: '1px solid #fecaca',
                                }}
                            />
                        )}

                        {asrHit === false && (
                            <Chip
                                label="Safe (Defended)"
                                size="small"
                                sx={{
                                    bgcolor: '#ecfdf5',
                                    color: '#065f46',
                                    fontWeight: 700,
                                    fontSize: '0.725rem',
                                    border: '1px solid #a7f3d0',
                                }}
                            />
                        )}

                        {failed && (
                            <Chip
                                label="Error Failed"
                                size="small"
                                sx={{
                                    bgcolor: '#fef2f2',
                                    color: '#dc2626',
                                    fontWeight: 700,
                                    fontSize: '0.725rem',
                                    border: '1px solid #fecaca',
                                }}
                            />
                        )}

                        {thoughtProcess && (
                            <Chip
                                icon={
                                    <FontAwesomeIcon
                                        icon={faBrain}
                                        style={{ fontSize: '0.65rem', color: '#7c3aed' }}
                                    />
                                }
                                label="Has Reasoning"
                                size="small"
                                sx={{
                                    bgcolor: '#f5f3ff',
                                    color: '#6d28d9',
                                    fontWeight: 600,
                                    fontSize: '0.725rem',
                                    border: '1px solid #ddd6fe',
                                    '& .MuiChip-icon': { ml: '4px', mr: '-2px' },
                                }}
                            />
                        )}
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={1}>
                        <ToggleButtonGroup
                            value={viewMode}
                            exclusive
                            onChange={(_, val) => {
                                if (val) setViewMode(val);
                            }}
                            size="small"
                            sx={{
                                height: 30,
                                bgcolor: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                borderRadius: 1.5,
                                p: 0.25,
                                '& .MuiToggleButton-root': {
                                    border: 'none',
                                    borderRadius: '4px !important',
                                    px: 1.5,
                                    py: 0.25,
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    color: '#64748b',
                                    textTransform: 'none',
                                    '&.Mui-selected': {
                                        bgcolor: '#ffffff',
                                        color: '#0f172a',
                                        fontWeight: 600,
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                                    },
                                },
                            }}
                        >
                            <ToggleButton value="structured">
                                <FontAwesomeIcon icon={faTableList} style={{ fontSize: '0.7rem', marginRight: 5 }} />
                                Structured
                            </ToggleButton>
                            <ToggleButton value="raw">
                                <FontAwesomeIcon icon={faCode} style={{ fontSize: '0.7rem', marginRight: 5 }} />
                                Raw JSON
                            </ToggleButton>
                        </ToggleButtonGroup>

                        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
                            <FontAwesomeIcon icon={faXmark} />
                        </IconButton>
                    </Stack>
                </Stack>
            </DialogTitle>

            <Divider />

            {/* Content */}
            <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
                {viewMode === 'structured' ? (
                    <Stack spacing={2.5}>
                        {/* Metrics Bar */}
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <MetricBadge icon={faCalculator} label="Output Tokens" value={outputTokens} highlight />
                            <MetricBadge icon={faCalculator} label="Input Tokens" value={inputTokens} />
                            <MetricBadge icon={faCalculator} label="Total Tokens" value={totalTokens} />
                            <MetricBadge
                                icon={faClock}
                                label="Latency"
                                value={latency !== null && latency !== undefined ? `${latency.toFixed(2)}s` : '—'}
                            />
                            <MetricBadge icon={faTag} label="Finish Reason" value={finishReason} />
                            <MetricBadge icon={faRobot} label="Model" value={modelName} />
                        </Stack>

                        {/* Error alert if failed */}
                        {(failed || errorMessage) && (
                            <Box
                                sx={{
                                    p: 2,
                                    bgcolor: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    borderRadius: 2,
                                }}
                            >
                                <Stack direction="row" alignItems="center" spacing={1} mb={0.75}>
                                    <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: '#dc2626', fontSize: '0.85rem' }} />
                                    <Typography variant="subtitle2" fontWeight={700} color="#dc2626" fontSize="0.85rem">
                                        Execution Error
                                    </Typography>
                                </Stack>
                                <Typography
                                    variant="body2"
                                    fontSize="0.8rem"
                                    color="#991b1b"
                                    sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                >
                                    {errorMessage || 'Unknown error occurred during execution'}
                                </Typography>
                                {traceback && (
                                    <Box
                                        component="pre"
                                        sx={{
                                            mt: 1.5,
                                            p: 1.5,
                                            bgcolor: '#ffffff',
                                            borderRadius: 1,
                                            fontSize: '0.725rem',
                                            color: '#b91c1c',
                                            overflow: 'auto',
                                            maxHeight: 160,
                                        }}
                                    >
                                        {traceback}
                                    </Box>
                                )}
                            </Box>
                        )}

                        {/* Prompts: User input + optional System prompt */}
                        <CopyableTextCard
                            title="User Prompt"
                            icon={faTerminal}
                            text={userInput}
                            maxContentHeight={160}
                            badge={
                                userInput ? (
                                    <Typography variant="caption" color="text.secondary" fontSize="0.7rem">
                                        {userInput.length} chars
                                    </Typography>
                                ) : null
                            }
                        />

                        {systemPrompt && (
                            <CopyableTextCard
                                title="System Prompt"
                                icon={faTerminal}
                                text={systemPrompt}
                                maxContentHeight={120}
                            />
                        )}

                        {/* Thought Process (When available!) */}
                        {thoughtProcess && (
                            <CopyableTextCard
                                title="Thought Process"
                                icon={faBrain}
                                text={thoughtProcess}
                                specialStyle="thought"
                                maxContentHeight={280}
                                badge={
                                    <Stack direction="row" spacing={0.75} alignItems="center">
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
                                }
                            />
                        )}

                        {/* Ciphered Response (Raw Model Output when available) */}
                        {cipheredText && (
                            <CopyableTextCard
                                title="Ciphered Response (Raw Model Output)"
                                icon={faCode}
                                text={cipheredText}
                                specialStyle="cipher"
                                maxContentHeight={240}
                                badge={
                                    <Stack direction="row" spacing={0.75} alignItems="center">
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
                                }
                            />
                        )}

                        {/* Model Output / Response */}
                        <CopyableTextCard
                            title={cipheredText ? "Model Response (Decoded Plaintext)" : "Model Response"}
                            icon={faRobot}
                            text={extractedText}
                            maxContentHeight={360}
                            badge={
                                extractedText ? (
                                    <Stack direction="row" spacing={0.75} alignItems="center">
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
                                        <Typography variant="caption" color="text.secondary" fontSize="0.7rem">
                                            {extractedText.trim().split(/\s+/).length} words · {extractedText.length} chars
                                        </Typography>
                                    </Stack>
                                ) : null
                            }
                        />

                        {/* Evaluation / Safety Judge */}
                        {(evalMethod || asrHit !== null || judgeReasoning || evalVerdict) && (
                            <SectionCard
                                title="Evaluation & Safety Judge"
                                icon={faScaleBalanced}
                                action={
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        {evalMethod && (
                                            <Chip
                                                label={`Evaluator: ${evalMethod}${evalModel ? ` (${evalModel})` : ''}`}
                                                size="small"
                                                sx={{ height: 20, fontSize: '0.675rem', fontWeight: 500 }}
                                            />
                                        )}
                                        {evalDate && (
                                            <Typography variant="caption" color="text.secondary" fontSize="0.7rem">
                                                {evalDate}
                                            </Typography>
                                        )}
                                    </Stack>
                                }
                            >
                                <Stack spacing={1.5}>
                                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                                        <Typography variant="body2" color="text.secondary" fontSize="0.8rem">
                                            Evaluation Verdict:
                                        </Typography>
                                        {(asrHit === true || evalVerdict === 'unsafe') ? (
                                            <Chip
                                                label="Harmful / Successful Jailbreak (ASR Hit)"
                                                size="small"
                                                sx={{
                                                    bgcolor: '#fee2e2',
                                                    color: '#991b1b',
                                                    fontWeight: 700,
                                                    fontSize: '0.75rem',
                                                }}
                                            />
                                        ) : (asrHit === false || evalVerdict === 'safe') ? (
                                            <Chip
                                                label="Defended / Safe Response"
                                                size="small"
                                                sx={{
                                                    bgcolor: '#ecfdf5',
                                                    color: '#065f46',
                                                    fontWeight: 700,
                                                    fontSize: '0.75rem',
                                                }}
                                            />
                                        ) : (
                                            <Chip label="Pending / Unassigned" size="small" sx={{ fontSize: '0.75rem' }} />
                                        )}

                                        {evalCategories && (
                                            <Stack direction="row" spacing={0.75} alignItems="center">
                                                <Typography variant="caption" color="text.secondary" fontSize="0.75rem">
                                                    Categories:
                                                </Typography>
                                                <Chip
                                                    label={evalCategories}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: '#fff7ed',
                                                        color: '#c2410c',
                                                        border: '1px solid #fed7aa',
                                                        fontSize: '0.725rem',
                                                        fontWeight: 600,
                                                    }}
                                                />
                                            </Stack>
                                        )}
                                    </Stack>

                                    {judgeReasoning && (
                                        <Box>
                                            <Typography variant="caption" fontWeight={600} color="text.secondary" fontSize="0.725rem" mb={0.5} display="block">
                                                Judge Reasoning:
                                            </Typography>
                                            <Box
                                                sx={{
                                                    p: 1.5,
                                                    bgcolor: '#f8fafc',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: 1.5,
                                                    maxHeight: 160,
                                                    overflow: 'auto',
                                                }}
                                            >
                                                <Typography variant="body2" fontSize="0.8rem" color="#334155" sx={{ whiteSpace: 'pre-wrap' }}>
                                                    {judgeReasoning}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    )}
                                </Stack>
                            </SectionCard>
                        )}

                        {/* Dataset & Baselines */}
                        {(sourceDataset || baselineRefusal || baselineJailbreak || originalRowIndex !== undefined) && (
                            <SectionCard title="Dataset Metadata & Baselines" icon={faDatabase}>
                                <Stack spacing={1.5}>
                                    <Stack direction="row" spacing={3} flexWrap="wrap">
                                        {originalRowIndex !== undefined && (
                                            <Typography variant="body2" fontSize="0.8rem" color="#475569">
                                                <strong>Original Row:</strong> #{originalRowIndex}
                                            </Typography>
                                        )}
                                        {sourceDataset && (
                                            <Typography variant="body2" fontSize="0.8rem" color="#475569" sx={{ wordBreak: 'break-all' }}>
                                                <strong>Source:</strong> {sourceDataset}
                                            </Typography>
                                        )}
                                    </Stack>

                                    {baselineRefusal && (
                                        <Box>
                                            <Typography variant="caption" fontWeight={600} color="text.secondary" fontSize="0.725rem" mb={0.5} display="block">
                                                Baseline Refusal (EN):
                                            </Typography>
                                            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5, maxHeight: 100, overflow: 'auto' }}>
                                                <Typography variant="body2" fontSize="0.775rem" color="#334155" sx={{ whiteSpace: 'pre-wrap' }}>
                                                    {baselineRefusal}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    )}

                                    {baselineJailbreak && (
                                        <Box>
                                            <Typography variant="caption" fontWeight={600} color="text.secondary" fontSize="0.725rem" mb={0.5} display="block">
                                                Baseline Jailbreak (EN):
                                            </Typography>
                                            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5, maxHeight: 120, overflow: 'auto' }}>
                                                <Typography variant="body2" fontSize="0.775rem" color="#334155" sx={{ whiteSpace: 'pre-wrap' }}>
                                                    {baselineJailbreak}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    )}
                                </Stack>
                            </SectionCard>
                        )}

                        {/* Model Configuration & Environment */}
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            <Box flex={1}>
                                <SectionCard title="Model Configuration" icon={faSliders}>
                                    <Stack spacing={1}>
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="caption" color="text.secondary">Model Name:</Typography>
                                            <Typography variant="caption" fontWeight={600} color="#0f172a">{modelName}</Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="caption" color="text.secondary">Temperature:</Typography>
                                            <Typography variant="caption" fontWeight={600} color="#0f172a">{temperature !== undefined ? temperature : '—'}</Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="caption" color="text.secondary">Top P:</Typography>
                                            <Typography variant="caption" fontWeight={600} color="#0f172a">{topP !== undefined ? topP : '—'}</Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="caption" color="text.secondary">Max Output Tokens:</Typography>
                                            <Typography variant="caption" fontWeight={600} color="#0f172a">{maxTokens || '—'}</Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="caption" color="text.secondary">Seed:</Typography>
                                            <Typography variant="caption" fontWeight={600} color="#0f172a">{seed !== null && seed !== undefined ? seed : 'None'}</Typography>
                                        </Stack>
                                    </Stack>
                                </SectionCard>
                            </Box>

                            <Box flex={1}>
                                <SectionCard title="Environment & Run Metadata" icon={faServer}>
                                    <Stack spacing={1}>
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="caption" color="text.secondary">Run ID:</Typography>
                                            <Typography variant="caption" fontWeight={600} color="#0f172a" sx={{ wordBreak: 'break-all' }}>{runId || '—'}</Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="caption" color="text.secondary">Timestamp (UTC):</Typography>
                                            <Typography variant="caption" fontWeight={600} color="#0f172a">{timestampUtc || '—'}</Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="caption" color="text.secondary">OS:</Typography>
                                            <Typography variant="caption" fontWeight={600} color="#0f172a">{envOs || '—'}</Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="caption" color="text.secondary">GPU:</Typography>
                                            <Typography variant="caption" fontWeight={600} color="#0f172a">{envGpu || '—'}</Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="caption" color="text.secondary">Framework / Type:</Typography>
                                            <Typography variant="caption" fontWeight={600} color="#0f172a">{envFramework || envExecutionType || '—'}</Typography>
                                        </Stack>
                                    </Stack>
                                </SectionCard>
                            </Box>
                        </Stack>

                        {/* Extra fields if any */}
                        {extraKeys.length > 0 && (
                            <SectionCard title="Additional Fields" icon={faTag}>
                                <Stack spacing={1}>
                                    {extraKeys.map((k) => (
                                        <Box key={k}>
                                            <Typography variant="caption" fontWeight={600} color="text.secondary" fontSize="0.75rem">
                                                {k}:
                                            </Typography>
                                            <Box
                                                component="pre"
                                                sx={{
                                                    mt: 0.5,
                                                    p: 1,
                                                    bgcolor: '#f8fafc',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: 1,
                                                    fontSize: '0.75rem',
                                                    overflow: 'auto',
                                                    maxHeight: 120,
                                                }}
                                            >
                                                {typeof row[k] === 'object' ? JSON.stringify(row[k], null, 2) : String(row[k])}
                                            </Box>
                                        </Box>
                                    ))}
                                </Stack>
                            </SectionCard>
                        )}
                    </Stack>
                ) : (
                    /* Raw JSON View */
                    <Box sx={{ position: 'relative' }}>
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 12,
                                right: 12,
                                zIndex: 2,
                            }}
                        >
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={handleCopyAllJson}
                                startIcon={
                                    <FontAwesomeIcon
                                        icon={copiedAll ? faCheck : faCopy}
                                        style={{ color: copiedAll ? '#16a34a' : 'inherit' }}
                                    />
                                }
                                sx={{
                                    bgcolor: '#ffffff',
                                    '&:hover': { bgcolor: '#f8fafc' },
                                    fontSize: '0.75rem',
                                }}
                            >
                                {copiedAll ? 'Copied' : 'Copy JSON'}
                            </Button>
                        </Box>
                        <Box
                            component="pre"
                            sx={{
                                m: 0,
                                p: 2.5,
                                bgcolor: '#0f172a',
                                color: '#e2e8f0',
                                borderRadius: 2,
                                fontSize: '0.8rem',
                                lineHeight: 1.5,
                                fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                                overflow: 'auto',
                                maxHeight: '60vh',
                            }}
                        >
                            <code>{JSON.stringify(row, null, 2)}</code>
                        </Box>
                    </Box>
                )}
            </DialogContent>

            <Divider />

            {/* Footer Navigation */}
            <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between', bgcolor: '#ffffff' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                        size="small"
                        variant="outlined"
                        disabled={rowIndex <= 0}
                        onClick={() => onNavigate && onNavigate(rowIndex - 1)}
                        startIcon={<FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: '0.75rem' }} />}
                    >
                        Previous
                    </Button>
                    <Button
                        size="small"
                        variant="outlined"
                        disabled={rowIndex >= totalRows - 1}
                        onClick={() => onNavigate && onNavigate(rowIndex + 1)}
                        endIcon={<FontAwesomeIcon icon={faChevronRight} style={{ fontSize: '0.75rem' }} />}
                    >
                        Next
                    </Button>
                </Stack>

                <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    {rowIndex + 1} of {totalRows}
                </Typography>

                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={handleCopyAllJson}
                        startIcon={
                            <FontAwesomeIcon
                                icon={copiedAll ? faCheck : faCopy}
                                style={{ color: copiedAll ? '#16a34a' : 'inherit' }}
                            />
                        }
                    >
                        {copiedAll ? 'Copied JSON' : 'Copy JSON'}
                    </Button>
                    <Button onClick={onClose} variant="contained" size="small" sx={{ minWidth: 80, fontWeight: 600 }}>
                        Close
                    </Button>
                </Stack>
            </DialogActions>
        </Dialog>
    );
}
