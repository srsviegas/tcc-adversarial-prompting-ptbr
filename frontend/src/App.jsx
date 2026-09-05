import React, { useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Tabs, Tab, Stack, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileLines, faDatabase } from '@fortawesome/free-solid-svg-icons';
import theme from './theme';
import LogViewerPage from './pages/LogViewerPage/LogViewerPage';
import DatasetViewerPage from './pages/DatasetViewerPage/DatasetViewerPage';

function App() {
    const [currentTab, setCurrentTab] = useState('dataset');

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box
                sx={{
                    borderBottom: '1px solid #e2e8f0',
                    bgcolor: '#ffffff',
                    px: 8,
                }}
            >
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                >
                    <Typography
                        variant="subtitle1"
                        fontWeight={800}
                        color="#0f172a"
                        letterSpacing="-0.02em"
                    >
                        Adversarial Prompting Dashboard
                    </Typography>
                    <Tabs
                        value={currentTab}
                        onChange={(_, val) => setCurrentTab(val)}
                        sx={{
                            minHeight: 48,
                            '& .MuiTab-root': {
                                minHeight: 48,
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                color: '#64748b',
                                gap: 1,
                                '&.Mui-selected': {
                                    color: '#2563eb',
                                },
                            },
                        }}
                    >
                        <Tab
                            value="dataset"
                            label="Dataset Viewer"
                            icon={
                                <FontAwesomeIcon
                                    icon={faDatabase}
                                    style={{ fontSize: '0.85rem' }}
                                />
                            }
                            iconPosition="start"
                        />
                        <Tab
                            value="logs"
                            label="Log Viewer"
                            icon={
                                <FontAwesomeIcon
                                    icon={faFileLines}
                                    style={{ fontSize: '0.85rem' }}
                                />
                            }
                            iconPosition="start"
                        />
                    </Tabs>
                </Stack>
            </Box>

            {currentTab === 'dataset' ? (
                <DatasetViewerPage />
            ) : (
                <LogViewerPage />
            )}
        </ThemeProvider>
    );
}

export default App;
