import React, { useState, useMemo, useEffect } from 'react';
import {
  PackagePlus,
  Layers,
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Trash2,
  ClipboardPaste,
  ArrowRight,
  Check,
  X,
  Plus
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input, Select, CurrencyInput } from '../ui/Input';
import { Table, TableRow, TableCell } from '../ui/Table';
import { Modal } from '../ui/Modal';
import { formatUSD } from '../../lib/formatters';
import { downloadStockTemplate, parseStockExcelFile } from '../../lib/excelUtils';

const IPHONE_MODELS = [
  'iPhone 13', 'iPhone 13 mini', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
  'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
  'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
  'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max'
];

const STORAGE_OPTIONS = ['64GB', '128GB', '256GB', '512GB', '1TB'];

const COLOR_OPTIONS = [
  'Preto', 'Branco', 'Meia-noite', 'Estelar', 'Azul', 'Rosa',
  'Verde', 'Roxo Profundo', 'Dourado', 'Prateado', 'Grafite',
  'Titânio Natural', 'Titânio Preto', 'Titânio Branco', 'Titânio Deserto'
];

const generateBatchCode = () => `LOTE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

const createEmptyUnit = (costDefault, priceDefault) => ({
  id: `unit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
  imei: '',
  color: 'Meia-noite',
  battery_health: 95,
  cost_price_usd: costDefault,
  suggested_price_usd: priceDefault
});

const createDefaultItem = (defaultGradeId) => {
  const cost = '350.00';
  const price = '430.00';
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    model: 'iPhone 13',
    storage: '128GB',
    grade_id: defaultGradeId || '',
    unit_cost_usd: cost,
    suggested_price_usd: price,
    units: [createEmptyUnit(cost, price)]
  };
};

export const StockEntryModule = ({
  grades = [],
  devices = [],
  onConfirmEntry,
  onConfirmImport,
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'import'

  // =========================================================================
  // ABA 1: ENTRADA MANUAL EM LOTE (1 lote -> N itens/modelos -> N unidades)
  // =========================================================================
  const [batchHeader, setBatchHeader] = useState({
    reference_code: generateBatchCode(),
    notes: ''
  });
  const [items, setItems] = useState(() => [createDefaultItem('')]);

  // Preenche a grade padrão dos itens assim que as grades carregarem
  useEffect(() => {
    if (grades.length > 0) {
      setItems(prev => prev.map(it => (it.grade_id ? it : { ...it, grade_id: grades[0].id })));
    }
  }, [grades]);

  // Modal para Colar Múltiplos IMEIs (sempre relativo a UM item específico)
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteTargetItemId, setPasteTargetItemId] = useState(null);
  const [pastedImeisText, setPastedImeisText] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successBanner, setSuccessBanner] = useState(null);

  const getGradeName = (gradeId) => grades.find(g => g.id === gradeId)?.name || '—';

  // Atualiza um campo simples do item (modelo, armazenamento, grade)
  const handleUpdateItemField = (itemId, field, value) => {
    setItems(prev => prev.map(it => (it.id === itemId ? { ...it, [field]: value } : it)));
  };

  // Custo padrão do item muda -> propaga para as unidades daquele item
  const handleItemCostChange = (itemId, newCost) => {
    setItems(prev => prev.map(it => (
      it.id === itemId
        ? { ...it, unit_cost_usd: newCost, units: it.units.map(u => ({ ...u, cost_price_usd: newCost })) }
        : it
    )));
  };

  // Preço sugerido do item muda -> propaga para as unidades daquele item
  const handleItemPriceChange = (itemId, newPrice) => {
    setItems(prev => prev.map(it => (
      it.id === itemId
        ? { ...it, suggested_price_usd: newPrice, units: it.units.map(u => ({ ...u, suggested_price_usd: newPrice })) }
        : it
    )));
  };

  // Sincroniza a quantidade de unidades de UM item (nunca cria novo lote)
  const handleItemQuantityChange = (itemId, newQtyStr) => {
    const newQty = parseInt(newQtyStr, 10);
    const targetItem = items.find(it => it.id === itemId);
    if (!targetItem || isNaN(newQty) || newQty < 1) return;

    const currentLen = targetItem.units.length;
    if (newQty === currentLen) return;

    if (newQty > currentLen) {
      const additional = Array.from(
        { length: newQty - currentLen },
        () => createEmptyUnit(targetItem.unit_cost_usd, targetItem.suggested_price_usd)
      );
      setItems(prev => prev.map(it => (it.id === itemId ? { ...it, units: [...it.units, ...additional] } : it)));
      return;
    }

    // Reduzindo: nunca apagar silenciosamente linhas já preenchidas
    const toRemove = targetItem.units.slice(newQty);
    const hasFilledData = toRemove.some(u => (u.imei || '').trim() !== '');
    if (hasFilledData) {
      const confirmed = window.confirm(
        `Reduzir para ${newQty} unidade(s) vai remover ${toRemove.length} linha(s) já preenchida(s) neste item. Deseja continuar?`
      );
      if (!confirmed) return;
    }
    setItems(prev => prev.map(it => (it.id === itemId ? { ...it, units: it.units.slice(0, newQty) } : it)));
  };

  // Atualização individual de uma unidade dentro de um item
  const handleUpdateUnit = (itemId, unitIndex, field, value) => {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it;
      const updatedUnits = [...it.units];
      updatedUnits[unitIndex] = { ...updatedUnits[unitIndex], [field]: value };
      return { ...it, units: updatedUnits };
    }));
    setSubmitError('');
  };

  // Adiciona outro modelo/configuração ao MESMO lote (não cria novo lote, não salva, não navega)
  const handleAddItem = () => {
    setItems(prev => [...prev, createDefaultItem(grades[0]?.id || '')]);
  };

  // Remove um item/configuração do lote (com confirmação se já houver IMEIs preenchidos)
  const handleRemoveItem = (itemId) => {
    if (items.length <= 1) {
      setSubmitError('O lote precisa ter ao menos um item/configuração.');
      return;
    }
    const target = items.find(it => it.id === itemId);
    const hasFilledData = target?.units.some(u => (u.imei || '').trim() !== '');
    if (hasFilledData) {
      const confirmed = window.confirm(
        `O item ${target.model} ${target.storage} já possui IMEIs preenchidos. Remover mesmo assim?`
      );
      if (!confirmed) return;
    }
    setItems(prev => prev.filter(it => it.id !== itemId));
    setSubmitError('');
  };

  // Aplicar colagem de IMEIs em massa — sempre restrita ao item de origem
  const handleApplyPastedImeis = () => {
    if (!pastedImeisText.trim() || !pasteTargetItemId) return;

    const rawList = pastedImeisText
      .split(/[\n,;\t\r\s]+/)
      .map(item => item.trim().replace(/[^a-zA-Z0-9]/g, ''))
      .filter(Boolean);

    if (rawList.length === 0) return;

    setItems(prev => prev.map(it => {
      if (it.id !== pasteTargetItemId) return it;
      const neededCount = Math.max(it.units.length, rawList.length);
      const newUnits = [];
      for (let i = 0; i < neededCount; i++) {
        const existing = it.units[i] || createEmptyUnit(it.unit_cost_usd, it.suggested_price_usd);
        newUnits.push({ ...existing, imei: rawList[i] || existing.imei || '' });
      }
      return { ...it, units: newUnits };
    }));

    setIsPasteModalOpen(false);
    setPasteTargetItemId(null);
    setPastedImeisText('');
  };

  // Conjunto de IMEIs já cadastrados no banco para detecção em tempo real
  const existingImeiSet = useMemo(() => {
    return new Set(devices.map(d => (d.imei || '').trim().toLowerCase()));
  }, [devices]);

  // Contagem de ocorrências de cada IMEI dentro do lote inteiro (entre todos os itens)
  const imeiCountInBatch = useMemo(() => {
    const map = new Map();
    items.forEach(it => it.units.forEach(u => {
      const clean = (u.imei || '').trim().toLowerCase();
      if (!clean) return;
      map.set(clean, (map.get(clean) || 0) + 1);
    }));
    return map;
  }, [items]);

  // Validação global do lote inteiro (todos os itens, todas as unidades)
  const batchValidation = useMemo(() => {
    const errors = [];
    let totalUnits = 0;
    let filledCount = 0;
    let hasBlockingError = false;

    items.forEach((item, itemIdx) => {
      item.units.forEach((unit, unitIdx) => {
        totalUnits++;
        const cleanImei = (unit.imei || '').trim().toLowerCase();
        const label = `Item ${itemIdx + 1} (${item.model} ${item.storage}), Unidade #${unitIdx + 1}`;

        if (!cleanImei) {
          errors.push(`${label}: IMEI não preenchido.`);
          hasBlockingError = true;
          return;
        }
        filledCount++;

        if (existingImeiSet.has(cleanImei)) {
          errors.push(`${label} (${unit.imei}): IMEI já existe no sistema.`);
          hasBlockingError = true;
        }
        if ((imeiCountInBatch.get(cleanImei) || 0) > 1) {
          errors.push(`${label} (${unit.imei}): IMEI duplicado dentro do mesmo lote.`);
          hasBlockingError = true;
        }
      });
    });

    return {
      isValid: !hasBlockingError && totalUnits > 0,
      totalUnits,
      filledCount,
      errors
    };
  }, [items, existingImeiSet, imeiCountInBatch]);

  // Totais do lote inteiro (soma de todos os itens)
  const batchTotalCost = useMemo(() => {
    return items.reduce((acc, it) => acc + it.units.reduce((s, u) => s + (parseFloat(u.cost_price_usd) || 0), 0), 0);
  }, [items]);

  const batchTotalSuggestedPrice = useMemo(() => {
    return items.reduce((acc, it) => acc + it.units.reduce((s, u) => s + (parseFloat(u.suggested_price_usd) || 0), 0), 0);
  }, [items]);

  // Submissão do lote inteiro (todos os itens de uma vez, transacional no backend)
  const handleConfirmBatchEntry = async () => {
    if (!batchValidation.isValid) {
      setSubmitError(batchValidation.errors[0] || 'Corrija os erros nas unidades antes de confirmar.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const itemsPayload = items.map(it => ({
        model: it.model,
        storage: it.storage,
        grade_id: it.grade_id || grades[0]?.id,
        unit_cost_usd: it.unit_cost_usd,
        suggested_price_usd: it.suggested_price_usd,
        units: it.units
      }));

      await onConfirmEntry(batchHeader, itemsPayload);

      setSuccessBanner({
        type: 'manual',
        batchCode: batchHeader.reference_code,
        totalItems: items.length,
        quantity: batchValidation.totalUnits,
        totalCost: batchTotalCost
      });

      setBatchHeader({ reference_code: generateBatchCode(), notes: '' });
      setItems([createDefaultItem(grades[0]?.id || '')]);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSubmitError(`Erro na entrada de lote: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // ABA 2: IMPORTAÇÃO EXCEL / CSV
  // =========================================================================
  const [importFile, setImportFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [importBatchCode, setImportBatchCode] = useState(() => `IMP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [isImportSubmitting, setIsImportSubmitting] = useState(false);
  const [importError, setImportError] = useState('');

  // Análise detalhada das linhas importadas
  const importValidation = useMemo(() => {
    if (parsedRows.length === 0) return { total: 0, validRows: [], errorRows: [], duplicatesInFile: 0, alreadyInDb: 0, missingFields: 0 };

    const seenImeisInImport = new Map();
    const validRows = [];
    const errorRows = [];

    parsedRows.forEach((row) => {
      const issues = [];
      const cleanImei = (row.imei || '').trim().toLowerCase();

      if (!row.model) issues.push('Modelo ausente');
      if (!cleanImei) {
        issues.push('IMEI / Serial ausente');
      } else {
        if (existingImeiSet.has(cleanImei)) {
          issues.push('IMEI já cadastrado no sistema');
        }
        if (seenImeisInImport.has(cleanImei)) {
          issues.push(`IMEI duplicado no arquivo (repetido com linha ${seenImeisInImport.get(cleanImei)})`);
        } else {
          seenImeisInImport.set(cleanImei, row.rowNumber);
        }
      }

      // Localiza grade_id correspondente
      const matchingGrade = grades.find(g => g.name.toLowerCase() === (row.grade || '').toLowerCase()) || grades[0];

      const processedRow = {
        ...row,
        grade_id: matchingGrade?.id || (grades[0]?.id || '11111111-1111-1111-1111-111111111111'),
        issues,
        isValid: issues.length === 0
      };

      if (processedRow.isValid) {
        validRows.push(processedRow);
      } else {
        errorRows.push(processedRow);
      }
    });

    const duplicatesInFile = errorRows.filter(r => r.issues.some(i => i.includes('duplicado no arquivo'))).length;
    const alreadyInDb = errorRows.filter(r => r.issues.some(i => i.includes('já cadastrado'))).length;
    const missingFields = errorRows.filter(r => r.issues.some(i => i.includes('ausente'))).length;

    return {
      total: parsedRows.length,
      validRows,
      errorRows,
      duplicatesInFile,
      alreadyInDb,
      missingFields
    };
  }, [parsedRows, existingImeiSet, grades]);

  // Manipulação de Upload do Arquivo
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setIsParsing(true);
    setImportError('');

    try {
      const rows = await parseStockExcelFile(file);
      setParsedRows(rows);
    } catch (err) {
      setImportError(`Erro ao ler arquivo: ${err.message}`);
      setParsedRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  // Confirmar Importação das Linhas Válidas
  const handleConfirmImportExecution = async () => {
    if (importValidation.validRows.length === 0) {
      setImportError('Nenhuma linha válida disponível para importação.');
      return;
    }

    setIsImportSubmitting(true);
    setImportError('');

    try {
      await onConfirmImport(importValidation.validRows, importBatchCode);

      setSuccessBanner({
        type: 'import',
        batchCode: importBatchCode,
        quantity: importValidation.validRows.length,
        totalCost: importValidation.validRows.reduce((sum, r) => sum + (r.cost_price_usd || 0), 0)
      });

      // Limpa dados de importação
      setImportFile(null);
      setParsedRows([]);
      setImportBatchCode(`IMP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setImportError(`Erro ao importar aparelhos: ${err.message}`);
    } finally {
      setIsImportSubmitting(false);
    }
  };

  const pasteTargetItem = items.find(it => it.id === pasteTargetItemId);

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Top Header & Tabs Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-slate-900 dark:text-cyan-400" />
            Entrada & Importação de Estoque
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cadastre novos aparelhos manualmente em lote (com vários modelos no mesmo lote) ou importe planilhas Excel/CSV com validação atômica
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center p-1 bg-white dark:bg-[#0B101B]/80 dark:backdrop-blur-xl border border-slate-200 dark:border-white/12 rounded-full shadow-xs self-start sm:self-auto">
          <button
            onClick={() => {
              setActiveTab('manual');
              setSuccessBanner(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'manual'
                ? 'bg-[#111418] text-white dark:bg-white dark:text-slate-950 shadow-md'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Entrada Manual em Lote
          </button>
          <button
            onClick={() => {
              setActiveTab('import');
              setSuccessBanner(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'import'
                ? 'bg-[#111418] text-white dark:bg-white dark:text-slate-950 shadow-md'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Importação Excel / CSV
          </button>
        </div>
      </div>

      {/* Banner de Sucesso */}
      {successBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold">
                {successBanner.type === 'manual' ? 'Entrada de Estoque Realizada com Sucesso!' : 'Planilha Importada com Sucesso!'}
              </div>
              <div className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                Lote <strong>{successBanner.batchCode}</strong> • {successBanner.totalItems ? `${successBanner.totalItems} configurações • ` : ''}
                {successBanner.quantity} aparelhos cadastrados como <strong>Disponível</strong> ({formatUSD(successBanner.totalCost)} de custo total).
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('stock')}
              icon={ArrowRight}
              className="w-full sm:w-auto border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
            >
              Ver no Estoque
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSuccessBanner(null)}
              icon={X}
            />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 1: ENTRADA MANUAL EM LOTE (MULTI-MODELO)                          */}
      {/* ===================================================================== */}
      {activeTab === 'manual' && (
        <div className="space-y-6">
          {/* DADOS DO LOTE (cabeçalho compartilhado por todos os itens) */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center text-xs font-black">
                  1
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Dados do Lote
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                Um lote pode conter vários modelos, armazenamentos e grades diferentes
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Código / Referência do Lote"
                required
                value={batchHeader.reference_code}
                onChange={(e) => setBatchHeader({ ...batchHeader, reference_code: e.target.value })}
                placeholder="Ex: LOTE-2026-3232"
              />
              <Input
                label="Observações / Fornecedor"
                value={batchHeader.notes}
                onChange={(e) => setBatchHeader({ ...batchHeader, notes: e.target.value })}
                placeholder="Ex: Lote Miami, NF 104..."
              />
            </div>
          </Card>

          {/* ITENS / CONFIGURAÇÕES DO LOTE */}
          {items.map((item, itemIdx) => {
            const itemFilledCount = item.units.filter(u => (u.imei || '').trim() !== '').length;

            return (
              <Card key={item.id} className="p-6 border-l-4 border-l-slate-900 dark:border-l-cyan-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.08] text-xs font-black text-slate-700 dark:text-slate-200">
                      ITEM {itemIdx + 1}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.model} • {item.storage} • Grade {getGradeName(item.grade_id)}
                    </h3>
                  </div>
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item.id)}
                      icon={Trash2}
                      className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      Remover Item
                    </Button>
                  )}
                </div>

                {/* Configuração do Item */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <Select
                    label="Modelo do iPhone"
                    value={item.model}
                    onChange={(e) => handleUpdateItemField(item.id, 'model', e.target.value)}
                    options={IPHONE_MODELS.map(m => ({ value: m, label: m }))}
                  />
                  <Select
                    label="Armazenamento"
                    value={item.storage}
                    onChange={(e) => handleUpdateItemField(item.id, 'storage', e.target.value)}
                    options={STORAGE_OPTIONS.map(s => ({ value: s, label: s }))}
                  />
                  <Select
                    label="Grade Estética"
                    value={item.grade_id}
                    onChange={(e) => handleUpdateItemField(item.id, 'grade_id', e.target.value)}
                    options={grades.map(g => ({ value: g.id, label: `Grade ${g.name}` }))}
                  />
                  <Input
                    label="Quantidade de Aparelhos"
                    type="number"
                    min="1"
                    max="500"
                    required
                    value={item.units.length}
                    onChange={(e) => handleItemQuantityChange(item.id, e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 mb-4 border-b border-slate-200/60 dark:border-slate-700/60">
                  <CurrencyInput
                    label="Custo Unitário Padrão (USD)"
                    value={item.unit_cost_usd}
                    onChange={(val) => handleItemCostChange(item.id, val)}
                    currency="USD"
                  />
                  <CurrencyInput
                    label="Preço Sugerido de Venda (USD)"
                    value={item.suggested_price_usd}
                    onChange={(val) => handleItemPriceChange(item.id, val)}
                    currency="USD"
                  />
                </div>

                {/* Unidades deste Item */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Unidades deste Item ({itemFilledCount}/{item.units.length} IMEIs preenchidos)
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPasteTargetItemId(item.id);
                      setIsPasteModalOpen(true);
                    }}
                    icon={ClipboardPaste}
                  >
                    Colar Múltiplos IMEIs
                  </Button>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <Table headers={['#', 'IMEI / Serial (Único)', 'Cor', 'Bateria (%)', 'Custo (USD)', 'Preço Sugerido (USD)', 'Status']}>
                    {item.units.map((unit, idx) => {
                      const cleanImei = (unit.imei || '').trim().toLowerCase();
                      const isDbDuplicate = cleanImei && existingImeiSet.has(cleanImei);
                      const isBatchDuplicate = cleanImei && (imeiCountInBatch.get(cleanImei) || 0) > 1;
                      const hasError = isDbDuplicate || isBatchDuplicate;

                      return (
                        <TableRow key={unit.id}>
                          <TableCell className="font-bold text-slate-400 w-12 text-center">
                            {idx + 1}
                          </TableCell>

                          <TableCell className="w-56">
                            <div className="space-y-1">
                              <input
                                type="text"
                                placeholder="354890123456789"
                                value={unit.imei}
                                onChange={(e) => handleUpdateUnit(item.id, idx, 'imei', e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                                className={`w-full px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                                  hasError
                                    ? 'bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-500 text-rose-900 dark:text-rose-200 focus:outline-rose-600'
                                    : unit.imei
                                      ? 'bg-slate-100 dark:bg-white/[0.07] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white'
                                      : 'bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white'
                                }`}
                              />
                              {isDbDuplicate && (
                                <div className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> Já existe no sistema
                                </div>
                              )}
                              {!isDbDuplicate && isBatchDuplicate && (
                                <div className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Duplicado no lote
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="w-40">
                            <select
                              value={unit.color}
                              onChange={(e) => handleUpdateUnit(item.id, idx, 'color', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-white/[0.07] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100"
                            >
                              {COLOR_OPTIONS.map(c => (
                                <option key={c} value={c} className="dark:bg-slate-900">{c}</option>
                              ))}
                            </select>
                          </TableCell>

                          <TableCell className="w-28">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={unit.battery_health}
                                onChange={(e) => handleUpdateUnit(item.id, idx, 'battery_health', parseInt(e.target.value, 10) || 0)}
                                className="w-16 px-2 py-1.5 rounded-xl text-xs font-bold text-center bg-slate-100 dark:bg-white/[0.07] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                              />
                              <span className="text-xs text-slate-400 font-semibold">%</span>
                            </div>
                          </TableCell>

                          <TableCell className="w-36">
                            <input
                              type="number"
                              step="0.01"
                              value={unit.cost_price_usd}
                              onChange={(e) => handleUpdateUnit(item.id, idx, 'cost_price_usd', e.target.value)}
                              className="w-28 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/[0.07] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                            />
                          </TableCell>

                          <TableCell className="w-36">
                            <input
                              type="number"
                              step="0.01"
                              value={unit.suggested_price_usd}
                              onChange={(e) => handleUpdateUnit(item.id, idx, 'suggested_price_usd', e.target.value)}
                              className="w-28 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/[0.07] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                            />
                          </TableCell>

                          <TableCell className="w-20 text-center">
                            {unit.imei && !hasError ? (
                              <span className="inline-flex p-1 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                                <Check className="w-3.5 h-3.5" />
                              </span>
                            ) : hasError ? (
                              <span className="inline-flex p-1 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                                <X className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-semibold">Pendente</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </Table>
                </div>

                {/* Mobile Cards View */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {item.units.map((unit, idx) => {
                    const cleanImei = (unit.imei || '').trim().toLowerCase();
                    const isDbDuplicate = cleanImei && existingImeiSet.has(cleanImei);
                    const isBatchDuplicate = cleanImei && (imeiCountInBatch.get(cleanImei) || 0) > 1;

                    return (
                      <div
                        key={unit.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                            Unidade #{idx + 1}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400">
                            {item.model} • {item.storage}
                          </span>
                        </div>

                        <Input
                          label="IMEI / Serial"
                          placeholder="354890123456789"
                          value={unit.imei}
                          onChange={(e) => handleUpdateUnit(item.id, idx, 'imei', e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                          error={isDbDuplicate ? 'Já cadastrado no sistema' : isBatchDuplicate ? 'Duplicado no lote' : ''}
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <Select
                            label="Cor"
                            value={unit.color}
                            onChange={(e) => handleUpdateUnit(item.id, idx, 'color', e.target.value)}
                            options={COLOR_OPTIONS.map(c => ({ value: c, label: c }))}
                          />
                          <Input
                            label="Saúde Bateria (%)"
                            type="number"
                            min="0"
                            max="100"
                            value={unit.battery_health}
                            onChange={(e) => handleUpdateUnit(item.id, idx, 'battery_health', parseInt(e.target.value, 10) || 0)}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <CurrencyInput
                            label="Custo (USD)"
                            value={unit.cost_price_usd}
                            onChange={(val) => handleUpdateUnit(item.id, idx, 'cost_price_usd', val)}
                            currency="USD"
                          />
                          <CurrencyInput
                            label="Preço Sugerido (USD)"
                            value={unit.suggested_price_usd}
                            onChange={(val) => handleUpdateUnit(item.id, idx, 'suggested_price_usd', val)}
                            currency="USD"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          {/* ADICIONAR OUTRO MODELO (mesmo lote — nunca cria lote novo) */}
          <Button
            variant="outline"
            size="lg"
            onClick={handleAddItem}
            icon={Plus}
            className="w-full border-dashed border-2 py-4"
          >
            Adicionar Outro Modelo ao Lote
          </Button>

          {/* RESUMO DO LOTE INTEIRO */}
          <Card className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-semibold text-slate-400">Configurações</span>
                    <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                      {items.length}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-semibold text-slate-400">Total de Aparelhos</span>
                    <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                      {batchValidation.totalUnits} un.
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-semibold text-slate-400">IMEIs Preenchidos</span>
                    <div className={`text-lg font-black mt-0.5 ${
                      batchValidation.filledCount === batchValidation.totalUnits ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'
                    }`}>
                      {batchValidation.filledCount} / {batchValidation.totalUnits}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-semibold text-slate-400">Custo Total do Lote</span>
                    <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                      {formatUSD(batchTotalCost)}
                    </div>
                  </div>
                </div>

                {/* Resumo por Item */}
                <div className="space-y-1 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Resumo por Item</span>
                  {items.map(it => (
                    <div key={it.id} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span>{it.model} {it.storage} • Grade {getGradeName(it.grade_id)}</span>
                      <span className="font-bold">{it.units.length} {it.units.length === 1 ? 'unidade' : 'unidades'}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white pt-1">
                    <span>Preço Sugerido Total</span>
                    <span>{formatUSD(batchTotalSuggestedPrice)}</span>
                  </div>
                </div>
              </div>

              {/* Ação Principal */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                {submitError && (
                  <div className="text-xs font-bold text-rose-500 flex items-center gap-1.5 max-w-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleConfirmBatchEntry}
                  disabled={!batchValidation.isValid || isSubmitting}
                  icon={CheckCircle2}
                  className="w-full sm:w-auto px-8"
                >
                  {isSubmitting ? 'Cadastrando Entrada...' : 'Confirmar Entrada de Estoque'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 2: IMPORTAÇÃO EXCEL / CSV                                         */}
      {/* ===================================================================== */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Card de Upload e Instruções */}
          <Card className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Importação de Estoque por Planilha (.xlsx / .csv)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Faça o download do modelo padrão, preencha os dados e carregue o arquivo para validação prévia.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={downloadStockTemplate}
                icon={Download}
              >
                Baixar Modelo de Planilha (.xlsx)
              </Button>
            </div>

            {/* Dropzone */}
            <div className="border-2 border-dashed border-slate-300 dark:border-white/15 rounded-3xl p-8 text-center bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-all relative">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-white/[0.08] text-indigo-600 dark:text-cyan-400 flex items-center justify-center">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {importFile ? importFile.name : 'Arraste a planilha ou clique para selecionar'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Formatos suportados: .xlsx, .xls, .csv (Até 500 aparelhos por lote)
                  </div>
                </div>
              </div>
            </div>

            {importError && (
              <div className="mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}
          </Card>

          {/* PRÉVIA DA IMPORTAÇÃO */}
          {parsedRows.length > 0 && (
            <Card className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Prévia da Importação ({importValidation.total} linhas encontradas)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Revise os dados antes de cadastrar. Linhas com erro serão bloqueadas ou desconsideradas.
                  </p>
                </div>

                <div className="w-full sm:w-64">
                  <Input
                    label="Código do Lote Importado"
                    value={importBatchCode}
                    onChange={(e) => setImportBatchCode(e.target.value)}
                  />
                </div>
              </div>

              {/* Cards de Métricas da Prévia */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-400">Total Encontrado</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                    {importValidation.total} un.
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                  <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">Linhas Válidas</span>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {importValidation.validRows.length} un.
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                  <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold">IMEIs Duplicados</span>
                  <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
                    {importValidation.duplicatesInFile + importValidation.alreadyInDb}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60">
                  <span className="text-xs text-rose-700 dark:text-rose-300 font-semibold">Campos Ausentes</span>
                  <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
                    {importValidation.missingFields}
                  </div>
                </div>
              </div>

              {/* Tabela de Revisão */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
                <Table headers={['Linha', 'Modelo & Armazenamento', 'Grade', 'Cor', 'Bateria', 'IMEI', 'Custo (USD)', 'Status / Diagnóstico']}>
                  {parsedRows.map((row, idx) => {
                    const validationItem = importValidation.validRows.find(r => r.rowNumber === row.rowNumber) ||
                                           importValidation.errorRows.find(r => r.rowNumber === row.rowNumber);
                    const isValid = validationItem?.isValid;

                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-bold text-slate-400 text-center w-12">
                          #{row.rowNumber}
                        </TableCell>
                        <TableCell className="font-bold text-slate-900 dark:text-white">
                          {row.model || <span className="text-rose-500 italic">Ausente</span>} <span className="text-xs text-slate-400 font-normal">({row.storage})</span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                            {row.grade || 'A++'}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                          {row.color}
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          {row.battery_health}%
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {row.imei || <span className="text-rose-500 italic">Ausente</span>}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900 dark:text-white">
                          {formatUSD(row.cost_price_usd)}
                        </TableCell>
                        <TableCell>
                          {isValid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              <Check className="w-3 h-3" /> Válido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                              <AlertCircle className="w-3 h-3" /> {validationItem?.issues.join(', ')}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </Table>
              </div>

              {/* Ação de Confirmação da Importação */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-400">
                  {importValidation.validRows.length} aparelhos prontos para entrar como <strong>Disponível</strong>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => {
                      setImportFile(null);
                      setParsedRows([]);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleConfirmImportExecution}
                    disabled={importValidation.validRows.length === 0 || isImportSubmitting}
                    icon={CheckCircle2}
                  >
                    {isImportSubmitting ? 'Importando...' : `Confirmar Importação (${importValidation.validRows.length} válidos)`}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* MODAL PARA COLAR MÚLTIPLOS IMEIS (restrito ao item de origem) */}
      <Modal
        isOpen={isPasteModalOpen}
        onClose={() => {
          setIsPasteModalOpen(false);
          setPasteTargetItemId(null);
        }}
        title="Colar Lista de IMEIs"
        subtitle={pasteTargetItem ? `Aplicando ao item: ${pasteTargetItem.model} ${pasteTargetItem.storage} — cole múltiplos IMEIs separados por quebra de linha, vírgula ou espaço.` : ''}
      >
        <div className="space-y-4">
          <textarea
            rows={8}
            value={pastedImeisText}
            onChange={(e) => setPastedImeisText(e.target.value)}
            placeholder="354890123456789&#10;354890123456790&#10;354890123456791"
            className="w-full p-3 font-mono text-xs rounded-2xl bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white/20"
          />

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              {pastedImeisText.split(/[\n,;\t\r\s]+/).filter(Boolean).length} IMEIs detectados
            </span>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsPasteModalOpen(false);
                  setPasteTargetItemId(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApplyPastedImeis}
                disabled={!pastedImeisText.trim()}
              >
                Aplicar ao Item
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
