import React, { useMemo, useState } from 'react';
import { Box, Typography, Stack, IconButton, Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand } from '@fortawesome/free-solid-svg-icons';
import { getPathValue } from '../utils/columnUtils';
import { buildVariantMap, buildVariantKey, getTokenColor, getTokenLabel } from '../utils/testCaseUtils';
import { ResponseDetailDialog } from './ResponseDetailDialog';

const STYLE_LABELS = {
    plain: 'Plain',
    persuasive: 'Persuasive',
};

const LANGUAGE_LABELS = {
    en: 'EN',
    'pt-BR': 'PT-BR',
};

export function VariantComparisonGrid({ entries, iterations }) {
    const [dialogEntry, setDialogEntry] = useState(null);

    const variantMap = useMemo(() => buildVariantMap(entries), [entries]);

    const languages = useMemo(() => {
        const langs = new Set();
        entries.forEach((e) => {
            const l = getPathValue(e, 'inputs.prompt_language');
            if (l) langs.add(l);
        });
        return Array.from(langs).sort();
    }, [entries]);

    const styles = useMemo(() => {
        const s = new Set();
        entries.forEach((e) => {
            const st = getPathValue(e, 'inputs.attack_style');
            if (st) s.add(st);
        });
        return Array.from(s).sort();
    }, [entries]);

    const variantRows = useMemo(() => {
        const rows = [];
        for (const lang of languages) {
            for (const style of styles) {
                rows.push({ language: lang, style, key: buildVariantKey(lang, style) });
            }
        }
        return rows;
    }, [languages, styles]);

    return (
        <>
            <Box sx={{ overflowX: 'auto' }}>
                <Box
                    component="table"
                    sx={{
                        width: '100%',
                        borderCollapse: 'separate',
                        borderSpacing: 0,
                        tableLayout: 'fixed',
                    }}
                >
                    <Box component="thead">
                        <Box component="tr">
                            <Box
                                component="th"
                                sx={{
                                    width: 160,
                                    p: 1,
                                    textAlign: 'left',
                                    borderBottom: '1px solid #e2e8f0',
                                }}
                            >
                                <Typography variant="caption" fontWeight={600} color="text.secondary" fontSize="0.7rem" textTransform="uppercase" letterSpacing="0.05em">
                                    Variant
                                </Typography>
                            </Box>
                            {iterations.map((iter) => (
                                <Box
                                    component="th"
                                    key={iter}
                                    sx={{
                                        p: 1,
                                        textAlign: 'center',
                                        borderBottom: '1px solid #e2e8f0',
                                        minWidth: 90,
                                    }}
                                >
                                    <Typography variant="caption" fontWeight={600} color="text.secondary" fontSize="0.7rem" textTransform="uppercase" letterSpacing="0.05em">
                                        Iter {iter}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                    <Box component="tbody">
                        {variantRows.map((row) => {
                            const iterMap = variantMap.get(row.key);
                            return (
                                <Box component="tr" key={row.key}>
                                    <Box
                                        component="td"
                                        sx={{
                                            p: 1,
                                            py: 1.25,
                                            borderBottom: '1px solid #f1f5f9',
                                            verticalAlign: 'middle',
                                        }}
                                    >
                                        <Stack direction="row" spacing={0.75} alignItems="center">
                                            <Box
                                                sx={{
                                                    px: 0.75,
                                                    py: 0.25,
                                                    bgcolor: '#f1f5f9',
                                                    borderRadius: 1,
                                                    border: '1px solid #e2e8f0',
                                                }}
                                            >
                                                <Typography variant="caption" fontWeight={700} fontSize="0.7rem" color="#334155">
                                                    {LANGUAGE_LABELS[row.language] || row.language}
                                                </Typography>
                                            </Box>
                                            <Typography variant="body2" fontSize="0.775rem" color="#475569" fontWeight={500}>
                                                {STYLE_LABELS[row.style] || row.style}
                                            </Typography>
                                        </Stack>
                                    </Box>
                                    {iterations.map((iter) => {
                                        const entry = iterMap?.get(iter);
                                        if (!entry) {
                                            return (
                                                <Box
                                                    component="td"
                                                    key={iter}
                                                    sx={{
                                                        p: 0.75,
                                                        borderBottom: '1px solid #f1f5f9',
                                                        textAlign: 'center',
                                                        verticalAlign: 'middle',
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            mx: 'auto',
                                                            p: 1,
                                                            bgcolor: '#fafafa',
                                                            border: '1px dashed #e2e8f0',
                                                            borderRadius: 1.5,
                                                        }}
                                                    >
                                                        <Typography variant="caption" color="#cbd5e1" fontSize="0.7rem">
                                                            —
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            );
                                        }

                                        const outTokens = getPathValue(entry, 'execution_metrics.output_tokens');
                                        const latency = getPathValue(entry, 'execution_metrics.latency_seconds');
                                        const colors = getTokenColor(outTokens);

                                        return (
                                            <Box
                                                component="td"
                                                key={iter}
                                                sx={{
                                                    p: 0.75,
                                                    borderBottom: '1px solid #f1f5f9',
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        mx: 'auto',
                                                        p: 1,
                                                        bgcolor: colors.bg,
                                                        border: '1px solid',
                                                        borderColor: colors.border,
                                                        borderRadius: 1.5,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                        '&:hover': {
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                                            transform: 'translateY(-1px)',
                                                        },
                                                    }}
                                                    onClick={() => setDialogEntry(entry)}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight={700}
                                                        fontSize="0.85rem"
                                                        color={colors.text}
                                                        lineHeight={1.2}
                                                    >
                                                        {getTokenLabel(outTokens)}
                                                    </Typography>
                                                    {latency !== null && latency !== undefined && (
                                                        <Typography variant="caption" color="text.secondary" fontSize="0.65rem" display="block" mt={0.25}>
                                                            {latency.toFixed(1)}s
                                                        </Typography>
                                                    )}
                                                    <Tooltip title="View full response" arrow placement="top">
                                                        <Box
                                                            component="span"
                                                            sx={{
                                                                display: 'inline-flex',
                                                                mt: 0.5,
                                                                color: '#94a3b8',
                                                                fontSize: '0.6rem',
                                                                '&:hover': { color: '#475569' },
                                                            }}
                                                        >
                                                            <FontAwesomeIcon icon={faExpand} />
                                                        </Box>
                                                    </Tooltip>
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            </Box>

            <ResponseDetailDialog
                open={!!dialogEntry}
                onClose={() => setDialogEntry(null)}
                entry={dialogEntry}
            />
        </>
    );
}
