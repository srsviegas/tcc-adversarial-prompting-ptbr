import React, { useMemo, useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Typography, IconButton } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { CopyRowButton } from './CopyRowButton';
import { buildAllDataColumns } from '../utils/columnUtils';

export function LogDataGrid({ data, columnVisibilityModel, onColumnVisibilityModelChange }) {
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
            width: 48,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            resizable: false,
            align: 'center',
            renderCell: (params) => {
                const isExpanded = expandedRowIds.has(params.id);
                return (
                    <Box display="flex" justifyContent="center" height="100%">
                        <Box display="flex" alignItems="center" height="18px">
                            <IconButton
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRow(params.id);
                                }}
                                color="text.secondary"
                                sx={{
                                    width: '28px',
                                    height: '28px',
                                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.15s ease-in-out',
                                }}
                            >
                                <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: '0.75rem' }} />
                            </IconButton>
                        </Box>
                    </Box>
                );
            },
        };

        const builtColumns = buildAllDataColumns(data).map((col) => ({
            ...col,
            renderCell: (params) => {
                const val = params.value;
                const isExpanded = expandedRowIds.has(params.id);
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

        return [expandColumn, ...builtColumns, copyColumn];
    }, [data, expandedRowIds]);

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
