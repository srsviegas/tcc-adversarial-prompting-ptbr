import React, { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faCheck } from '@fortawesome/free-solid-svg-icons';

export function CopyRowButton({ row }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(JSON.stringify(row, null, 2));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy row JSON', err);
        }
    };

    return (
        <Box
            display="flex"
            justifyContent="center"
            height="100%"
        >
            <Box
                display="flex"
                alignItems="center"
                height="18px"
            >
                <Tooltip title={copied ? 'Copied JSON!' : 'Copy row JSON'} arrow placement="left">
                    <IconButton
                        onClick={handleCopy}
                        size="small"
                        color="text.secondary"
                        sx={{
                            width: '28px',
                            height: '28px',
                            color: 'text.secondary',
                            '&:hover': {
                                color: 'text.primary',
                            },
                        }}
                    >
                        <FontAwesomeIcon icon={copied ? faCheck : faCopy} style={{ fontSize: '0.8rem' }} />
                    </IconButton>
                </Tooltip>
            </Box>
        </Box>
    );
}
