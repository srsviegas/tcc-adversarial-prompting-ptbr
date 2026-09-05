import React, { useRef } from 'react';
import {
    Stack,
    Button,
    FormControl,
    Select,
    MenuItem,
    Typography,
    Box,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFile, faFolderOpen } from '@fortawesome/free-solid-svg-icons';

export function DatasetSourceSelector({
    onFileSelect,
    availableFiles = [],
    selectedFileName = '',
    onSelectFromDirectory,
    onPickDirectory,
    hasDirectory = false,
    rowCount = 0,
}) {
    const fileInputRef = useRef(null);

    const handleNativeFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file && onFileSelect) {
            onFileSelect(file);
        }
        e.target.value = '';
    };

    return (
        <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            flexWrap="wrap"
        >
            <input
                ref={fileInputRef}
                type="file"
                accept=".parquet,.csv"
                style={{ display: 'none' }}
                onChange={handleNativeFileChange}
            />

            <Button
                variant="outlined"
                size="small"
                onClick={() => fileInputRef.current?.click()}
                startIcon={
                    <FontAwesomeIcon
                        icon={faFile}
                        style={{ fontSize: '0.8rem' }}
                    />
                }
            >
                Open File (.parquet, .csv)
            </Button>

            {typeof window !== 'undefined' &&
                'showDirectoryPicker' in window && (
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={onPickDirectory}
                        startIcon={
                            <FontAwesomeIcon
                                icon={faFolderOpen}
                                style={{ fontSize: '0.8rem' }}
                            />
                        }
                    >
                        {hasDirectory ? 'Change Directory' : 'Select Directory'}
                    </Button>
                )}

            {hasDirectory && availableFiles.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 220 }}>
                    <Select
                        value={selectedFileName}
                        onChange={(e) =>
                            onSelectFromDirectory &&
                            onSelectFromDirectory(e.target.value)
                        }
                        displayEmpty
                    >
                        {availableFiles.map((fn) => (
                            <MenuItem key={fn} value={fn}>
                                {fn}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}

            {selectedFileName && (
                <Box display="flex" alignItems="center" gap={1}>
                    <Typography
                        variant="body2"
                        fontWeight={600}
                        color="#0f172a"
                    >
                        {selectedFileName}
                    </Typography>
                    {rowCount > 0 && (
                        <Typography variant="caption" color="text.secondary">
                            ({rowCount.toLocaleString()} rows)
                        </Typography>
                    )}
                </Box>
            )}
        </Stack>
    );
}
