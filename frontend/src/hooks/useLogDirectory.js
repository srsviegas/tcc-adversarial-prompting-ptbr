import { useState, useCallback } from 'react';

export function useLogDirectory() {
  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [availableFiles, setAvailableFiles] = useState([]);
  const [evaluatedFiles, setEvaluatedFiles] = useState([]);
  const [error, setError] = useState(null);

  const scanDirectoryHandles = async (dirHandle) => {
    const files = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.jsonl')) {
        files.push(entry.name);
      }
    }

    const evalFiles = [];
    try {
      const evalDirHandle = await dirHandle.getDirectoryHandle('evaluated', { create: false });
      for await (const entry of evalDirHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.jsonl')) {
          evalFiles.push(entry.name);
        }
      }
    } catch {
      // Subdirectory 'evaluated' does not exist
    }

    return {
      files: files.sort(),
      evaluatedFiles: evalFiles.sort(),
    };
  };

  const selectDirectory = useCallback(async () => {
    try {
      setError(null);
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read',
      });
      setDirectoryHandle(dirHandle);

      const { files, evaluatedFiles: evFiles } = await scanDirectoryHandles(dirHandle);
      setAvailableFiles(files);
      setEvaluatedFiles(evFiles);
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
      const { files, evaluatedFiles: evFiles } = await scanDirectoryHandles(directoryHandle);
      setAvailableFiles(files);
      setEvaluatedFiles(evFiles);
    } catch (err) {
      setError(`Failed to refresh directory: ${err.message}`);
    }
  }, [directoryHandle]);

  const getFileContent = useCallback(async (fileName) => {
    if (!directoryHandle || !fileName) return null;
    try {
      setError(null);
      let fileHandle;
      if (fileName.startsWith('evaluated/') || fileName.startsWith('evaluated\\')) {
        const cleanName = fileName.replace(/^evaluated[\\/]/, '');
        const evalDirHandle = await directoryHandle.getDirectoryHandle('evaluated', { create: false });
        fileHandle = await evalDirHandle.getFileHandle(cleanName, { create: false });
      } else {
        fileHandle = await directoryHandle.getFileHandle(fileName, { create: false });
      }
      const file = await fileHandle.getFile();
      const text = await file.text();
      return text;
    } catch (err) {
      setError(`Failed to read ${fileName}: ${err.message}`);
      return null;
    }
  }, [directoryHandle]);

  const getEvaluatedFileContent = useCallback(async (fileName) => {
    if (!directoryHandle) return null;
    try {
      setError(null);
      const evalDirHandle = await directoryHandle.getDirectoryHandle('evaluated', { create: false });
      const fileHandle = await evalDirHandle.getFileHandle(fileName, { create: false });
      const file = await fileHandle.getFile();
      const text = await file.text();
      return text;
    } catch (err) {
      setError(`Failed to read evaluated file ${fileName}: ${err.message}`);
      return null;
    }
  }, [directoryHandle]);

  return {
    directoryHandle,
    availableFiles,
    evaluatedFiles,
    error,
    selectDirectory,
    refreshDirectory,
    getFileContent,
    getEvaluatedFileContent,
  };
}
