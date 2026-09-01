import React from 'react';
import { Button, Stack, Box } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTableColumns } from '@fortawesome/free-solid-svg-icons';

export function ColumnSelectorButton({ onClick, visibleCount, totalCount }) {
    return (
        <Button
            variant="outlined"
            onClick={onClick}
            startIcon={<FontAwesomeIcon icon={faTableColumns} style={{ fontSize: '0.85rem' }} />}
            sx={{
                height: 40,
                py: 0.75,
                px: 1.75,
                borderRadius: 1.5,
                fontSize: '0.8125rem',
                borderColor: 'divider',
                color: 'text.primary',
                whiteSpace: 'nowrap',
                '&:hover': {
                    borderColor: '#cbd5e1',
                    bgcolor: '#f8fafc',
                },
            }}
        >
            <Stack direction="row" spacing={0.75} alignItems="center">
                <span>Columns</span>
                {totalCount !== undefined && (
                    <Box
                        component="span"
                        sx={{
                            bgcolor: '#f1f5f9',
                            color: 'text.secondary',
                            px: 0.75,
                            py: '1px',
                            borderRadius: '10px',
                            fontSize: '0.725rem',
                            fontWeight: 600,
                        }}
                    >
                        {visibleCount ?? 0}/{totalCount}
                    </Box>
                )}
            </Stack>
        </Button>
    );
}
