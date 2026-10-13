import React from 'react';
import {
  Box,
  Stack,
  Button,
  FormControl,
  Select,
  MenuItem,
  Typography,
  Chip,
  Tooltip,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFolderTree,
  faScaleBalanced,
  faRotateRight,
  faFileLines,
} from '@fortawesome/free-solid-svg-icons';

export function InspectionWorkspaceSelector({
  logsDirHandle,
  evaluationsDirHandle,
  availableFiles,
  selectedFile,
  onFileSelect,
  onSelectProjectRoot,
  onSelectLogsDir,
  onSelectEvaluationsDir,
  onRefresh,
  loading,
}) {
  const isLogsReady = Boolean(logsDirHandle);
  const isEvalReady = Boolean(evaluationsDirHandle);

  return (
    <Box
      sx={{
        bgcolor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 2,
        p: 2.5,
        mb: 3,
        boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
        {/* Folder Selectors */}
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" gap={1}>
          <Tooltip title="Select the main project folder (e.g. tcc/) to automatically connect both logs/ and evaluations/">
            <Button
              variant="contained"
              onClick={onSelectProjectRoot}
              disabled={loading}
              startIcon={<FontAwesomeIcon icon={faFolderTree} />}
              sx={{
                bgcolor: '#0f172a',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.85rem',
                border: 'none',
                '&:hover': {
                  bgcolor: '#1e293b',
                },
              }}
            >
              Open Project Folder
            </Button>
          </Tooltip>

          <Button
            variant="outlined"
            onClick={onSelectLogsDir}
            disabled={loading}
            startIcon={<FontAwesomeIcon icon={faFileLines} />}
            sx={{
              fontSize: '0.85rem',
              fontWeight: 600,
              borderColor: isLogsReady ? '#22c55e' : '#cbd5e1',
              color: isLogsReady ? '#15803d' : '#475569',
              bgcolor: isLogsReady ? '#f0fdf4' : '#ffffff',
            }}
          >
            {isLogsReady ? 'Logs Folder ✓' : 'Select Logs...'}
          </Button>

          <Button
            variant="outlined"
            onClick={onSelectEvaluationsDir}
            disabled={loading}
            startIcon={<FontAwesomeIcon icon={faScaleBalanced} />}
            sx={{
              fontSize: '0.85rem',
              fontWeight: 600,
              borderColor: isEvalReady ? '#22c55e' : '#cbd5e1',
              color: isEvalReady ? '#15803d' : '#475569',
              bgcolor: isEvalReady ? '#f0fdf4' : '#ffffff',
            }}
          >
            {isEvalReady ? 'Evaluations Folder ✓' : 'Select Evaluations...'}
          </Button>

          {isLogsReady && (
            <Tooltip title="Refresh file lists">
              <Button
                variant="outlined"
                onClick={onRefresh}
                disabled={loading}
                sx={{ minWidth: 40, px: 1.5 }}
              >
                <FontAwesomeIcon icon={faRotateRight} />
              </Button>
            </Tooltip>
          )}
        </Stack>

        {/* File Selector Dropdown */}
        <Box sx={{ minWidth: 360, maxWidth: { xs: '100%', md: 540 }, width: '100%' }}>
          <FormControl fullWidth size="small">
            <Select
              value={selectedFile}
              onChange={(e) => onFileSelect(e.target.value)}
              displayEmpty
              disabled={availableFiles.length === 0 || loading}
              renderValue={(selected) => {
                if (!selected) {
                  return (
                    <Typography variant="body2" color="#94a3b8">
                      {availableFiles.length > 0 ? 'Select a benchmark log file...' : 'Open folder to view files'}
                    </Typography>
                  );
                }
                const fObj = availableFiles.find((f) => f.name === selected);
                return (
                  <Stack direction="row" alignItems="center" spacing={1} overflow="hidden">
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      color="#0f172a"
                      noWrap
                      sx={{ maxWidth: 300 }}
                    >
                      {selected}
                    </Typography>
                    {fObj && (
                      <Stack direction="row" spacing={0.5}>
                        {fObj.hasLlamaGuard && (
                          <Chip label="Llama" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f1f5f9' }} />
                        )}
                        {fObj.hasQwenJudge && (
                          <Chip label="Qwen" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f1f5f9' }} />
                        )}
                        {fObj.hasGemmaJudge && (
                          <Chip label="Gemma" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f1f5f9' }} />
                        )}
                        {fObj.hasConsensus && (
                          <Chip label="Consensus" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 600 }} />
                        )}
                      </Stack>
                    )}
                  </Stack>
                );
              }}
              sx={{
                bgcolor: '#ffffff',
                '& .MuiSelect-select': {
                  py: 1,
                },
              }}
            >
              {availableFiles.map((f) => (
                <MenuItem key={f.name} value={f.name}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" width="100%" spacing={2}>
                    <Typography variant="body2" fontWeight={500} color="#1e293b">
                      {f.name}
                    </Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Chip
                        label={f.hasLog ? 'Log ✓' : 'No Log'}
                        size="small"
                        color={f.hasLog ? 'default' : 'error'}
                        variant={f.hasLog ? 'outlined' : 'filled'}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                      <Chip
                        label={`${f.judgesCount} Judge${f.judgesCount !== 1 ? 's' : ''}`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          bgcolor: f.judgesCount >= 2 ? '#dcfce7' : f.judgesCount === 1 ? '#fef3c7' : '#f1f5f9',
                          color: f.judgesCount >= 2 ? '#166534' : f.judgesCount === 1 ? '#92400e' : '#64748b',
                          fontWeight: 600,
                        }}
                      />
                    </Stack>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Stack>
    </Box>
  );
}
