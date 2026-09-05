import React, { useMemo, useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Typography, IconButton, Tooltip, Chip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChevronRight,
    faCodeCompare,
    faCopy,
    faCheck,
} from '@fortawesome/free-solid-svg-icons';
import {
    orderColumnsSideBySide,
    findTranslationPairs,
    formatDatasetHeader,
    getDatasetColumnDimensions,
} from '../utils/datasetColumnUtils';

export function DatasetDataGrid({
    data,
    columns: rawColumns,
    onOpenSideBySide,
    columnVisibilityModel,
    onColumnVisibilityModelChange,
}) {
    const [expandedRowIds, setExpandedRowIds] = useState(new Set());
    const [copiedRowId, setCopiedRowId] = useState(null);

    const toggleRow = (id) => {
        setExpandedRowIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleCopyRow = (row) => {
        navigator.clipboard.writeText(JSON.stringify(row, null, 2));
        setCopiedRowId(row.id);
        setTimeout(() => setCopiedRowId(null), 1500);
    };

    const { pairs } = useMemo(() => {
        const colList =
            rawColumns ||
            (data && data[0]
                ? Object.keys(data[0]).filter((k) => k !== 'id')
                : []);
        return findTranslationPairs(colList);
    }, [rawColumns, data]);

    const gridColumns = useMemo(() => {
        if (!data || data.length === 0) return [];

        const colList =
            rawColumns || Object.keys(data[0]).filter((k) => k !== 'id');
        const ordered = orderColumnsSideBySide(colList);

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
                    <Box
                        display="flex"
                        justifyContent="center"
                        alignItems="center"
                        height="100%"
                    >
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleRow(params.id);
                            }}
                            sx={{
                                width: 26,
                                height: 26,
                                transform: isExpanded
                                    ? 'rotate(90deg)'
                                    : 'rotate(0deg)',
                                transition: 'transform 0.15s ease-in-out',
                            }}
                        >
                            <FontAwesomeIcon
                                icon={faChevronRight}
                                style={{ fontSize: '0.75rem' }}
                            />
                        </IconButton>
                    </Box>
                );
            },
        };

        const actionColumn = {
            field: '__compare__',
            headerName: 'Compare',
            width: 80,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            align: 'center',
            renderCell: (params) => (
                <Tooltip title="View original and translation side by side">
                    <IconButton
                        size="small"
                        color="primary"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenSideBySide) onOpenSideBySide(params.row);
                        }}
                        sx={{ width: 28, height: 28 }}
                    >
                        <FontAwesomeIcon
                            icon={faCodeCompare}
                            style={{ fontSize: '0.8rem' }}
                        />
                    </IconButton>
                </Tooltip>
            ),
        };

        const dataCols = ordered.map((field) => {
            const isTranslation = field.endsWith('_pt');
            const isOriginal = pairs.some((p) => p.original === field);
            const dimensions = getDatasetColumnDimensions(field);

            return {
                field,
                headerName: formatDatasetHeader(field),
                flex: dimensions.flex,
                minWidth: dimensions.minWidth,
                renderHeader: () => (
                    <Box display="flex" alignItems="center" gap={0.75}>
                        <span>{formatDatasetHeader(field)}</span>
                        {isTranslation && (
                            <Chip
                                label="PT-BR"
                                size="small"
                                sx={{
                                    height: 18,
                                    fontSize: '0.625rem',
                                    fontWeight: 700,
                                    bgcolor: '#dcfce7',
                                    color: '#166534',
                                }}
                            />
                        )}
                        {isOriginal && (
                            <Chip
                                label="EN"
                                size="small"
                                sx={{
                                    height: 18,
                                    fontSize: '0.625rem',
                                    fontWeight: 700,
                                    bgcolor: '#dbeafe',
                                    color: '#1e40af',
                                }}
                            />
                        )}
                    </Box>
                ),
                renderCell: (params) => {
                    const val = params.value;
                    const isExpanded = expandedRowIds.has(params.id);
                    const displayVal =
                        val !== undefined && val !== null ? String(val) : '';

                    return (
                        <Box
                            sx={{
                                whiteSpace: isExpanded ? 'pre-wrap' : 'nowrap',
                                wordBreak: isExpanded ? 'break-word' : 'normal',
                                overflow: isExpanded ? 'visible' : 'hidden',
                                textOverflow: isExpanded ? 'clip' : 'ellipsis',
                                width: '100%',
                                bgcolor:
                                    isTranslation && isExpanded
                                        ? '#f0fdf4'
                                        : 'transparent',
                                borderRadius: 1,
                                p: isExpanded ? 0.5 : 0,
                            }}
                        >
                            {displayVal}
                        </Box>
                    );
                },
            };
        });

        const copyColumn = {
            field: '__copy__',
            headerName: '',
            width: 44,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            align: 'center',
            renderCell: (params) => (
                <Tooltip
                    title={
                        copiedRowId === params.id ? 'Copied' : 'Copy row JSON'
                    }
                >
                    <IconButton
                        size="small"
                        onClick={() => handleCopyRow(params.row)}
                    >
                        <FontAwesomeIcon
                            icon={copiedRowId === params.id ? faCheck : faCopy}
                            style={{
                                fontSize: '0.75rem',
                                color:
                                    copiedRowId === params.id
                                        ? '#16a34a'
                                        : '#64748b',
                            }}
                        />
                    </IconButton>
                </Tooltip>
            ),
        };

        return [expandColumn, actionColumn, ...dataCols, copyColumn];
    }, [
        data,
        rawColumns,
        expandedRowIds,
        copiedRowId,
        pairs,
        onOpenSideBySide,
    ]);

    if (!data || data.length === 0) {
        return (
            <Box
                p={4}
                textAlign="center"
                bgcolor="background.paper"
                borderRadius={2}
                border="1px solid"
                borderColor="divider"
            >
                <Typography variant="body2" color="text.secondary">
                    No dataset loaded. Select a parquet or csv file above.
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
                columns={gridColumns}
                columnVisibilityModel={columnVisibilityModel}
                onColumnVisibilityModelChange={onColumnVisibilityModelChange}
                getRowHeight={(params) =>
                    expandedRowIds.has(params.id) ? 'auto' : null
                }
                pageSizeOptions={[10, 25, 50, 100]}
                initialState={{
                    pagination: { paginationModel: { pageSize: 50 } },
                }}
                disableRowSelectionOnClick
                onRowDoubleClick={(params) =>
                    onOpenSideBySide && onOpenSideBySide(params.row)
                }
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
                    '&.MuiDataGrid-root--densityStandard .MuiDataGrid-cell': {
                        py: '14px',
                        display: 'flex',
                        alignItems: 'center',
                    },
                }}
            />
        </Box>
    );
}
