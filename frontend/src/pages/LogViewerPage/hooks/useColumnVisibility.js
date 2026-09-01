import { useState, useEffect, useCallback } from 'react';
import { getDefaultColumnVisibility } from '../utils/columnUtils';

const STORAGE_KEY = 'tcc_log_column_visibility';

export function useColumnVisibility(columns) {
    const [columnVisibilityModel, setModel] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Failed to load column visibility from localStorage:', e);
        }
        return {};
    });

    // Ensure model contains entries for all current columns
    useEffect(() => {
        if (!columns || columns.length === 0) return;

        setModel((prev) => {
            let saved = null;
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) saved = JSON.parse(raw);
            } catch (e) {
                // Ignore parse error
            }

            const defaultModel = getDefaultColumnVisibility(columns);

            // Merge saved preferences with default model for any newly discovered columns
            const updated = { ...defaultModel, ...(saved || {}), ...prev };

            // Always keep expand and copy columns visible
            updated.__expand__ = true;
            updated.__copy__ = true;

            return updated;
        });
    }, [columns]);

    const setColumnVisibilityModel = useCallback((newModelOrFn) => {
        setModel((prev) => {
            const next = typeof newModelOrFn === 'function' ? newModelOrFn(prev) : newModelOrFn;
            // Always keep fixed columns visible
            next.__expand__ = true;
            next.__copy__ = true;

            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch (e) {
                console.error('Failed to save column visibility to localStorage:', e);
            }
            return next;
        });
    }, []);

    const toggleColumn = useCallback((field) => {
        setColumnVisibilityModel((prev) => ({
            ...prev,
            [field]: !prev[field],
        }));
    }, [setColumnVisibilityModel]);

    const selectAll = useCallback((targetColumns) => {
        const next = {};
        targetColumns.forEach((col) => {
            next[col.field] = true;
        });
        next.__expand__ = true;
        next.__copy__ = true;
        setColumnVisibilityModel(next);
    }, [setColumnVisibilityModel]);

    const deselectAll = useCallback((targetColumns) => {
        const next = {};
        targetColumns.forEach((col) => {
            next[col.field] = col.field === 'id'; // Keep ID visible by default on deselect
        });
        next.__expand__ = true;
        next.__copy__ = true;
        setColumnVisibilityModel(next);
    }, [setColumnVisibilityModel]);

    const resetToDefaults = useCallback((targetColumns) => {
        const defaults = getDefaultColumnVisibility(targetColumns);
        setColumnVisibilityModel(defaults);
    }, [setColumnVisibilityModel]);

    const toggleCategory = useCallback((categoryFields, makeVisible) => {
        setColumnVisibilityModel((prev) => {
            const next = { ...prev };
            categoryFields.forEach((field) => {
                next[field] = makeVisible;
            });
            return next;
        });
    }, [setColumnVisibilityModel]);

    return {
        columnVisibilityModel,
        setColumnVisibilityModel,
        toggleColumn,
        selectAll,
        deselectAll,
        resetToDefaults,
        toggleCategory,
    };
}
