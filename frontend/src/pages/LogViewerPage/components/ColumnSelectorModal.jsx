import React, { useState, useMemo } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Typography,
    IconButton,
    TextField,
    Button,
    Stack,
    Checkbox,
    FormControlLabel,
    Chip,
    Divider,
    InputAdornment,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTableColumns,
    faXmark,
    faMagnifyingGlass,
    faRotateLeft,
    faCheckDouble,
    faTimesCircle,
} from '@fortawesome/free-solid-svg-icons';
import { getFieldIcon, getCategoryIcon } from '../utils/columnUtils';

export function ColumnSelectorModal({
    open,
    onClose,
    columns,
    columnVisibilityModel,
    onToggleColumn,
    onSelectAll,
    onDeselectAll,
    onResetToDefaults,
    onToggleCategory,
}) {
    const [searchQuery, setSearchQuery] = useState('');

    // Filter out internal non-data columns
    const selectableColumns = useMemo(() => {
        return (columns || []).filter(
            (c) => c.field !== '__expand__' && c.field !== '__copy__'
        );
    }, [columns]);

    // Group columns by category
    const groupedColumns = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const groups = {};

        selectableColumns.forEach((col) => {
            const matchesQuery =
                !query ||
                col.headerName.toLowerCase().includes(query) ||
                col.field.toLowerCase().includes(query) ||
                (col.category && col.category.toLowerCase().includes(query));

            if (!matchesQuery) return;

            const category = col.category || 'Other';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(col);
        });

        return groups;
    }, [selectableColumns, searchQuery]);

    // Calculate overall stats
    const totalCount = selectableColumns.length;
    const visibleCount = useMemo(() => {
        return selectableColumns.filter((c) => columnVisibilityModel[c.field] !== false).length;
    }, [selectableColumns, columnVisibilityModel]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    maxHeight: '88vh',
                    width: '94vw',
                    maxWidth: '1080px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                },
            }}
        >
            {/* Header */}
            <DialogTitle sx={{ pb: 1.75, pt: 2.5, px: 3.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1.75}>
                        <Box
                            sx={{
                                width: 38,
                                height: 38,
                                borderRadius: 2,
                                bgcolor: '#f1f5f9',
                                color: '#334155',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <FontAwesomeIcon icon={faTableColumns} style={{ fontSize: '0.95rem' }} />
                        </Box>
                        <Box>
                            <Typography variant="h6" fontWeight={700} fontSize="1.15rem" color="#0f172a" lineHeight={1.2}>
                                Manage Columns
                            </Typography>
                            <Typography variant="caption" color="text.secondary" fontSize="0.775rem">
                                Select which columns to show in the data grid. Saved automatically to your browser.
                            </Typography>
                        </Box>
                    </Stack>
                    <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
                        <FontAwesomeIcon icon={faXmark} />
                    </IconButton>
                </Stack>
            </DialogTitle>

            <Divider />

            {/* Controls Bar */}
            <Box px={3.5} py={1.75} bgcolor="#f8fafc">
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                >
                    <TextField
                        size="small"
                        placeholder="Search columns or categories..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        sx={{
                            minWidth: 260,
                            flex: 1,
                            maxWidth: 380,
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

                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip
                            label={`${visibleCount} of ${totalCount} visible`}
                            size="small"
                            sx={{
                                fontWeight: 600,
                                bgcolor: '#e2e8f0',
                                color: '#334155',
                                mr: 0.5,
                                fontSize: '0.75rem',
                            }}
                        />

                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => onSelectAll(selectableColumns)}
                            startIcon={<FontAwesomeIcon icon={faCheckDouble} style={{ fontSize: '0.75rem' }} />}
                            sx={{ fontSize: '0.775rem', py: 0.5, px: 1.25 }}
                        >
                            All
                        </Button>

                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => onDeselectAll(selectableColumns)}
                            startIcon={<FontAwesomeIcon icon={faTimesCircle} style={{ fontSize: '0.75rem' }} />}
                            sx={{ fontSize: '0.775rem', py: 0.5, px: 1.25 }}
                        >
                            None
                        </Button>

                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => onResetToDefaults(selectableColumns)}
                            startIcon={<FontAwesomeIcon icon={faRotateLeft} style={{ fontSize: '0.75rem' }} />}
                            sx={{ fontSize: '0.775rem', py: 0.5, px: 1.25 }}
                        >
                            Default
                        </Button>
                    </Stack>
                </Stack>
            </Box>

            <Divider />

            {/* Column Categories Body */}
            <DialogContent sx={{ p: 3.5, overflowY: 'auto', overflowX: 'hidden' }}>
                {Object.keys(groupedColumns).length === 0 ? (
                    <Box py={8} textAlign="center">
                        <Typography variant="body2" color="text.secondary">
                            No columns matching "{searchQuery}"
                        </Typography>
                    </Box>
                ) : (
                    <Stack spacing={3}>
                        {Object.entries(groupedColumns).map(([category, catColumns]) => {
                            const categoryFields = catColumns.map((c) => c.field);
                            const categoryVisibleCount = catColumns.filter(
                                (c) => columnVisibilityModel[c.field] !== false
                            ).length;
                            const isAllCategoryVisible = categoryVisibleCount === catColumns.length;

                            return (
                                <Box
                                    key={category}
                                    sx={{
                                        border: '1px solid',
                                        borderColor: '#e2e8f0',
                                        borderRadius: 2.5,
                                        p: 2.5,
                                        bgcolor: 'background.paper',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {/* Category Header */}
                                    <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="center"
                                        mb={2}
                                        pb={1.5}
                                        borderBottom="1px solid"
                                        borderColor="#f1f5f9"
                                        spacing={1}
                                    >
                                        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
                                            <Box
                                                sx={{
                                                    width: 28,
                                                    height: 28,
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
                                                <FontAwesomeIcon icon={getCategoryIcon(category)} style={{ fontSize: '0.8rem' }} />
                                            </Box>
                                            <Typography
                                                variant="subtitle2"
                                                fontWeight={700}
                                                fontSize="0.95rem"
                                                color="#0f172a"
                                                noWrap
                                                sx={{ minWidth: 0 }}
                                            >
                                                {category}
                                            </Typography>
                                            <Chip
                                                label={`${categoryVisibleCount}/${catColumns.length}`}
                                                size="small"
                                                sx={{
                                                    height: 20,
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    bgcolor: categoryVisibleCount > 0 ? '#f1f5f9' : '#f8fafc',
                                                    color: categoryVisibleCount > 0 ? '#334155' : '#94a3b8',
                                                    flexShrink: 0,
                                                }}
                                            />
                                        </Stack>

                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => onToggleCategory(categoryFields, !isAllCategoryVisible)}
                                            sx={{
                                                fontSize: '0.725rem',
                                                py: 0.3,
                                                px: 1.25,
                                                minWidth: 'auto',
                                                color: 'text.secondary',
                                                borderColor: '#e2e8f0',
                                                flexShrink: 0,
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {isAllCategoryVisible ? 'Deselect All' : 'Select All'}
                                        </Button>
                                    </Stack>

                                    {/* Column Checkboxes Grid - 2 spacious columns */}
                                    <Box
                                        display="grid"
                                        gridTemplateColumns={{
                                            xs: '1fr',
                                            md: 'repeat(2, minmax(0, 1fr))',
                                        }}
                                        gap={1.5}
                                    >
                                        {catColumns.map((col) => {
                                            const isChecked = columnVisibilityModel[col.field] !== false;
                                            return (
                                                <Box
                                                    key={col.field}
                                                    onClick={() => onToggleColumn(col.field)}
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        p: 1.25,
                                                        px: 1.5,
                                                        borderRadius: 2,
                                                        bgcolor: isChecked ? '#ffffff' : '#f8fafc',
                                                        border: '1px solid',
                                                        borderColor: isChecked ? '#cbd5e1' : '#e2e8f0',
                                                        boxShadow: isChecked ? '0 1px 3px 0 rgb(0 0 0 / 0.05)' : 'none',
                                                        transition: 'all 0.15s ease',
                                                        cursor: 'pointer',
                                                        minWidth: 0,
                                                        overflow: 'hidden',
                                                        '&:hover': {
                                                            bgcolor: isChecked ? '#ffffff' : '#f1f5f9',
                                                            borderColor: '#94a3b8',
                                                        },
                                                    }}
                                                >
                                                    <Checkbox
                                                        size="small"
                                                        checked={isChecked}
                                                        onChange={() => onToggleColumn(col.field)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        sx={{ p: 0.5, mr: 1.25, flexShrink: 0, color: '#94a3b8' }}
                                                    />

                                                    {/* Unique Icon Badge */}
                                                    <Box
                                                        sx={{
                                                            width: 32,
                                                            height: 32,
                                                            borderRadius: 1.5,
                                                            bgcolor: isChecked ? '#f1f5f9' : '#f8fafc',
                                                            color: isChecked ? '#334155' : '#94a3b8',
                                                            border: '1px solid',
                                                            borderColor: isChecked ? '#e2e8f0' : '#f1f5f9',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0,
                                                            mr: 1.5,
                                                        }}
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={getFieldIcon(col.field, col.isObject)}
                                                            style={{ fontSize: '0.825rem' }}
                                                        />
                                                    </Box>

                                                    {/* Title & Subtitle */}
                                                    <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                                        <Stack
                                                            direction="row"
                                                            alignItems="center"
                                                            spacing={0.75}
                                                            sx={{ minWidth: 0, width: '100%', overflow: 'hidden' }}
                                                        >
                                                            <Typography
                                                                variant="body2"
                                                                fontSize="0.9rem"
                                                                fontWeight={isChecked ? 650 : 500}
                                                                color={isChecked ? '#0f172a' : '#475569'}
                                                                noWrap
                                                                sx={{
                                                                    minWidth: 0,
                                                                    flex: 1,
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    lineHeight: 1.3,
                                                                }}
                                                            >
                                                                {col.headerName}
                                                            </Typography>
                                                            {col.isObject && (
                                                                <Chip
                                                                    label="JSON"
                                                                    size="small"
                                                                    sx={{
                                                                        height: 18,
                                                                        fontSize: '0.625rem',
                                                                        bgcolor: '#e2e8f0',
                                                                        color: '#475569',
                                                                        fontWeight: 600,
                                                                        flexShrink: 0,
                                                                    }}
                                                                />
                                                            )}
                                                        </Stack>
                                                        <Typography
                                                            variant="caption"
                                                            fontSize="0.725rem"
                                                            color="#64748b"
                                                            noWrap
                                                            sx={{
                                                                fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                                                                display: 'block',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                                minWidth: 0,
                                                                width: '100%',
                                                                mt: '1px',
                                                            }}
                                                        >
                                                            {col.field}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Stack>
                )}
            </DialogContent>

            <Divider />

            {/* Footer */}
            <DialogActions sx={{ px: 3.5, py: 2, bgcolor: '#f8fafc' }}>
                <Button variant="contained" onClick={onClose} sx={{ minWidth: 100, px: 3, fontWeight: 600 }}>
                    Done
                </Button>
            </DialogActions>
        </Dialog>
    );
}
