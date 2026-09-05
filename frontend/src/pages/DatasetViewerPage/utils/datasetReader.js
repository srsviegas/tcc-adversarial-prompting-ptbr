import { readParquetFile } from './parquetReader';
import { readCsvFile } from './csvReader';

export async function parseDatasetFile(file) {
    const fileName = file.name || '';
    const lowerName = fileName.toLowerCase();

    if (lowerName.endsWith('.parquet')) {
        const { rows, columns } = await readParquetFile(file);
        return { rows, columns, fileName, format: 'parquet' };
    }

    if (lowerName.endsWith('.csv')) {
        const { rows, columns } = await readCsvFile(file);
        return { rows, columns, fileName, format: 'csv' };
    }

    // fallback attempt parquet then csv
    try {
        const { rows, columns } = await readParquetFile(file);
        return { rows, columns, fileName, format: 'parquet' };
    } catch {
        const { rows, columns } = await readCsvFile(file);
        return { rows, columns, fileName, format: 'csv' };
    }
}
