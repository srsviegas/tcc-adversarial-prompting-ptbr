import React from 'react';
import { Box, Chip, Typography, Stack } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTriangleExclamation,
  faShieldHalved,
  faScaleUnbalanced,
  faClock,
} from '@fortawesome/free-solid-svg-icons';

export function InspectionTableView({ rows, onRowClick }) {
  const columns = [
    {
      field: 'id',
      headerName: '#',
      width: 60,
      valueGetter: (value, row) => (row ? row.id + 1 : value),
    },
    {
      field: 'original_row_index',
      headerName: 'Row',
      width: 80,
    },
    {
      field: 'prompt_language',
      headerName: 'Lang',
      width: 80,
      valueGetter: (_, row) => row.inputs?.prompt_language || 'pt-BR',
      renderCell: (params) => (
        <Chip
          label={String(params.value).toUpperCase()}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.7rem',
            fontWeight: 700,
            bgcolor: params.value === 'en' ? '#e0f2fe' : '#fef3c7',
            color: params.value === 'en' ? '#0369a1' : '#92400e',
          }}
        />
      ),
    },
    {
      field: 'attack_style',
      headerName: 'Style',
      width: 120,
      valueGetter: (_, row) => row.inputs?.attack_style || 'plain',
    },
    {
      field: 'consensus',
      headerName: 'Consensus (2+ Rule)',
      width: 200,
      renderCell: (params) => {
        const cons = params.row?.evaluations?.consensus || {};
        if (!cons.has_quorum) {
          return (
            <Chip
              icon={<FontAwesomeIcon icon={faClock} style={{ fontSize: '0.7rem' }} />}
              label={`Pending (${cons.total_voted || 0}/2)`}
              size="small"
              sx={{ height: 22, fontSize: '0.7rem', bgcolor: '#f1f5f9', color: '#475569' }}
            />
          );
        }
        if (cons.consensus_dangerous === true) {
          return (
            <Chip
              icon={<FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: '0.7rem', color: '#dc2626' }} />}
              label={`Dangerous (${cons.votes_dangerous}/${cons.total_voted})`}
              size="small"
              sx={{ height: 22, fontSize: '0.7rem', fontWeight: 800, bgcolor: '#fee2e2', color: '#991b1b' }}
            />
          );
        }
        if (cons.consensus_dangerous === false) {
          return (
            <Chip
              icon={<FontAwesomeIcon icon={cons.is_disagreement ? faScaleUnbalanced : faShieldHalved} style={{ fontSize: '0.7rem', color: cons.is_disagreement ? '#d97706' : '#16a34a' }} />}
              label={cons.is_disagreement ? `Safe (Split: ${cons.votes_safe}/${cons.total_voted})` : `Safe (${cons.votes_safe}/${cons.total_voted})`}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 800,
                bgcolor: cons.is_disagreement ? '#fef3c7' : '#dcfce7',
                color: cons.is_disagreement ? '#92400e' : '#166534',
              }}
            />
          );
        }
        return <Typography variant="caption" color="#94a3b8">-</Typography>;
      },
    },
    {
      field: 'user_prompt',
      headerName: 'Input Prompt',
      flex: 1,
      minWidth: 240,
      valueGetter: (_, row) => row.inputs?.user_input_raw || row.inputs?.user_prompt || '',
      renderCell: (params) => (
        <Typography variant="body2" noWrap sx={{ color: '#1e293b' }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'extracted_text',
      headerName: 'Target Response',
      flex: 1,
      minWidth: 240,
      valueGetter: (_, row) => row.output?.extracted_text || '',
      renderCell: (params) => (
        <Typography variant="body2" noWrap sx={{ color: '#0f172a' }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'llamaguard_verdict',
      headerName: 'LlamaGuard',
      width: 130,
      renderCell: (params) => {
        const ev = params.row?.evaluations?.llamaguard || {};
        if (ev.status === 'missing') return <Chip label="-" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />;
        if (ev.status === 'error') return <Chip label="Error" size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />;
        if (ev.flagged) {
          return (
            <Chip
              label="Unsafe"
              size="small"
              sx={{ height: 22, bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 800, fontSize: '0.7rem' }}
            />
          );
        }
        return (
          <Chip
            label="Safe"
            size="small"
            sx={{ height: 22, bgcolor: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: '0.7rem' }}
          />
        );
      },
    },
    {
      field: 'qwen_score',
      headerName: 'Qwen Score',
      width: 120,
      renderCell: (params) => {
        const ev = params.row?.evaluations?.qwen_judge || {};
        if (ev.status === 'missing' || ev.score === null) return <Chip label="-" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />;
        const score = ev.score;
        const color = score >= 4 ? '#991b1b' : score === 3 ? '#92400e' : '#166534';
        const bg = score >= 4 ? '#fee2e2' : score === 3 ? '#fef3c7' : '#dcfce7';
        return (
          <Chip
            label={`Score ${score}/5`}
            size="small"
            sx={{ height: 22, bgcolor: bg, color: color, fontWeight: 800, fontSize: '0.7rem' }}
          />
        );
      },
    },
    {
      field: 'gemma_score',
      headerName: 'Gemma Score',
      width: 120,
      renderCell: (params) => {
        const ev = params.row?.evaluations?.gemma_judge || {};
        if (ev.status === 'missing' || ev.score === null) return <Chip label="-" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />;
        const score = ev.score;
        const color = score >= 4 ? '#991b1b' : score === 3 ? '#92400e' : '#166534';
        const bg = score >= 4 ? '#fee2e2' : score === 3 ? '#fef3c7' : '#dcfce7';
        return (
          <Chip
            label={`Score ${score}/5`}
            size="small"
            sx={{ height: 22, bgcolor: bg, color: color, fontWeight: 800, fontSize: '0.7rem' }}
          />
        );
      },
    },
  ];

  return (
    <Box sx={{ width: '100%', height: 650, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #e2e8f0' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        pageSizeOptions={[10, 25, 50, 100]}
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } },
        }}
        onRowClick={(params) => onRowClick && onRowClick(params.row)}
        disableRowSelectionOnClick
        density="compact"
        sx={{
          border: 'none',
          '& .MuiDataGrid-row:hover': {
            cursor: 'pointer',
            bgcolor: '#f8fafc',
          },
        }}
      />
    </Box>
  );
}
