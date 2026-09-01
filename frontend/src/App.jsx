import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import LogViewerPage from './pages/LogViewerPage/LogViewerPage';

function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <LogViewerPage />
        </ThemeProvider>
    );
}

export default App;