import { useState, useCallback } from 'react';

export function useDatasetDirectory() {
    const [directoryHandle, setDirectoryHandle] = useState(null);
    const [availableFiles, setAvailableFiles] = useState([]);
    const [error, setError] = useState(null);

    const selectDirectory = useCallback(async () => {
        try {
            setError(null);
            const dirHandle = await window.showDirectoryPicker({
                mode: 'read',
            });
            setDirectoryHandle(dirHandle);

            const files = [];
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file') {
                    const lower = entry.name.toLowerCase();
                    if (lower.endsWith('.parquet') || lower.endsWith('.csv')) {
                        files.push(entry.name);
                    }
                }
            }
            setAvailableFiles(files.sort());
        } catch (err) {
            if (err.name !== 'AbortError') {
                setError(err.message);
            }
        }
    }, []);

    const getFileHandle = useCallback(
        async (fileName) => {
            if (!directoryHandle) return null;
            try {
                setError(null);
                const fileHandle = await directoryHandle.getFileHandle(
                    fileName,
                    { create: false },
                );
                return await fileHandle.getFile();
            } catch (err) {
                setError(`failed to read ${fileName}: ${err.message}`);
                return null;
            }
        },
        [directoryHandle],
    );

    return {
        directoryHandle,
        availableFiles,
        error,
        selectDirectory,
        getFileHandle,
    };
}
