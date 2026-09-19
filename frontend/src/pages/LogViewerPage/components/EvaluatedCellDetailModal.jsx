import React from 'react';
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
    Divider,
    LinearProgress,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faXmark,
    faScaleBalanced,
    faShieldHalved,
    faTriangleExclamation,
    faTable,
    faFlask,
} from '@fortawesome/free-solid-svg-icons';

function getAsrColor(rate) {
    if (rate >= 40) return { text: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
    if (rate >= 20) return { text: '#d97706', bg: '#fffbeb', border: '#fde68a' };
    return { text: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
}

function CategoryCard({ title, data, isAttack = false, lang = 'EN' }) {
    if (!data) return null;
    const colors = getAsrColor(data.rate);

    return (
        <Box
            sx={{
                p: 2,
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                flex: 1,
                minWidth: 150,
            }}
        >
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                    <Chip
                        label={lang}
                        size="small"
                        sx={{
                            height: 18,
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            bgcolor: lang === 'EN' ? '#dbeafe' : '#dcfce7',
                            color: lang === 'EN' ? '#1e40af' : '#166534',
                        }}
                    />
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                        {title || (isAttack ? 'Attack' : 'Plain')}
                    </Typography>
                </Stack>
                <Chip
                    label={`${data.rate}%`}
                    size="small"
                    sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        bgcolor: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                    }}
                />
            </Stack>

            <Typography variant="h6" fontWeight={700} color="#0f172a" fontSize="1.1rem" lineHeight={1.2}>
                {data.hits} <Typography component="span" variant="caption" color="text.secondary">/ {data.total}</Typography>
            </Typography>

            <LinearProgress
                variant="determinate"
                value={Math.min(100, data.rate)}
                sx={{
                    mt: 1.25,
                    height: 5,
                    borderRadius: 2,
                    bgcolor: '#f1f5f9',
                    '& .MuiLinearProgress-bar': {
                        bgcolor: colors.text,
                        borderRadius: 2,
                    },
                }}
            />
        </Box>
    );
}

export function EvaluatedCellDetailModal({
    open,
    onClose,
    evalData,
    methodMeta,
    modelMeta,
    onNavigateToFile,
}) {
    if (!evalData) return null;

    const overallColors = getAsrColor(evalData.overallAsr);

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
            <DialogTitle sx={{ p: 2.5, pb: 1.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1.5} alignItems="center">
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
                            <FontAwesomeIcon icon={faScaleBalanced} style={{ fontSize: '0.9rem' }} />
                        </Box>
                        <Box>
                            <Typography variant="h6" fontWeight={700} color="#0f172a" fontSize="1.05rem" lineHeight={1.2}>
                                {methodMeta?.label || 'Benchmark'} · {modelMeta?.label || 'Model'}
                            </Typography>
                            <Stack direction="row" spacing={0.75} mt={0.25} alignItems="center">
                                <Chip
                                    label={`Evaluator: ${evalData.evaluatorName}`}
                                    size="small"
                                    sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#f1f5f9', color: '#475569' }}
                                />
                                {evalData.evaluatorModel && (
                                    <Chip
                                        label={evalData.evaluatorModel}
                                        size="small"
                                        sx={{ height: 18, fontSize: '0.65rem', fontWeight: 500, bgcolor: '#f8fafc', color: '#64748b' }}
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

            <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
                <Stack spacing={2.5}>
                    {/* Overall KPI Banner */}
                    <Box
                        sx={{
                            p: 2.5,
                            bgcolor: '#ffffff',
                            border: `1px solid ${overallColors.border}`,
                            borderRadius: 2.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 2,
                        }}
                    >
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Box
                                sx={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 2,
                                    bgcolor: overallColors.bg,
                                    color: overallColors.text,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.4rem',
                                    fontWeight: 800,
                                }}
                            >
                                <FontAwesomeIcon icon={faShieldHalved} />
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em">
                                    Overall Attack Success Rate (ASR)
                                </Typography>
                                <Typography variant="h4" fontWeight={800} color={overallColors.text} lineHeight={1.1}>
                                    {evalData.overallAsr}%
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {evalData.hits} harmful responses out of {evalData.evaluatedCount} evaluated
                                </Typography>
                            </Box>
                        </Stack>

                        <Stack spacing={0.5} alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
                            <Chip
                                label={evalData.overallAsr > 35 ? 'Vulnerable / High ASR' : evalData.overallAsr > 15 ? 'Moderate Vulnerability' : 'Resilient / Low ASR'}
                                size="small"
                                sx={{
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    bgcolor: overallColors.bg,
                                    color: overallColors.text,
                                    border: `1px solid ${overallColors.border}`,
                                }}
                            />
                            <Typography variant="caption" color="text.secondary">
                                {evalData.evaluatedCount.toLocaleString()} evaluated rows{evalData.errorCount > 0 ? ` (${evalData.errorCount} error${evalData.errorCount > 1 ? 's' : ''} excluded)` : ''}
                            </Typography>
                        </Stack>
                    </Box>

                    {/* 4-Variant Breakdown Grid */}
                    <Box>
                        <Typography variant="subtitle2" fontWeight={700} color="#0f172a" fontSize="0.825rem" mb={1}>
                            ASR by Prompt Category & Language
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap">
                            <CategoryCard
                                title="English Plain"
                                data={evalData.categories['plain-en']}
                                lang="EN"
                                isAttack={false}
                            />
                            <CategoryCard
                                title="English Attack"
                                data={evalData.categories['attack-en']}
                                lang="EN"
                                isAttack={true}
                            />
                            <CategoryCard
                                title="Portuguese Plain"
                                data={evalData.categories['plain-ptbr']}
                                lang="PT"
                                isAttack={false}
                            />
                            <CategoryCard
                                title="Portuguese Attack"
                                data={evalData.categories['attack-ptbr']}
                                lang="PT"
                                isAttack={true}
                            />
                        </Stack>
                    </Box>

                    {/* Top Violated Safety Categories */}
                    {evalData.safetyCategories && evalData.safetyCategories.length > 0 && (
                        <Box sx={{ p: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                            <Typography variant="subtitle2" fontWeight={700} color="#0f172a" fontSize="0.825rem" mb={1.25}>
                                Triggered Safety Categories
                            </Typography>
                            <Stack spacing={1}>
                                {evalData.safetyCategories.map((cat) => {
                                    const maxCount = evalData.safetyCategories[0]?.count || 1;
                                    const pct = Math.round((cat.count / maxCount) * 100);

                                    return (
                                        <Box key={cat.name}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.25}>
                                                <Typography variant="caption" fontWeight={600} color="#334155">
                                                    {cat.name}
                                                </Typography>
                                                <Typography variant="caption" fontWeight={700} color="#dc2626">
                                                    {cat.count} flags
                                                </Typography>
                                            </Stack>
                                            <LinearProgress
                                                variant="determinate"
                                                value={pct}
                                                sx={{
                                                    height: 5,
                                                    borderRadius: 2,
                                                    bgcolor: '#fee2e2',
                                                    '& .MuiLinearProgress-bar': {
                                                        bgcolor: '#dc2626',
                                                        borderRadius: 2,
                                                    },
                                                }}
                                            />
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </Box>
                    )}

                    {/* Errors if any */}
                    {evalData.errorCount > 0 && (
                        <Box sx={{ p: 1.5, bgcolor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 2 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: '#d97706', fontSize: '0.8rem' }} />
                                <Typography variant="caption" color="#92400e" fontWeight={600}>
                                    {evalData.errorCount} responses failed evaluation (API error or rate limit).
                                </Typography>
                            </Stack>
                        </Box>
                    )}
                </Stack>
            </DialogContent>

            <Divider />

            <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between', bgcolor: '#ffffff' }}>
                <Stack direction="row" spacing={1}>
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onNavigateToFile && onNavigateToFile(evalData.fileName, 'raw')}
                        startIcon={<FontAwesomeIcon icon={faTable} style={{ fontSize: '0.75rem' }} />}
                    >
                        View in Raw Logs
                    </Button>
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onNavigateToFile && onNavigateToFile(evalData.fileName, 'testcases')}
                        startIcon={<FontAwesomeIcon icon={faFlask} style={{ fontSize: '0.75rem' }} />}
                    >
                        View in Test Cases
                    </Button>
                </Stack>
                <Button variant="contained" onClick={onClose} size="small" sx={{ minWidth: 80, fontWeight: 600 }}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}
