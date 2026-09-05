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
    Tooltip,
    Divider,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChevronLeft,
    faChevronRight,
    faXmark,
    faCopy,
    faCheck,
    faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { checkCharacterAnomaly } from '../utils/datasetColumnUtils';

export function SideBySideModal({
    open,
    onClose,
    row,
    pairs = [],
    rowIndex = 0,
    totalRows = 0,
    onNavigate,
}) {
    const [copiedKey, setCopiedKey] = React.useState(null);

    if (!row) return null;

    const handleCopy = (text, key) => {
        navigator.clipboard.writeText(String(text || ''));
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1500);
    };

    const metaFields = Object.keys(row).filter(
        (k) =>
            k !== 'id' &&
            !pairs.some((p) => p.original === k || p.translation === k),
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle sx={{ p: 2.5, pb: 1.5 }}>
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography
                            variant="h6"
                            fontWeight={700}
                            color="#0f172a"
                        >
                            Sample #{row.id !== undefined ? row.id : rowIndex}
                        </Typography>
                        {metaFields.map((field) => {
                            const val = row[field];
                            if (val === undefined || val === null || val === '')
                                return null;
                            return (
                                <Chip
                                    key={field}
                                    label={`${field}: ${val}`}
                                    size="small"
                                    sx={{
                                        bgcolor: '#f1f5f9',
                                        fontWeight: 500,
                                        fontSize: '0.75rem',
                                    }}
                                />
                            );
                        })}
                    </Stack>
                    <IconButton onClick={onClose} size="small">
                        <FontAwesomeIcon icon={faXmark} />
                    </IconButton>
                </Stack>
            </DialogTitle>

            <DialogContent dividers sx={{ p: 3, bgcolor: '#f8fafc' }}>
                <Stack spacing={3}>
                    {pairs.map((pair) => {
                        const originalText = String(row[pair.original] ?? '');
                        const translationText = String(
                            row[pair.translation] ?? '',
                        );
                        const origWords = originalText.trim()
                            ? originalText.trim().split(/\s+/).length
                            : 0;
                        const transWords = translationText.trim()
                            ? translationText.trim().split(/\s+/).length
                            : 0;
                        const anomaly = checkCharacterAnomaly(
                            originalText,
                            translationText,
                        );
                        const charDiff =
                            translationText.length - originalText.length;
                        const charDiffPercent =
                            originalText.length > 0
                                ? Math.round(
                                      (charDiff / originalText.length) * 100,
                                  )
                                : 0;

                        return (
                            <Box
                                key={pair.key}
                                sx={{
                                    bgcolor: '#ffffff',
                                    border: anomaly
                                        ? anomaly.severity === 'error'
                                            ? '1px solid #fecaca'
                                            : '1px solid #fde68a'
                                        : '1px solid #e2e8f0',
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                }}
                            >
                                <Box
                                    sx={{
                                        px: 2,
                                        py: 1,
                                        bgcolor: anomaly
                                            ? anomaly.severity === 'error'
                                                ? '#fef2f2'
                                                : '#fffbeb'
                                            : '#f1f5f9',
                                        borderBottom: anomaly
                                            ? anomaly.severity === 'error'
                                                ? '1px solid #fee2e2'
                                                : '1px solid #fef3c7'
                                            : '1px solid #e2e8f0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <Typography
                                        variant="subtitle2"
                                        fontWeight={600}
                                        color="#334155"
                                        textTransform="capitalize"
                                    >
                                        {pair.key.replace(/_/g, ' ')}
                                    </Typography>
                                    {anomaly && (
                                        <Chip
                                            icon={
                                                <FontAwesomeIcon
                                                    icon={faTriangleExclamation}
                                                    style={{
                                                        fontSize: '0.7rem',
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
                                                fontSize: '0.675rem',
                                                fontWeight: 600,
                                                bgcolor:
                                                    anomaly.severity === 'error'
                                                        ? '#fee2e2'
                                                        : '#fef3c7',
                                                color:
                                                    anomaly.severity === 'error'
                                                        ? '#991b1b'
                                                        : '#92400e',
                                                border: `1px solid ${
                                                    anomaly.severity === 'error'
                                                        ? '#fecaca'
                                                        : '#fde68a'
                                                }`,
                                            }}
                                        />
                                    )}
                                </Box>

                                <Stack
                                    direction={{ xs: 'column', md: 'row' }}
                                    divider={
                                        <Divider
                                            orientation="vertical"
                                            flexItem
                                        />
                                    }
                                >
                                    {/* original column */}
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
                                                        bgcolor: '#dbeafe',
                                                        color: '#1e40af',
                                                        fontWeight: 600,
                                                        fontSize: '0.7rem',
                                                    }}
                                                />
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
                                                    {origWords} words ·{' '}
                                                    {originalText.length} chars
                                                </Typography>
                                            </Stack>
                                            <Tooltip
                                                title={
                                                    copiedKey === pair.original
                                                        ? 'Copied'
                                                        : 'Copy original'
                                                }
                                            >
                                                <IconButton
                                                    size="small"
                                                    onClick={() =>
                                                        handleCopy(
                                                            originalText,
                                                            pair.original,
                                                        )
                                                    }
                                                >
                                                    <FontAwesomeIcon
                                                        icon={
                                                            copiedKey ===
                                                            pair.original
                                                                ? faCheck
                                                                : faCopy
                                                        }
                                                        style={{
                                                            fontSize: '0.8rem',
                                                            color:
                                                                copiedKey ===
                                                                pair.original
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
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                lineHeight: 1.6,
                                                color: '#0f172a',
                                                minHeight: 80,
                                            }}
                                        >
                                            {originalText || (
                                                <em
                                                    style={{ color: '#94a3b8' }}
                                                >
                                                    Empty
                                                </em>
                                            )}
                                        </Typography>
                                    </Box>

                                    {/* translation column */}
                                    <Box flex={1} p={2} bgcolor="#fafafa">
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
                                                        bgcolor: '#dcfce7',
                                                        color: '#166534',
                                                        fontWeight: 600,
                                                        fontSize: '0.7rem',
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
                                                        fontWeight: anomaly
                                                            ? 600
                                                            : 400,
                                                    }}
                                                >
                                                    {transWords} words ·{' '}
                                                    {translationText.length}{' '}
                                                    chars
                                                    {originalText.length >
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
                                                                bgcolor: anomaly
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
                                                            {charDiff > 0
                                                                ? `+${charDiff}`
                                                                : charDiff}{' '}
                                                            chars (
                                                            {charDiffPercent > 0
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
                                                    pair.translation
                                                        ? 'Copied'
                                                        : 'Copy translation'
                                                }
                                            >
                                                <IconButton
                                                    size="small"
                                                    onClick={() =>
                                                        handleCopy(
                                                            translationText,
                                                            pair.translation,
                                                        )
                                                    }
                                                >
                                                    <FontAwesomeIcon
                                                        icon={
                                                            copiedKey ===
                                                            pair.translation
                                                                ? faCheck
                                                                : faCopy
                                                        }
                                                        style={{
                                                            fontSize: '0.8rem',
                                                            color:
                                                                copiedKey ===
                                                                pair.translation
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
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                lineHeight: 1.6,
                                                color: '#0f172a',
                                                minHeight: 80,
                                            }}
                                        >
                                            {translationText || (
                                                <em
                                                    style={{ color: '#94a3b8' }}
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
            </DialogContent>

            <DialogActions
                sx={{ px: 3, py: 2, justifyContent: 'space-between' }}
            >
                <Stack direction="row" spacing={1}>
                    <Button
                        size="small"
                        variant="outlined"
                        disabled={rowIndex <= 0}
                        onClick={() => onNavigate && onNavigate(rowIndex - 1)}
                        startIcon={
                            <FontAwesomeIcon
                                icon={faChevronLeft}
                                style={{ fontSize: '0.75rem' }}
                            />
                        }
                    >
                        Previous
                    </Button>
                    <Button
                        size="small"
                        variant="outlined"
                        disabled={rowIndex >= totalRows - 1}
                        onClick={() => onNavigate && onNavigate(rowIndex + 1)}
                        endIcon={
                            <FontAwesomeIcon
                                icon={faChevronRight}
                                style={{ fontSize: '0.75rem' }}
                            />
                        }
                    >
                        Next
                    </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                    {rowIndex + 1} of {totalRows}
                </Typography>
                <Button onClick={onClose} variant="contained" size="small">
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}
