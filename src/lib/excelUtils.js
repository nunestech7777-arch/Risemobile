// RISEMOBILE: Excel / CSV Exporter
import * as XLSX from 'xlsx';

/**
 * Exporta array de objetos para arquivo Excel (.xlsx) ou CSV (.csv)
 */
export const exportDataToFile = (data, filename = 'risemobile-export', format = 'xlsx') => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');

  if (format === 'csv') {
    XLSX.writeFile(workbook, `${filename}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(workbook, `${filename}.xlsx`, { bookType: 'xlsx' });
  }
};
