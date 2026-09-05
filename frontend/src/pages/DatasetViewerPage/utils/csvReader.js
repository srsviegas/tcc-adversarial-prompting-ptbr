import Papa from 'papaparse';

export function readCsvFile(fileOrText) {
    return new Promise((resolve, reject) => {
        Papa.parse(fileOrText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: (results) => {
                const rows = results.data.map((row, index) => ({
                    id: index,
                    ...row,
                }));
                const columns = (results.meta.fields || []).filter(
                    (k) => k !== 'id',
                );
                resolve({ rows, columns });
            },
            error: (err) => reject(err),
        });
    });
}
