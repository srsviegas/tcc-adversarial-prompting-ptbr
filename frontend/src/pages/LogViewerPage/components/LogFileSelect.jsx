import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, Typography, Stack, IconButton, Tooltip, Button, Divider, ListSubheader, Chip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotate, faLayerGroup, faShieldHalved, faFileLines } from '@fortawesome/free-solid-svg-icons';

export const ALL_LOGS_OPTION = '__ALL_LOGS__';

export function LogFileSelect({ availableFiles = [], evaluatedFiles = [], selectedFile, onFileSelect, onRefresh, isRefreshing }) {
    const totalFiles = (availableFiles?.length || 0) + (evaluatedFiles?.length || 0);

    if (totalFiles === 0) {
        return (
            <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" color="text.secondary">
                    No .jsonl files found in the selected directory.
                </Typography>
                <Tooltip title="Refresh directory">
                    <IconButton onClick={onRefresh} size="small" p="5px" color="inherit">
                        <FontAwesomeIcon icon={faRotate} spin={isRefreshing} style={{ fontSize: '0.85rem' }} />
                    </IconButton>
                </Tooltip>
            </Stack>
        );
    }

    return (
        <Stack direction="row" alignItems="center" spacing={1}>
            <FormControl size="small" sx={{ minWidth: 280, maxWidth: 420 }}>
                <InputLabel id="log-file-select-label">Select Log File</InputLabel>
                <Select
                    labelId="log-file-select-label"
                    id="log-file-select"
                    value={selectedFile || ''}
                    label="Select Log File"
                    onChange={(e) => onFileSelect(e.target.value)}
                    borderRadius={1.5}
                >
                    <MenuItem value={ALL_LOGS_OPTION}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <FontAwesomeIcon icon={faLayerGroup} style={{ fontSize: '0.85rem', color: '#1e293b' }} />
                            <Typography variant="inherit" fontWeight={600}>
                                All Generated Logs ({availableFiles.length})
                            </Typography>
                        </Stack>
                    </MenuItem>

                    {evaluatedFiles.length > 0 && [
                        <ListSubheader
                            key="sub-evaluated"
                            sx={{
                                fontWeight: 700,
                                fontSize: '0.725rem',
                                bgcolor: '#faf5ff',
                                color: '#7c3aed',
                                lineHeight: '28px',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                            }}
                        >
                            <FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: '0.75rem' }} />
                            Evaluated Logs · ASR Results ({evaluatedFiles.length})
                        </ListSubheader>,
                        ...evaluatedFiles.map((file) => (
                            <MenuItem key={`evaluated/${file}`} value={`evaluated/${file}`} sx={{ py: 0.75 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" width="100%" spacing={1}>
                                    <Stack direction="row" alignItems="center" spacing={1} overflow="hidden">
                                        <FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: '0.75rem', color: '#7c3aed', flexShrink: 0 }} />
                                        <Typography variant="inherit" noWrap fontSize="0.825rem">
                                            {file}
                                        </Typography>
                                    </Stack>
                                    <Chip
                                        label="Evaluated"
                                        size="small"
                                        sx={{
                                            height: 18,
                                            fontSize: '0.625rem',
                                            fontWeight: 700,
                                            bgcolor: '#f5f3ff',
                                            color: '#7c3aed',
                                            border: '1px solid #ddd6fe',
                                            flexShrink: 0,
                                        }}
                                    />
                                </Stack>
                            </MenuItem>
                        )),
                        <Divider key="div-evaluated" sx={{ my: 0.5 }} />,
                    ]}

                    {availableFiles.length > 0 && [
                        <ListSubheader
                            key="sub-available"
                            sx={{
                                fontWeight: 700,
                                fontSize: '0.725rem',
                                bgcolor: '#f8fafc',
                                color: '#475569',
                                lineHeight: '28px',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                            }}
                        >
                            <FontAwesomeIcon icon={faFileLines} style={{ fontSize: '0.75rem' }} />
                            Generated Logs ({availableFiles.length})
                        </ListSubheader>,
                        ...availableFiles.map((file) => (
                            <MenuItem key={file} value={file} sx={{ py: 0.75 }}>
                                <Typography variant="inherit" noWrap fontSize="0.825rem">
                                    {file}
                                </Typography>
                            </MenuItem>
                        )),
                    ]}
                </Select>
            </FormControl>
            <Tooltip title="Reload files & directory">
                <Button
                    onClick={onRefresh}
                    color='text.secondary'
                    borderRadius={1.5}
                    sx={{ maxWidth: '22px' }}
                >
                    <FontAwesomeIcon icon={faRotate} spin={isRefreshing} />
                </Button>
            </Tooltip>
        </Stack>
    );
}

