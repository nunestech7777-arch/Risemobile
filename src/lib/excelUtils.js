// RISEMOBILE: Excel & CSV Import/Export Utilities
import * as XLSX from 'xlsx';

// Valor de planilha: aceita número ou texto ("5.000,00", "R$ 5000", "430.5")
const parseSheetAmount = (raw) => {
  if (raw === '' || raw === null || raw === undefined) return NaN;
  if (typeof raw === 'number') return raw;
  let text = String(raw).replace(/[^0-9.,-]/g, '');
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  return parseFloat(text);
};

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

/**
 * Baixar Modelo Oficial de Planilha de Estoque RiseMobile (.xlsx)
 */
export const downloadStockTemplate = () => {
  // Só Modelo, Armazenamento e Grade são obrigatórios. As demais colunas são opcionais:
  // linhas sem IMEI / Serial são aceitas (o IMEI só precisa ser único quando informado).
  const templateData = [
    {
      'Modelo': 'iPhone 13',
      'Armazenamento': '128GB',
      'Grade': 'A++',
      'Cor (opcional)': 'Meia-noite',
      'Saúde da Bateria % (opcional)': 95,
      'IMEI / Serial (opcional)': '354890123456789',
      'Custo Unitário R$ (opcional)': 1900.00,
      'Preço Sugerido R$ (opcional)': 2350.00
    },
    {
      'Modelo': 'iPhone 13',
      'Armazenamento': '128GB',
      'Grade': 'A++',
      'Cor (opcional)': '',
      'Saúde da Bateria % (opcional)': '',
      'IMEI / Serial (opcional)': '',
      'Custo Unitário R$ (opcional)': 1900.00,
      'Preço Sugerido R$ (opcional)': 2350.00
    },
    {
      'Modelo': 'iPhone 14 Pro',
      'Armazenamento': '256GB',
      'Grade': 'A++',
      'Cor (opcional)': '',
      'Saúde da Bateria % (opcional)': '',
      'IMEI / Serial (opcional)': '',
      'Custo Unitário R$ (opcional)': '',
      'Preço Sugerido R$ (opcional)': ''
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);

  // Definir larguras de colunas ideais
  worksheet['!cols'] = [
    { wch: 18 }, // Modelo
    { wch: 16 }, // Armazenamento
    { wch: 10 }, // Grade
    { wch: 16 }, // Cor
    { wch: 22 }, // Saúde da Bateria (%)
    { wch: 22 }, // IMEI / Serial
    { wch: 22 }, // Custo Unitário (R$)
    { wch: 22 }  // Preço Sugerido (R$)
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Modelo_Estoque');
  XLSX.writeFile(workbook, 'Modelo_Importacao_Estoque_RiseMobile.xlsx');
};

/**
 * Lê e analisa arquivo Excel ou CSV para importação de estoque
 * Retorna array de objetos normalizados
 */
export const parseStockExcelFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const normalizedRows = rawJson.map((row, index) => {
          // Mapeamento flexível de chaves (case-insensitive e variações comuns)
          const findKey = (keys) => Object.keys(row).find(key => {
            const cleanKey = key.trim().toLowerCase();
            return keys.some(k => cleanKey.includes(k.toLowerCase()));
          });
          const findVal = (keys) => {
            const key = findKey(keys);
            return key === undefined ? '' : row[key];
          };
          // Valores em R$, gravados como estão (inclusive planilhas antigas com "USD" no cabeçalho)
          const readAmount = (keys) => {
            const key = findKey(keys);
            return key === undefined ? NaN : parseSheetAmount(row[key]);
          };

          const model = String(findVal(['modelo', 'model']) || '').trim();
          const storage = String(findVal(['armazenamento', 'storage', 'capacidade']) || '128GB').trim();
          const grade = String(findVal(['grade', 'classificacao']) || 'A++').trim();
          const color = String(findVal(['cor', 'color']) || '').trim();
          const rawBattery = findVal(['bateria', 'battery', 'saude', 'saúde']);
          const battery = String(rawBattery).trim() !== '' ? parseInt(rawBattery, 10) : NaN;
          const imei = String(findVal(['imei', 'serial', 'numero de serie', 'número de série']) || '').trim().replace(/[^a-zA-Z0-9]/g, '');
          const costKeys = ['custo', 'cost', 'unitario', 'unitário'];
          const priceKeys = ['preco', 'preço', 'sugerido', 'venda', 'price'];
          const cost = findVal(costKeys) !== '' ? readAmount(costKeys) : 0;
          const price = findVal(priceKeys) !== '' ? readAmount(priceKeys) : (cost ? cost * 1.25 : 0);

          return {
            rowNumber: index + 2, // 1-indexed considerando cabeçalho na linha 1
            model,
            storage,
            grade,
            color,
            battery_health: isNaN(battery) ? null : Math.min(100, Math.max(0, battery)),
            imei,
            cost_price_usd: isNaN(cost) ? 0 : cost,
            suggested_price_usd: isNaN(price) ? 0 : price,
            raw: row
          };
        });

        resolve(normalizedRows);
      } catch (err) {
        reject(new Error(`Falha ao processar arquivo: ${err.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler o arquivo selecionado.'));
    };

    reader.readAsArrayBuffer(file);
  });
};
