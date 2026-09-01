import React, { useMemo, useState } from 'react';
import {
    Box,
    Typography,
    Stack,
    TextField,
    InputAdornment,
    IconButton,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faXmark, faFlask } from '@fortawesome/free-solid-svg-icons';
import { groupByTestCase, collectAllDimensions } from '../utils/testCaseUtils';
import { TestCaseSummaryBar } from './TestCaseSummaryBar';
import { TestCaseCard } from './TestCaseCard';

export function TestCaseAnalysisView({ data }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    const testCases = useMemo(() => groupByTestCase(data), [data]);
    const dimensions = useMemo(() => collectAllDimensions(testCases), [testCases]);

    const filteredTestCases = useMemo(() => {
        let result = testCases;

        if (categoryFilter) {
            result = result.filter((tc) => tc.attackCategory === categoryFilter);
        }

        const query = searchQuery.trim();
        if (query) {
            result = result.filter(
                (tc) =>
                    String(tc.rowIndex).includes(query) ||
                    tc.attackCategory.toLowerCase().includes(query.toLowerCase()) ||
                    tc.sourceFileName.toLowerCase().includes(query.toLowerCase()) ||
                    tc.userInputRaw.toLowerCase().includes(query.toLowerCase())
            );
        }

        return result;
    }, [testCases, searchQuery, categoryFilter]);

    if (!data || data.length === 0) {
        return (
            <Box p={3} textAlign="center" bgcolor="background.paper" borderRadius={2} border="1px solid" borderColor="divider">
                <Typography variant="body2" color="text.secondary">
                    No data to display. Select a valid file.
                </Typography>
            </Box>
        );
    }

    return (
        <Stack spacing={2.5}>
            <TestCaseSummaryBar
                testCases={testCases}
                dimensions={dimensions}
                totalEntries={data.length}
            />

            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <TextField
                    size="small"
                    placeholder="Search by row index, category, or prompt..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    sx={{
                        minWidth: 280,
                        flex: 1,
                        maxWidth: 420,
                        bgcolor: 'background.paper',
                        borderRadius: 1.5,
                    }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <FontAwesomeIcon icon={faMagnifyingGlass} style={{ fontSize: '0.85rem', color: '#94a3b8' }} />
                            </InputAdornment>
                        ),
                        endAdornment: searchQuery ? (
                            <InputAdornment position="end">
                                <IconButton size="small" onClick={() => setSearchQuery('')}>
                                    <FontAwesomeIcon icon={faXmark} style={{ fontSize: '0.75rem' }} />
                                </IconButton>
                            </InputAdornment>
                        ) : null,
                    }}
                />

                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Category</InputLabel>
                    <Select
                        value={categoryFilter}
                        label="Category"
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <MenuItem value="">All Categories</MenuItem>
                        {dimensions.categories.map((cat) => (
                            <MenuItem key={cat} value={cat}>
                                {cat}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Typography variant="body2" color="text.secondary" fontSize="0.8rem" fontWeight={500}>
                    {filteredTestCases.length} of {testCases.length} test cases
                </Typography>
            </Stack>

            {filteredTestCases.length === 0 ? (
                <Box
                    sx={{
                        py: 6,
                        textAlign: 'center',
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                    }}
                >
                    <Box
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            bgcolor: '#f1f5f9',
                            color: '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mx: 'auto',
                            mb: 1.5,
                        }}
                    >
                        <FontAwesomeIcon icon={faFlask} style={{ fontSize: '1.1rem' }} />
                    </Box>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                        No test cases match your filters.
                    </Typography>
                </Box>
            ) : (
                <Stack spacing={1.25}>
                    {filteredTestCases.map((tc) => (
                        <TestCaseCard key={tc.key} testCase={tc} />
                    ))}
                </Stack>
            )}
        </Stack>
    );
}
