import React, { useState, useMemo } from 'react';
import { Box, Typography, Stack, Chip, IconButton, Collapse, Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faHashtag, faDatabase } from '@fortawesome/free-solid-svg-icons';
import { getPathValue } from '../utils/columnUtils';
import { getTokenColor } from '../utils/testCaseUtils';
import { VariantComparisonGrid } from './VariantComparisonGrid';

function TokenHeatmapDots({ entries }) {
    const dots = useMemo(() => {
        return entries.map((entry, i) => {
            const outTokens = getPathValue(entry, 'execution_metrics.output_tokens') || 0;
            const colors = getTokenColor(outTokens);
            return (
                <Tooltip
                    key={i}
                    title={`${outTokens} tokens | ${getPathValue(entry, 'inputs.prompt_language')} / ${getPathValue(entry, 'inputs.attack_style')} / iter ${getPathValue(entry, 'run_metadata.iteration')}`}
                    arrow
                    placement="top"
                >
                    <Box
                        sx={{
                            width: 14,
                            height: 14,
                            borderRadius: '3px',
                            bgcolor: colors.bg,
                            border: '1px solid',
                            borderColor: colors.border,
                            flexShrink: 0,
                            transition: 'transform 0.1s ease',
                            '&:hover': {
                                transform: 'scale(1.4)',
                                zIndex: 1,
                            },
                        }}
                    />
                </Tooltip>
            );
        });
    }, [entries]);

    return (
        <Stack direction="row" spacing={0.25} flexWrap="wrap" useFlexGap sx={{ gap: '3px' }}>
            {dots}
        </Stack>
    );
}

export function TestCaseCard({ testCase }) {
    const [expanded, setExpanded] = useState(false);

    const iterations = testCase.iterations;

    const sortedEntries = useMemo(() => {
        return [...testCase.entries].sort((a, b) => {
            const langA = getPathValue(a, 'inputs.prompt_language') || '';
            const langB = getPathValue(b, 'inputs.prompt_language') || '';
            if (langA !== langB) return langA.localeCompare(langB);
            const styleA = getPathValue(a, 'inputs.attack_style') || '';
            const styleB = getPathValue(b, 'inputs.attack_style') || '';
            if (styleA !== styleB) return styleA.localeCompare(styleB);
            const iterA = getPathValue(a, 'run_metadata.iteration') || 0;
            const iterB = getPathValue(b, 'run_metadata.iteration') || 0;
            return iterA - iterB;
        });
    }, [testCase.entries]);

    return (
        <Box
            sx={{
                border: '1px solid',
                borderColor: expanded ? '#cbd5e1' : '#e2e8f0',
                borderRadius: 2.5,
                bgcolor: '#ffffff',
                overflow: 'hidden',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                boxShadow: expanded ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
            }}
        >
            <Box
                onClick={() => setExpanded(!expanded)}
                sx={{
                    p: 2,
                    px: 2.5,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: '#f8fafc' },
                    transition: 'background-color 0.1s ease',
                }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ minWidth: 0, flex: 1 }}>
                        <IconButton
                            size="small"
                            sx={{
                                width: 28,
                                height: 28,
                                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.15s ease-in-out',
                                color: '#64748b',
                                flexShrink: 0,
                            }}
                        >
                            <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: '0.7rem' }} />
                        </IconButton>

                        <Stack direction="row" alignItems="center" spacing={0.75} flexShrink={0}>
                            <Box
                                sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 1.5,
                                    bgcolor: '#f1f5f9',
                                    color: '#475569',
                                    border: '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <FontAwesomeIcon icon={faHashtag} style={{ fontSize: '0.7rem' }} />
                            </Box>
                            <Typography variant="body2" fontWeight={700} color="#0f172a" fontSize="0.9rem">
                                {testCase.rowIndex}
                            </Typography>
                        </Stack>

                        <Chip
                            label={testCase.attackCategory}
                            size="small"
                            sx={{
                                height: 22,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                bgcolor: '#f1f5f9',
                                color: '#334155',
                                border: '1px solid #e2e8f0',
                                flexShrink: 0,
                            }}
                        />

                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                            <FontAwesomeIcon icon={faDatabase} style={{ fontSize: '0.65rem', color: '#94a3b8', flexShrink: 0 }} />
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                fontSize="0.7rem"
                                noWrap
                                sx={{ minWidth: 0 }}
                            >
                                {testCase.sourceFileName}
                            </Typography>
                        </Stack>

                        {!expanded && (
                            <Box sx={{ ml: 1 }}>
                                <TokenHeatmapDots entries={sortedEntries} />
                            </Box>
                        )}
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={1} flexShrink={0}>
                        {testCase.highTokenCount > 0 && (
                            <Chip
                                label={`${testCase.highTokenCount} high`}
                                size="small"
                                sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    bgcolor: '#ecfdf5',
                                    color: '#059669',
                                    border: '1px solid #a7f3d0',
                                }}
                            />
                        )}
                        <Chip
                            label={`${testCase.entryCount} entries`}
                            size="small"
                            sx={{
                                height: 20,
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                bgcolor: '#f1f5f9',
                                color: '#64748b',
                            }}
                        />
                    </Stack>
                </Stack>
            </Box>

            <Collapse in={expanded} timeout={200}>
                <Box sx={{ borderTop: '1px solid #f1f5f9' }}>
                    {testCase.userInputRaw && (
                        <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" fontSize="0.7rem" textTransform="uppercase" letterSpacing="0.05em" mb={0.75} display="block">
                                Prompt
                            </Typography>
                            <Box
                                sx={{
                                    p: 1.5,
                                    bgcolor: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 1.5,
                                    maxHeight: 80,
                                    overflow: 'auto',
                                }}
                            >
                                <Typography variant="body2" fontSize="0.775rem" color="#334155" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {testCase.userInputRaw}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    <Box sx={{ px: 2.5, pt: 1.5, pb: 2.5 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" fontSize="0.7rem" textTransform="uppercase" letterSpacing="0.05em" mb={1} display="block">
                            Variant Comparison — Output Tokens
                        </Typography>
                        <VariantComparisonGrid entries={testCase.entries} iterations={iterations} />
                    </Box>
                </Box>
            </Collapse>
        </Box>
    );
}
