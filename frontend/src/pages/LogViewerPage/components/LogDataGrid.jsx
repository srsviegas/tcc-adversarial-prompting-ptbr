import React, { useMemo, useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Typography, IconButton, Tooltip, Chip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faEye, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { CopyRowButton } from './CopyRowButton';
import { buildAllDataColumns } from '../utils/columnUtils';

export function LogDataGrid({
    data,
    columnVisibilityModel,
    onColumnVisibilityModelChange,
    onOpenRowDetails,
}) {
    const [expandedRowIds, setExpandedRowIds] = useState(new Set());

    const toggleRow = (id) => {
        setExpandedRowIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const columns = useMemo(() => {
        if (!data || data.length === 0) return [];

        const expandColumn = {
            field: '__expand__',
            headerName: '',
            width: 44,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            resizable: false,
            align: 'center',
            renderCell: (params) => {
                const isExpanded = expandedRowIds.has(params.id);
                return (
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(params.id);
                        }}
                        sx={{
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            width: 28,
                            height: 28,
                            color: isExpanded ? 'primary.main' : 'text.secondary',
                        }}
                    >
                        <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: '0.75rem' }} />
                    </IconButton>
                );
            },
        };

        const actionColumn = {
            field: '__details__',
            headerName: 'Detail',
            width: 56,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            resizable: false,
            align: 'center',
            renderCell: (params) => (
                <Tooltip title="View full row data">
                    <IconButton
                        size="small"
                        color="primary"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenRowDetails) onOpenRowDetails(params.row);
                        }}
                        sx={{ width: 28, height: 28 }}
                    >
                        <FontAwesomeIcon icon={faEye} style={{ fontSize: '0.8rem' }} />
                    </IconButton>
                </Tooltip>
            ),
        };

        const builtColumns = buildAllDataColumns(data).map((col) => ({
            ...col,
            renderCell: (params) => {
                const val = params.value;
                const isExpanded = expandedRowIds.has(params.id);

                // Dedicated Chip for evaluation verdict
                if (col.field === 'evaluation_result.verdict') {
                    const verdict = String(val || '').toLowerCase();
                    if (!verdict) return <Typography variant="caption" color="text.secondary">—</Typography>;
                    const isUnsafe = verdict === 'unsafe' || verdict === 'hit';
                    return (
                        <Chip
                            label={isUnsafe ? 'Unsafe (Hit)' : 'Safe'}
                            size="small"
                            icon={<FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: '0.7rem' }} />}
                            sx={{
                                height: 22,
                                fontSize: '0.725rem',
                                fontWeight: 700,
                                bgcolor: isUnsafe ? '#fef2f2' : '#f0fdf4',
                                color: isUnsafe ? '#dc2626' : '#16a34a',
                                border: `1px solid ${isUnsafe ? '#fecaca' : '#bbf7d0'}`,
                                '& .MuiChip-icon': {
                                    color: isUnsafe ? '#dc2626' : '#16a34a',
                                    marginLeft: '6px',
                                },
                            }}
                        />
                    );
                }

                // Dedicated Chip for ASR hit
                if (col.field === 'evaluation.attack_success_rate_hit') {
                    if (val === null || val === undefined) {
                        return <Typography variant="caption" color="text.secondary">—</Typography>;
                    }
                    const isHit = val === true || val === 1;
                    return (
                        <Chip
                            label={isHit ? 'ASR Hit' : 'Safe'}
                            size="small"
                            sx={{
                                height: 22,
                                fontSize: '0.725rem',
                                fontWeight: 700,
                                bgcolor: isHit ? '#fef2f2' : '#f0fdf4',
                                color: isHit ? '#dc2626' : '#16a34a',
                                border: `1px solid ${isHit ? '#fecaca' : '#bbf7d0'}`,
                            }}
                        />
                    );
                }

                // Dedicated Chip for flagged categories
                if (col.field === 'evaluation_result.flagged_categories' && val) {
                    return (
                        <Chip
                            label={val}
                            size="small"
                            sx={{
                                height: 21,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                bgcolor: '#fff7ed',
                                color: '#c2410c',
                                border: '1px solid #fed7aa',
                            }}
                        />
                    );
                }

                // Dedicated styling for ciphered response
                if (col.field === 'output.ciphered_text' && val) {
                    return (
                        <Box
                            sx={{
                                fontFamily: 'monospace',
                                fontSize: '0.75rem',
                                bgcolor: 'rgba(99, 102, 241, 0.08)',
                                px: 1,
                                py: 0.25,
                                borderRadius: 1,
                                overflow: 'hidden',
                                textOverflow: isExpanded ? 'clip' : 'ellipsis',
                                whiteSpace: isExpanded ? 'pre-wrap' : 'nowrap',
                                wordBreak: 'break-all',
                                color: '#4338ca',
                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                width: '100%',
                            }}
                        >
                            {String(val)}
                        </Box>
                    );
                }

                let displayVal = '';
                if (typeof val === 'object' && val !== null) {
                    displayVal = isExpanded ? JSON.stringify(val, null, 2) : JSON.stringify(val);
                } else {
                    displayVal = String(val !== undefined && val !== null ? val : '');
                }

                return (
                    <Box
                        sx={{
                            whiteSpace: isExpanded ? 'pre-wrap' : 'nowrap',
                            wordBreak: isExpanded ? 'break-word' : 'normal',
                            overflow: isExpanded ? 'visible' : 'hidden',
                            textOverflow: isExpanded ? 'clip' : 'ellipsis',
                            width: '100%',
                            fontFamily: isExpanded && typeof val === 'object' ? 'monospace' : 'inherit',
                        }}
                    >
                        {displayVal}
                    </Box>
                );
            },
        }));

        const copyColumn = {
            field: '__copy__',
            headerName: '',
            width: 48,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            resizable: false,
            align: 'center',
            renderCell: (params) => <CopyRowButton row={params.row} />,
        };

        return [expandColumn, actionColumn, ...builtColumns, copyColumn];
    }, [data, expandedRowIds, onOpenRowDetails]);


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
        <Box
            height="77vh"
            width="100%"
            bgcolor="background.paper"
            borderRadius={2}
            border="1px solid"
            borderColor="divider"
            overflow="hidden"
        >
            <DataGrid
                rows={data}
                columns={columns}
                columnVisibilityModel={columnVisibilityModel}
                onColumnVisibilityModelChange={onColumnVisibilityModelChange}
                getRowHeight={(params) => (expandedRowIds.has(params.id) ? 'auto' : null)}
                pageSizeOptions={[10, 25, 50, 100]}
                initialState={{
                    pagination: { paginationModel: { pageSize: 50 } },
                }}
                disableRowSelectionOnClick
                onRowDoubleClick={(params) => onOpenRowDetails && onOpenRowDetails(params.row)}
                sx={{
                    border: 'none',
                    '& .MuiDataGrid-columnHeaders': {
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    },
                    '& .MuiDataGrid-columnHeaderTitle': {
                        fontWeight: 600,
                    },
                    '& .MuiDataGrid-cell': {
                        borderBottom: '1px solid',
                        borderColor: '#f1f5f9',
                        color: 'text.primary',
                        fontSize: '0.875rem',
                        alignItems: 'flex-start',
                        py: 0.5,
                    },
                    '& .MuiDataGrid-row:hover': {
                        backgroundColor: '#f8fafc',
                    },
                    '& .MuiDataGrid-row.Mui-selected': {
                        backgroundColor: '#eff6ff',
                        '&:hover': {
                            backgroundColor: '#dbeafe',
                        },
                    },
                    '& .MuiDataGrid-columnSeparator': {
                        display: 'none',
                    },
                    '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
                        outline: 'none',
                    },
                    '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
                        outline: 'none',
                    },
                    '& .MuiDataGrid-footerContainer': {
                        borderTop: '1px solid',
                        borderColor: 'divider',
                    },
                    '&.MuiDataGrid-root--densityStandard .MuiDataGrid-cell': {
                        py: '16px',
                        display: 'flex',
                        alignItems: 'center',
                    },
                }}
            />
        </Box>
    );
}
