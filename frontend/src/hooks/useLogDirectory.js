import { useState, useCallback } from 'react';

export function useLogDirectory() {
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
        if (entry.kind === 'file' && entry.name.endsWith('.jsonl')) {
          files.push(entry.name);
        }
      }
      setAvailableFiles(files.sort());
    } catch (err) {
      // Ignore AbortError which happens when user cancels the picker
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    }
  }, []);

  const refreshDirectory = useCallback(async () => {
    if (!directoryHandle) return;
    try {
      setError(null);
      const files = [];
      for await (const entry of directoryHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.jsonl')) {
          files.push(entry.name);
        }
      }
      setAvailableFiles(files.sort());
    } catch (err) {
      setError(`Failed to refresh directory: ${err.message}`);
    }
  }, [directoryHandle]);

  const getFileContent = useCallback(async (fileName) => {
    if (!directoryHandle) return null;
    try {
      setError(null);
      // Guarantee read-only access by explicitly disabling file creation ({ create: false })
      const fileHandle = await directoryHandle.getFileHandle(fileName, { create: false });
      const file = await fileHandle.getFile();
      const text = await file.text();
      return text;
    } catch (err) {
      setError(`Failed to read ${fileName}: ${err.message}`);
      return null;
    }
  }, [directoryHandle]);

  return {
    directoryHandle,
    availableFiles,
    error,
    selectDirectory,
    refreshDirectory,
    getFileContent,
  };
}
