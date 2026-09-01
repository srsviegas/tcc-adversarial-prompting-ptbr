import React from 'react';
import { Button, Stack, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolderOpen, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

export function LogDirectorySelector({ onSelect, isSelected }) {
    return (
        <Stack direction="row" alignItems="center" spacing={2}>
            <Button
                variant={isSelected ? 'outlined' : 'contained'}
                color="primary"
                onClick={onSelect}
                startIcon={<FontAwesomeIcon icon={faFolderOpen} />}
                py={1}
                sx={{
                    minWidth: 200,
                    boxShadow: isSelected ? 'none' : '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                }}
            >
                {isSelected ? 'Change Directory' : 'Open Logs Directory'}
            </Button>
            {isSelected && (
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" color="success.main" fontWeight={500}>
                        <FontAwesomeIcon icon={faCheckCircle} style={{ marginRight: '6px' }} />
                        Directory Connected
                    </Typography>
                </Stack>
            )}
        </Stack>
    );
}
