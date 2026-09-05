import React, { useState, useMemo } from 'react';
import {
    Box,
    Stack,
    Typography,
    Chip,
    TextField,
    Pagination,
    Card,
    CardContent,
    Divider,
    IconButton,
    Tooltip,
    ToggleButtonGroup,
    ToggleButton,
    Button,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCopy,
    faCheck,
    faTriangleExclamation,
    faCircleCheck,
} from '@fortawesome/free-solid-svg-icons';
import {
    findTranslationPairs,
    checkCharacterAnomaly,
} from '../utils/datasetColumnUtils';

export function SideBySideReviewView({ data, columns }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [copiedKey, setCopiedKey] = useState(null);
    const [filterMode, setFilterMode] = useState('all');
    const pageSize = 10;

    const { pairs } = useMemo(() => {
        const colList =
            columns ||
            (data && data[0]
                ? Object.keys(data[0]).filter((k) => k !== 'id')
                : []);
        return findTranslationPairs(colList);
    }, [columns, data]);

    const handleCopy = (text, key) => {
        navigator.clipboard.writeText(String(text || ''));
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1500);
    };

    // calculate anomalies for each row
    const rowAnomaliesMap = useMemo(() => {
        if (!data || pairs.length === 0) return new Map();
        const map = new Map();
        for (const row of data) {
            const anomalies = [];
            for (const pair of pairs) {
                const anomaly = checkCharacterAnomaly(
                    row[pair.original],
                    row[pair.translation],
                );
                if (anomaly) {
                    anomalies.push({ pair, anomaly });
                }
            }
            if (anomalies.length > 0) {
                map.set(row.id, anomalies);
            }
        }
        return map;
    }, [data, pairs]);

    const totalDiscrepancies = rowAnomaliesMap.size;

    const filteredData = useMemo(() => {
        if (!data) return [];

        return data.filter((row) => {
            if (
                filterMode === 'discrepancies' &&
                !rowAnomaliesMap.has(row.id)
            ) {
                return false;
            }

            if (!searchTerm.trim()) return true;

            const term = searchTerm.toLowerCase();
            return Object.values(row).some(
                (val) =>
                    val !== undefined &&
                    val !== null &&
                    String(val).toLowerCase().includes(term),
            );
        });
    }, [data, searchTerm, filterMode, rowAnomaliesMap]);

    const pageCount = Math.ceil(filteredData.length / pageSize);
    const displayedRows = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredData.slice(start, start + pageSize);
    }, [filteredData, page]);

    return (
        <Box>
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                mb={2.5}
            >
                <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    flexWrap="wrap"
                >
                    <TextField
                        size="small"
                        placeholder="Search prompts or translations..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                        sx={{ width: 280, bgcolor: '#ffffff' }}
                    />
                    <ToggleButtonGroup
                        size="small"
                        value={filterMode}
                        exclusive
                        onChange={(_, newMode) => {
                            if (newMode) {
                                setFilterMode(newMode);
                                setPage(1);
                            }
                        }}
                        sx={{
                            bgcolor: '#ffffff',
                            '& .MuiToggleButton-root': {
                                px: 1.5,
                                py: 0.6,
                                fontSize: '0.8rem',
                                textTransform: 'none',
                                fontWeight: 500,
                            },
                        }}
                    >
                        <ToggleButton value="all">
                            All ({data?.length || 0})
                        </ToggleButton>
                        <ToggleButton
                            value="discrepancies"
                            sx={{
                                color:
                                    totalDiscrepancies > 0
                                        ? '#b45309 !important'
                                        : 'inherit',
                                fontWeight: totalDiscrepancies > 0 ? 600 : 500,
                            }}
                        >
                            <Stack
                                direction="row"
                                spacing={0.75}
                                alignItems="center"
                            >
                                <FontAwesomeIcon
                                    icon={faTriangleExclamation}
                                    style={{
                                        fontSize: '0.75rem',
                                        color:
                                            totalDiscrepancies > 0
                                                ? '#d97706'
                                                : '#94a3b8',
                                    }}
                                />
                                <span>
                                    Discrepancies ({totalDiscrepancies})
                                </span>
                            </Stack>
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                        Showing {filteredData.length}{' '}
                        {filterMode === 'discrepancies' ? 'flagged ' : ''}items
                    </Typography>
                    {pageCount > 1 && (
                        <Pagination
                            count={pageCount}
                            page={page}
                            onChange={(_, val) => setPage(val)}
                            size="small"
                            color="primary"
                        />
                    )}
                </Stack>
            </Stack>

            {filteredData.length === 0 && (
                <Box
                    p={5}
                    textAlign="center"
                    bgcolor="#ffffff"
                    borderRadius={2}
                    border="1px solid #e2e8f0"
                >
                    {filterMode === 'discrepancies' ? (
                        <>
                            <FontAwesomeIcon
                                icon={faCircleCheck}
                                style={{
                                    fontSize: '2rem',
                                    color: '#16a34a',
                                    marginBottom: 12,
                                }}
                            />
                            <Typography
                                variant="subtitle1"
                                fontWeight={600}
                                color="#0f172a"
                            >
                                No character count discrepancies found
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                mt={0.5}
                                mb={2}
                            >
                                All translations in this dataset have lengths
                                proportional to the original prompts.
                            </Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => setFilterMode('all')}
                            >
                                Show All Items
                            </Button>
                        </>
                    ) : (
                        <>
                            <Typography
                                variant="subtitle1"
                                fontWeight={600}
                                color="#0f172a"
                            >
                                No matching records found
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                mt={0.5}
                                mb={2}
                            >
                                Try clearing the search term or switching filter
                                modes.
                            </Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterMode('all');
                                }}
                            >
                                Reset Filters
                            </Button>
                        </>
                    )}
                </Box>
            )}

            <Stack spacing={2}>
                {displayedRows.map((row) => {
                    const rowAnomalies = rowAnomaliesMap.get(row.id) || [];
                    const hasRowAnomaly = rowAnomalies.length > 0;
                    const hasError = rowAnomalies.some(
                        (a) => a.anomaly.severity === 'error',
                    );

                    return (
                        <Card
                            key={row.id}
                            elevation={0}
                            sx={{
                                border: hasRowAnomaly
                                    ? hasError
                                        ? '1px solid #fca5a5'
                                        : '1px solid #fcd34d'
                                    : '1px solid #e2e8f0',
                                borderRadius: 2,
                                overflow: 'hidden',
                            }}
                        >
                            <Box
                                sx={{
                                    px: 2.5,
                                    py: 1.25,
                                    bgcolor: hasRowAnomaly
                                        ? hasError
                                            ? '#fef2f2'
                                            : '#fffbeb'
                                        : '#f8fafc',
                                    borderBottom: hasRowAnomaly
                                        ? hasError
                                            ? '1px solid #fee2e2'
                                            : '1px solid #fef3c7'
                                        : '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: 1,
                                }}
                            >
                                <Chip
                                    label={`#${row.id}`}
                                    size="small"
                                    sx={{
                                        fontWeight: 700,
                                        bgcolor: '#0f172a',
                                        color: '#ffffff',
                                    }}
                                />

                                {hasRowAnomaly && (
                                    <Chip
                                        icon={
                                            <FontAwesomeIcon
                                                icon={faTriangleExclamation}
                                                style={{
                                                    fontSize: '0.72rem',
                                                    color: hasError
                                                        ? '#dc2626'
                                                        : '#b45309',
                                                }}
                                            />
                                        }
                                        label={
                                            hasError
                                                ? 'Translation Missing'
                                                : 'Discrepancy Detected'
                                        }
                                        size="small"
                                        sx={{
                                            bgcolor: hasError
                                                ? '#fee2e2'
                                                : '#fef3c7',
                                            color: hasError
                                                ? '#991b1b'
                                                : '#92400e',
                                            fontWeight: 600,
                                            fontSize: '0.72rem',
                                            border: `1px solid ${
                                                hasError ? '#fecaca' : '#fde68a'
                                            }`,
                                        }}
                                    />
                                )}
                            </Box>

                            <CardContent
                                sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}
                            >
                                <Stack spacing={2.5}>
                                    {pairs.map((pair) => {
                                        const orig = String(
                                            row[pair.original] ?? '',
                                        );
                                        const trans = String(
                                            row[pair.translation] ?? '',
                                        );
                                        const origWords = orig.trim()
                                            ? orig.trim().split(/\s+/).length
                                            : 0;
                                        const transWords = trans.trim()
                                            ? trans.trim().split(/\s+/).length
                                            : 0;
                                        const anomaly = checkCharacterAnomaly(
                                            orig,
                                            trans,
                                        );
                                        const charDiff =
                                            trans.length - orig.length;
                                        const charDiffPercent =
                                            orig.length > 0
                                                ? Math.round(
                                                      (charDiff / orig.length) *
                                                          100,
                                                  )
                                                : 0;

                                        return (
                                            <Box
                                                key={pair.key}
                                                sx={{
                                                    border: anomaly
                                                        ? anomaly.severity ===
                                                          'error'
                                                            ? '1px solid #fecaca'
                                                            : '1px solid #fde68a'
                                                        : '1px solid #e2e8f0',
                                                    borderRadius: 1.5,
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        px: 2,
                                                        py: 0.75,
                                                        bgcolor: anomaly
                                                            ? anomaly.severity ===
                                                              'error'
                                                                ? '#fef2f2'
                                                                : '#fffbeb'
                                                            : '#f1f5f9',
                                                        borderBottom: anomaly
                                                            ? anomaly.severity ===
                                                              'error'
                                                                ? '1px solid #fee2e2'
                                                                : '1px solid #fef3c7'
                                                            : '1px solid #e2e8f0',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent:
                                                            'space-between',
                                                    }}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        fontWeight={700}
                                                        color="#475569"
                                                        textTransform="uppercase"
                                                    >
                                                        {pair.key.replace(
                                                            /_/g,
                                                            ' ',
                                                        )}
                                                    </Typography>
                                                    {anomaly && (
                                                        <Chip
                                                            icon={
                                                                <FontAwesomeIcon
                                                                    icon={
                                                                        faTriangleExclamation
                                                                    }
                                                                    style={{
                                                                        fontSize:
                                                                            '0.7rem',
                                                                        color:
                                                                            anomaly.severity ===
                                                                            'error'
                                                                                ? '#dc2626'
                                                                                : '#d97706',
                                                                    }}
                                                                />
                                                            }
                                                            label={`Discrepancy: ${anomaly.label}`}
                                                            size="small"
                                                            sx={{
                                                                height: 22,
                                                                fontSize:
                                                                    '0.675rem',
                                                                fontWeight: 600,
                                                                bgcolor:
                                                                    anomaly.severity ===
                                                                    'error'
                                                                        ? '#fee2e2'
                                                                        : '#fef3c7',
                                                                color:
                                                                    anomaly.severity ===
                                                                    'error'
                                                                        ? '#991b1b'
                                                                        : '#92400e',
                                                                border: `1px solid ${
                                                                    anomaly.severity ===
                                                                    'error'
                                                                        ? '#fecaca'
                                                                        : '#fde68a'
                                                                }`,
                                                            }}
                                                        />
                                                    )}
                                                </Box>

                                                <Stack
                                                    direction={{
                                                        xs: 'column',
                                                        md: 'row',
                                                    }}
                                                    divider={
                                                        <Divider
                                                            orientation="vertical"
                                                            flexItem
                                                        />
                                                    }
                                                >
                                                    {/* original */}
                                                    <Box flex={1} p={2}>
                                                        <Stack
                                                            direction="row"
                                                            justifyContent="space-between"
                                                            alignItems="center"
                                                            mb={1}
                                                        >
                                                            <Stack
                                                                direction="row"
                                                                spacing={1}
                                                                alignItems="center"
                                                            >
                                                                <Chip
                                                                    label="EN (Original)"
                                                                    size="small"
                                                                    sx={{
                                                                        height: 20,
                                                                        bgcolor:
                                                                            '#dbeafe',
                                                                        color: '#1e40af',
                                                                        fontWeight: 700,
                                                                        fontSize:
                                                                            '0.65rem',
                                                                    }}
                                                                />
                                                                <Typography
                                                                    variant="caption"
                                                                    color="text.secondary"
                                                                >
                                                                    {origWords}{' '}
                                                                    words ·{' '}
                                                                    {
                                                                        orig.length
                                                                    }{' '}
                                                                    chars
                                                                </Typography>
                                                            </Stack>
                                                            <Tooltip
                                                                title={
                                                                    copiedKey ===
                                                                    `${row.id}_${pair.original}`
                                                                        ? 'Copied'
                                                                        : 'Copy'
                                                                }
                                                            >
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() =>
                                                                        handleCopy(
                                                                            orig,
                                                                            `${row.id}_${pair.original}`,
                                                                        )
                                                                    }
                                                                >
                                                                    <FontAwesomeIcon
                                                                        icon={
                                                                            copiedKey ===
                                                                            `${row.id}_${pair.original}`
                                                                                ? faCheck
                                                                                : faCopy
                                                                        }
                                                                        style={{
                                                                            fontSize:
                                                                                '0.75rem',
                                                                            color:
                                                                                copiedKey ===
                                                                                `${row.id}_${pair.original}`
                                                                                    ? '#16a34a'
                                                                                    : '#64748b',
                                                                        }}
                                                                    />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Stack>
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                whiteSpace:
                                                                    'pre-wrap',
                                                                lineHeight: 1.6,
                                                                color: '#1e293b',
                                                            }}
                                                        >
                                                            {orig || (
                                                                <em
                                                                    style={{
                                                                        color: '#94a3b8',
                                                                    }}
                                                                >
                                                                    Empty
                                                                </em>
                                                            )}
                                                        </Typography>
                                                    </Box>

                                                    {/* translation */}
                                                    <Box
                                                        flex={1}
                                                        p={2}
                                                        bgcolor="#fafafa"
                                                    >
                                                        <Stack
                                                            direction="row"
                                                            justifyContent="space-between"
                                                            alignItems="center"
                                                            mb={1}
                                                        >
                                                            <Stack
                                                                direction="row"
                                                                spacing={1}
                                                                alignItems="center"
                                                            >
                                                                <Chip
                                                                    label="PT-BR (Translation)"
                                                                    size="small"
                                                                    sx={{
                                                                        height: 20,
                                                                        bgcolor:
                                                                            '#dcfce7',
                                                                        color: '#166534',
                                                                        fontWeight: 700,
                                                                        fontSize:
                                                                            '0.65rem',
                                                                    }}
                                                                />
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{
                                                                        color: anomaly
                                                                            ? anomaly.severity ===
                                                                              'error'
                                                                                ? '#b91c1c'
                                                                                : '#b45309'
                                                                            : 'text.secondary',
                                                                        fontWeight:
                                                                            anomaly
                                                                                ? 600
                                                                                : 400,
                                                                    }}
                                                                >
                                                                    {transWords}{' '}
                                                                    words ·{' '}
                                                                    {
                                                                        trans.length
                                                                    }{' '}
                                                                    chars
                                                                    {orig.length >
                                                                        0 && (
                                                                        <Box
                                                                            component="span"
                                                                            sx={{
                                                                                ml: 0.75,
                                                                                px: 0.6,
                                                                                py: 0.15,
                                                                                borderRadius: 0.75,
                                                                                fontSize:
                                                                                    '0.7rem',
                                                                                fontWeight: 600,
                                                                                bgcolor:
                                                                                    anomaly
                                                                                        ? anomaly.severity ===
                                                                                          'error'
                                                                                            ? '#fee2e2'
                                                                                            : '#fef3c7'
                                                                                        : '#f1f5f9',
                                                                                color: anomaly
                                                                                    ? anomaly.severity ===
                                                                                      'error'
                                                                                        ? '#991b1b'
                                                                                        : '#92400e'
                                                                                    : '#64748b',
                                                                            }}
                                                                        >
                                                                            Δ{' '}
                                                                            {charDiff >
                                                                            0
                                                                                ? `+${charDiff}`
                                                                                : charDiff}{' '}
                                                                            chars
                                                                            (
                                                                            {charDiffPercent >
                                                                            0
                                                                                ? `+${charDiffPercent}`
                                                                                : charDiffPercent}
                                                                            %)
                                                                        </Box>
                                                                    )}
                                                                </Typography>
                                                            </Stack>
                                                            <Tooltip
                                                                title={
                                                                    copiedKey ===
                                                                    `${row.id}_${pair.translation}`
                                                                        ? 'Copied'
                                                                        : 'Copy'
                                                                }
                                                            >
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() =>
                                                                        handleCopy(
                                                                            trans,
                                                                            `${row.id}_${pair.translation}`,
                                                                        )
                                                                    }
                                                                >
                                                                    <FontAwesomeIcon
                                                                        icon={
                                                                            copiedKey ===
                                                                            `${row.id}_${pair.translation}`
                                                                                ? faCheck
                                                                                : faCopy
                                                                        }
                                                                        style={{
                                                                            fontSize:
                                                                                '0.75rem',
                                                                            color:
                                                                                copiedKey ===
                                                                                `${row.id}_${pair.translation}`
                                                                                    ? '#16a34a'
                                                                                    : '#64748b',
                                                                        }}
                                                                    />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Stack>
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                whiteSpace:
                                                                    'pre-wrap',
                                                                lineHeight: 1.6,
                                                                color: '#1e293b',
                                                            }}
                                                        >
                                                            {trans || (
                                                                <em
                                                                    style={{
                                                                        color: '#94a3b8',
                                                                    }}
                                                                >
                                                                    Empty
                                                                </em>
                                                            )}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </Box>
                                        );
                                    })}
                                </Stack>
                            </CardContent>
                        </Card>
                    );
                })}
            </Stack>

            {pageCount > 1 && (
                <Stack direction="row" justifyContent="center" mt={3}>
                    <Pagination
                        count={pageCount}
                        page={page}
                        onChange={(_, val) => setPage(val)}
                        color="primary"
                    />
                </Stack>
            )}
        </Box>
    );
}
