import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, Typography, Stack, IconButton, Tooltip, Button, Divider } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotate, faLayerGroup } from '@fortawesome/free-solid-svg-icons';

export const ALL_LOGS_OPTION = '__ALL_LOGS__';

export function LogFileSelect({ availableFiles, selectedFile, onFileSelect, onRefresh, isRefreshing }) {
    if (!availableFiles || availableFiles.length === 0) {
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
            <FormControl size="small" sx={{ minWidth: 260, maxWidth: 400 }}>
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
                                All Log Files ({availableFiles.length})
                            </Typography>
                        </Stack>
                    </MenuItem>
                    <Divider sx={{ my: 0.5 }} />
                    {availableFiles.map((file) => (
                        <MenuItem key={file} value={file}>
                            {file}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <Tooltip title="Reload file & directory">
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

