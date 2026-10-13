import React from 'react';
import {
  Box,
  Stack,
  Typography,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMagnifyingGlass,
  faXmark,
  faTable,
  faTableColumns,
  faTriangleExclamation,
  faShieldHalved,
  faScaleUnbalanced,
  faClock,
} from '@fortawesome/free-solid-svg-icons';

export function InspectionStatsBar({
  stats,
  filterVerdict,
  onFilterVerdictChange,
  filterLang,
  onFilterLangChange,
  searchTerm,
  onSearchChange,
  viewMode,
  onViewModeChange,
  totalFilteredCount,
}) {
  if (!stats) return null;

  const {
    totalRows,
    totalDangerousConsensus,
    totalSafeConsensus,
    totalSplitVotes,
    totalPendingQuorum,
  } = stats;

  const dangerousPct = totalRows > 0 ? ((totalDangerousConsensus / totalRows) * 100).toFixed(1) : '0';
  const safePct = totalRows > 0 ? ((totalSafeConsensus / totalRows) * 100).toFixed(1) : '0';

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
      {/* Metrics Row */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        mb={2.5}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" gap={1}>
          {/* Total Rows Metric */}
          <Box sx={{ px: 1.5, py: 0.75, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
            <Typography variant="caption" color="#64748b" fontWeight={600} display="block">
              TOTAL ROWS
            </Typography>
            <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
              {totalRows}
            </Typography>
          </Box>

          {/* Dangerous Metric */}
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              bgcolor: '#fef2f2',
              borderRadius: 1.5,
              border: '1px solid #fecaca',
            }}
          >
            <Typography variant="caption" color="#dc2626" fontWeight={700} display="block">
              ⚠️ DANGEROUS (2+)
            </Typography>
            <Typography variant="subtitle2" fontWeight={800} color="#991b1b">
              {totalDangerousConsensus} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>({dangerousPct}%)</span>
            </Typography>
          </Box>

          {/* Safe Metric */}
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              bgcolor: '#f0fdf4',
              borderRadius: 1.5,
              border: '1px solid #bbf7d0',
            }}
          >
            <Typography variant="caption" color="#16a34a" fontWeight={700} display="block">
              🛡️ SAFE
            </Typography>
            <Typography variant="subtitle2" fontWeight={800} color="#166534">
              {totalSafeConsensus} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>({safePct}%)</span>
            </Typography>
          </Box>

          {/* Split Votes / Disagreements Metric */}
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              bgcolor: totalSplitVotes > 0 ? '#fffbeb' : '#f8fafc',
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: totalSplitVotes > 0 ? '#fde68a' : '#e2e8f0',
            }}
          >
            <Typography
              variant="caption"
              color={totalSplitVotes > 0 ? '#b45309' : '#64748b'}
              fontWeight={700}
              display="block"
            >
              ⚔️ DISAGREEMENTS
            </Typography>
            <Typography
              variant="subtitle2"
              fontWeight={800}
              color={totalSplitVotes > 0 ? '#92400e' : '#0f172a'}
            >
              {totalSplitVotes}
            </Typography>
          </Box>

          {/* Pending Quorum Metric */}
          {totalPendingQuorum > 0 && (
            <Box
              sx={{
                px: 1.5,
                py: 0.75,
                bgcolor: '#f1f5f9',
                borderRadius: 1.5,
                border: '1px solid #cbd5e1',
              }}
            >
              <Typography variant="caption" color="#475569" fontWeight={700} display="block">
                ⏳ PENDING QUORUM
              </Typography>
              <Typography variant="subtitle2" fontWeight={800} color="#334155">
                {totalPendingQuorum}
              </Typography>
            </Box>
          )}
        </Stack>

        {/* View Mode Toggle Button */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, next) => next && onViewModeChange(next)}
          size="small"
          sx={{
            height: 36,
            '& .MuiToggleButton-root': {
              px: 1.5,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              color: '#475569',
              '&.Mui-selected': {
                bgcolor: '#eff6ff',
                color: '#2563eb',
              },
            },
          }}
        >
          <ToggleButton value="cards">
            <Stack direction="row" spacing={1} alignItems="center">
              <FontAwesomeIcon icon={faTableColumns} />
              <span>Cards Side-by-Side</span>
            </Stack>
          </ToggleButton>
          <ToggleButton value="table">
            <Stack direction="row" spacing={1} alignItems="center">
              <FontAwesomeIcon icon={faTable} />
              <span>Table</span>
            </Stack>
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      {/* Filter and Search Row */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
      >
        {/* Quick Filter Buttons */}
        <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
          <Chip
            label={`All (${totalRows})`}
            clickable
            color={filterVerdict === 'all' ? 'primary' : 'default'}
            variant={filterVerdict === 'all' ? 'filled' : 'outlined'}
            onClick={() => onFilterVerdictChange('all')}
            sx={{ fontWeight: 600, fontSize: '0.8rem' }}
          />
          <Chip
            icon={<FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: '0.75rem', color: '#dc2626' }} />}
            label={`Dangerous (${totalDangerousConsensus})`}
            clickable
            onClick={() => onFilterVerdictChange('dangerous')}
            sx={{
              fontWeight: 600,
              fontSize: '0.8rem',
              bgcolor: filterVerdict === 'dangerous' ? '#fee2e2' : '#ffffff',
              color: '#991b1b',
              borderColor: '#fca5a5',
              borderWidth: 1,
              borderStyle: 'solid',
            }}
          />
          <Chip
            icon={<FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: '0.75rem', color: '#16a34a' }} />}
            label={`Safe (${totalSafeConsensus})`}
            clickable
            onClick={() => onFilterVerdictChange('safe')}
            sx={{
              fontWeight: 600,
              fontSize: '0.8rem',
              bgcolor: filterVerdict === 'safe' ? '#dcfce7' : '#ffffff',
              color: '#166534',
              borderColor: '#86efac',
              borderWidth: 1,
              borderStyle: 'solid',
            }}
          />
          <Chip
            icon={<FontAwesomeIcon icon={faScaleUnbalanced} style={{ fontSize: '0.75rem', color: '#d97706' }} />}
            label={`Disagreements (${totalSplitVotes})`}
            clickable
            onClick={() => onFilterVerdictChange('disagreement')}
            sx={{
              fontWeight: 600,
              fontSize: '0.8rem',
              bgcolor: filterVerdict === 'disagreement' ? '#fef3c7' : '#ffffff',
              color: '#92400e',
              borderColor: '#fcd34d',
              borderWidth: 1,
              borderStyle: 'solid',
            }}
          />
          {totalPendingQuorum > 0 && (
            <Chip
              icon={<FontAwesomeIcon icon={faClock} style={{ fontSize: '0.75rem', color: '#64748b' }} />}
              label={`Pending (${totalPendingQuorum})`}
              clickable
              onClick={() => onFilterVerdictChange('pending')}
              sx={{
                fontWeight: 600,
                fontSize: '0.8rem',
                bgcolor: filterVerdict === 'pending' ? '#f1f5f9' : '#ffffff',
                color: '#334155',
                borderColor: '#cbd5e1',
                borderWidth: 1,
                borderStyle: 'solid',
              }}
            />
          )}

          {/* Language filter */}
          <ToggleButtonGroup
            value={filterLang}
            exclusive
            onChange={(_, val) => val && onFilterLangChange(val)}
            size="small"
            sx={{
              height: 28,
              ml: 1,
              '& .MuiToggleButton-root': {
                px: 1,
                py: 0,
                fontSize: '0.75rem',
                fontWeight: 600,
              },
            }}
          >
            <ToggleButton value="all">Lang: All</ToggleButton>
            <ToggleButton value="pt-BR">PT-BR</ToggleButton>
            <ToggleButton value="en">EN</ToggleButton>
          </ToggleButtonGroup>

          {totalFilteredCount !== undefined && totalFilteredCount !== totalRows && (
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, ml: 1 }}>
              Showing {totalFilteredCount} of {totalRows}
            </Typography>
          )}
        </Stack>

        {/* Search input */}
        <TextField
          size="small"
          placeholder="Search prompts or responses..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{
            minWidth: 260,
            maxWidth: 360,
            '& .MuiOutlinedInput-root': {
              height: 36,
              fontSize: '0.85rem',
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FontAwesomeIcon icon={faMagnifyingGlass} style={{ color: '#94a3b8', fontSize: '0.8rem' }} />
              </InputAdornment>
            ),
            endAdornment: searchTerm ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => onSearchChange('')}>
                  <FontAwesomeIcon icon={faXmark} style={{ fontSize: '0.75rem' }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
      </Stack>
    </Box>
  );
}
