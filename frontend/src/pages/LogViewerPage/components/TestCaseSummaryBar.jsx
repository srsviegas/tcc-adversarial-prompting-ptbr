import React from 'react';
import { Stack, Box, Typography, Chip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFlask, faListOl, faLanguage, faBullseye, faLayerGroup } from '@fortawesome/free-solid-svg-icons';

function StatChip({ icon, label, value }) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 2,
                py: 1.25,
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 2,
            }}
        >
            <Box
                sx={{
                    width: 30,
                    height: 30,
                    borderRadius: 1.5,
                    bgcolor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}
            >
                <FontAwesomeIcon icon={icon} style={{ fontSize: '0.75rem' }} />
            </Box>
            <Box>
                <Typography variant="caption" color="text.secondary" fontSize="0.7rem" lineHeight={1.2} display="block">
                    {label}
                </Typography>
                <Typography variant="body2" fontWeight={700} color="#0f172a" fontSize="0.9rem" lineHeight={1.3}>
                    {value}
                </Typography>
            </Box>
        </Box>
    );
}

export function TestCaseSummaryBar({ testCases, dimensions, totalEntries }) {
    return (
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <StatChip
                icon={faFlask}
                label="Test Cases"
                value={testCases.length}
            />
            <StatChip
                icon={faListOl}
                label="Total Entries"
                value={totalEntries.toLocaleString()}
            />
            <StatChip
                icon={faBullseye}
                label="Categories"
                value={dimensions.categories.length}
            />
            <StatChip
                icon={faLanguage}
                label="Languages"
                value={dimensions.languages.join(', ')}
            />
            <StatChip
                icon={faLayerGroup}
                label="Styles"
                value={dimensions.styles.join(', ')}
            />
        </Stack>
    );
}
