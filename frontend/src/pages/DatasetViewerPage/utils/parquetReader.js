import { parquetRead } from 'hyparquet';

export async function readParquetFile(fileOrBuffer) {
    let arrayBuffer;
    if (fileOrBuffer instanceof ArrayBuffer) {
        arrayBuffer = fileOrBuffer;
    } else if (fileOrBuffer && typeof fileOrBuffer.arrayBuffer === 'function') {
        arrayBuffer = await fileOrBuffer.arrayBuffer();
    } else {
        throw new Error('invalid parquet file buffer');
    }

    const rows = [];
    await parquetRead({
        file: arrayBuffer,
        rowFormat: 'object',
        onComplete: (data) => {
            data.forEach((row, index) => {
                const cleanRow = { id: index };
                for (const [k, v] of Object.entries(row)) {
                    cleanRow[k] = typeof v === 'bigint' ? Number(v) : v;
                }
                rows.push(cleanRow);
            });
        },
    });

    const columns =
        rows.length > 0 ? Object.keys(rows[0]).filter((k) => k !== 'id') : [];
    return { rows, columns };
}
