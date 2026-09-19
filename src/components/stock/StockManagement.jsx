import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Download, 
  Plus,
  PackagePlus,
  History, 
  Edit2,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, Select, CurrencyInput } from '../ui/Input';
import { Table, TableRow, TableCell } from '../ui/Table';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { DeviceHistoryDrawer } from './DeviceHistoryDrawer';
import { formatUSD, formatImei, formatColor, formatDate, getStatusBadge, getBatteryHealthBadge, getDeviceCompleteness } from '../../lib/formatters';
import { DELETE_REASON_OPTIONS, DEVICE_DELETE_BLOCKED_MESSAGE, buildDeletionReason, getDeviceDeleteBlock, getDevicesWithCommercialHistory } from '../../lib/deviceRules';
import { exportDataToFile } from '../../lib/excelUtils';
import { COLOR_OPTIONS } from '../../lib/deviceOptions';

export const StockManagement = ({
  devices = [],
  grades = [],
  movements = [],
  onNavigate,
  onSaveGrade,
  onUpdateDevice,
  onDeleteDevice,
  deletedDevices = [],
  onOpenAdjustment
}) => {
  const [activeTab, setActiveTab] = useState('grouped'); // grouped, devices, grades
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState('ALL');
  const [selectedGrade, setSelectedGrade] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedCompleteness, setSelectedCompleteness] = useState('ALL'); // ALL, INCOMPLETE, NO_IMEI

  // Edição dos dados opcionais de um aparelho (IMEI/Serial, cor, bateria, custo, preço)
  const [editingDevice, setEditingDevice] = useState(null);
  const [editError, setEditError] = useState('');
  const [isSavingDevice, setIsSavingDevice] = useState(false);

  const commercialDeviceIds = useMemo(() => getDevicesWithCommercialHistory(movements), [movements]);

  // Apagar aparelho cadastrado por engano (soft delete, com motivo e auditoria no backend)
  const [deletingDevice, setDeletingDevice] = useState(null);
  const [deleteBlock, setDeleteBlock] = useState(null);
  const [deleteChoice, setDeleteChoice] = useState('');
  const [deleteNote, setDeleteNote] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Drawer de histórico
  const [selectedDeviceForHistory, setSelectedDeviceForHistory] = useState(null);

  // Modal de Criar/Editar Grade
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState({ name: '', description: '', badge_color: 'lavender' });

  // Lista única de modelos existentes
  const uniqueModels = useMemo(() => {
    const set = new Set(devices.map(d => d.model));
    return ['ALL', ...Array.from(set).sort()];
  }, [devices]);

  // Filtros aplicados
  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        (d.imei || '').toLowerCase().includes(q) || 
        (d.model || '').toLowerCase().includes(q) || 
        (d.color || '').toLowerCase().includes(q) ||
        (d.storage || '').toLowerCase().includes(q);

      const matchModel = selectedModel === 'ALL' || d.model === selectedModel;
      const matchGrade = selectedGrade === 'ALL' || d.grade_id === selectedGrade;
      const matchStatus = selectedStatus === 'ALL' || d.status === selectedStatus;
      const matchCompleteness =
        selectedCompleteness === 'ALL' ||
        (selectedCompleteness === 'INCOMPLETE' && !getDeviceCompleteness(d).complete) ||
        (selectedCompleteness === 'NO_IMEI' && !(d.imei || '').trim());

      return matchSearch && matchModel && matchGrade && matchStatus && matchCompleteness;
    });
  }, [devices, searchQuery, selectedModel, selectedGrade, selectedStatus, selectedCompleteness]);

  // Agrupamento por Modelo + Armazenamento + Grade
  const groupedStock = useMemo(() => {
    const map = new Map();

    devices.forEach(d => {
      const gradeObj = grades.find(g => g.id === d.grade_id);
      const gradeName = gradeObj ? gradeObj.name : 'A++';
      const key = `${d.model}__${d.storage}__${gradeName}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          model: d.model,
          storage: d.storage,
          gradeName,
          gradeId: d.grade_id,
          total: 0,
          available: 0,
          reserved: 0,
          sold: 0,
          adjusted: 0,
          price: d.suggested_price_usd || d.cost_price_usd || 0,
          totalCost: 0,
          devices: []
        });
      }

      const entry = map.get(key);
      entry.total += 1;
      entry.totalCost += (d.cost_price_usd || 0);
      if (d.status === 'Disponível') entry.available += 1;
      else if (d.status === 'Reservado') entry.reserved += 1;
      else if (d.status === 'Vendido') entry.sold += 1;
      else if (d.status === 'Retirado por ajuste') entry.adjusted += 1;

      entry.devices.push(d);
      if (d.suggested_price_usd || d.cost_price_usd) {
        entry.price = d.suggested_price_usd || d.cost_price_usd;
      }
    });

    const list = Array.from(map.values());
    if (selectedModel !== 'ALL') {
      return list.filter(item => item.model === selectedModel);
    }
    return list;
  }, [devices, grades, selectedModel]);

  // Exportar lista atual para Excel
  const handleExportExcel = () => {
    const exportData = filteredDevices.map(d => {
      const g = grades.find(item => item.id === d.grade_id);
      return {
        'Modelo': d.model,
        'Armazenamento': d.storage,
        'Grade': g?.name || 'A++',
        'Cor': d.color || '',
        'Saúde Bateria (%)': d.battery_health ?? '',
        'IMEI': d.imei || '',
        'Preço (USD)': d.suggested_price_usd || d.cost_price_usd || 0,
        'Status': d.status,
        'Cadastrado em': d.created_at
      };
    });
    exportDataToFile(exportData, `RiseMobile_Estoque_${new Date().toISOString().split('T')[0]}`, 'xlsx');
  };

  const openEditDevice = (dev) => {
    setEditError('');
    setEditingDevice({
      id: dev.id,
      title: `${dev.model} ${dev.storage}`,
      status: dev.status,
      imei: dev.imei || '',
      color: dev.color || '',
      battery_health: dev.battery_health ?? '',
      cost_price_usd: dev.cost_price_usd ? String(dev.cost_price_usd) : '',
      suggested_price_usd: dev.suggested_price_usd ? String(dev.suggested_price_usd) : ''
    });
  };

  const openDeleteDevice = (dev) => {
    setDeleteChoice('');
    setDeleteNote('');
    setDeleteError('');
    setDeleteBlock(getDeviceDeleteBlock(dev, commercialDeviceIds));
    setDeletingDevice(dev);
  };

  const deletionReason = buildDeletionReason(deleteChoice, deleteNote);

  const handleConfirmDelete = async () => {
    if (!deletingDevice || !onDeleteDevice || !deletionReason) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await onDeleteDevice(deletingDevice.id, deletionReason);
      setDeletingDevice(null);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveDeviceSubmit = async (e) => {
    e.preventDefault();
    if (!editingDevice || !onUpdateDevice) return;
    setIsSavingDevice(true);
    setEditError('');
    try {
      const { id, imei, color, battery_health, cost_price_usd, suggested_price_usd } = editingDevice;
      await onUpdateDevice(id, { imei, color, battery_health, cost_price_usd, suggested_price_usd });
      setEditingDevice(null);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setIsSavingDevice(false);
    }
  };

  const handleSaveGradeSubmit = (e) => {
    e.preventDefault();
    if (!editingGrade.name.trim()) return;
    onSaveGrade(editingGrade);
    setIsGradeModalOpen(false);
    setEditingGrade({ name: '', description: '', badge_color: 'lavender' });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Bar: Tabs & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Navigation Tabs Pill */}
        <div className="flex items-center p-1 bg-white dark:bg-[#0B101B]/80 dark:backdrop-blur-xl border border-slate-200 dark:border-white/12 rounded-full shadow-xs">
          <button
            onClick={() => setActiveTab('grouped')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'grouped'
                ? 'bg-[#111418] text-white dark:bg-white dark:text-slate-950 shadow-md'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white'
            }`}
          >
            Visão Agrupada ({groupedStock.length})
          </button>
          <button
            onClick={() => setActiveTab('devices')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'devices'
                ? 'bg-[#111418] text-white dark:bg-white dark:text-slate-950 shadow-md'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white'
            }`}
          >
            Aparelhos Individuais ({devices.length})
          </button>
          <button
            onClick={() => setActiveTab('grades')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'grades'
                ? 'bg-[#111418] text-white dark:bg-white dark:text-slate-950 shadow-md'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white'
            }`}
          >
            Grades ({grades.length})
          </button>
          {onDeleteDevice && (
            <button
              onClick={() => setActiveTab('removed')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeTab === 'removed'
                  ? 'bg-[#111418] text-white dark:bg-white dark:text-slate-950 shadow-md'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white'
              }`}
            >
              Removidos ({deletedDevices.length})
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {onNavigate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate('stock_entry')}
              icon={PackagePlus}
            >
              Nova Entrada de Estoque
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            icon={Download}
          >
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* TAB 1: VISÃO AGRUPADA (MODELO + ARMAZENAMENTO + GRADE) */}
      {activeTab === 'grouped' && (
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Estoque Agrupado por Configuração</h3>
              <p className="text-xs text-slate-400">Visão operacional dos aparelhos disponíveis e reservados</p>
            </div>
            
            {/* Filter by Model */}
            <div className="w-full sm:w-64">
              <Select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                options={uniqueModels.map(m => ({ value: m, label: m === 'ALL' ? 'Todos os Modelos' : m }))}
              />
            </div>
          </div>

          {groupedStock.length === 0 ? (
            <EmptyState
              title="Nenhum aparelho cadastrado no estoque"
              description="Cadastre novos aparelhos através da Entrada de Estoque manual em lote ou importação Excel/CSV."
              actionText={onNavigate ? "Fazer Entrada de Estoque" : undefined}
              onAction={onNavigate ? () => onNavigate('stock_entry') : undefined}
            />
          ) : (
            <Table headers={['Modelo & Armazenamento', 'Grade', 'Preço', 'Disponíveis', 'Reservados', 'Total', 'Ações']}>
              {groupedStock.map((group) => (
                <TableRow key={group.key}>
                  <TableCell>
                    <div className="flex items-center">
                      <span className="font-extrabold text-slate-900 dark:text-white">{group.model}</span>
                      <span className="ml-2 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {group.storage}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                      {group.gradeName}
                    </span>
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 dark:text-white">
                    {group.price ? formatUSD(group.price) : '—'}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                      {group.available} un.
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {group.reserved} un.
                    </span>
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 dark:text-white">
                    {group.total} un.
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedModel(group.model);
                        setActiveTab('devices');
                      }}
                    >
                      Ver aparelhos
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          )}
        </Card>
      )}

      {/* TAB 2: LISTA DE APARELHOS INDIVIDUAIS */}
      {activeTab === 'devices' && (
        <Card className="p-6">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <Input
              placeholder="Buscar por IMEI, cor, modelo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={Search}
            />
            <Select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              options={uniqueModels.map(m => ({ value: m, label: m === 'ALL' ? 'Todos os Modelos' : m }))}
            />
            <Select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              options={[
                { value: 'ALL', label: 'Todas as Grades' },
                ...grades.map(g => ({ value: g.id, label: `Grade ${g.name}` }))
              ]}
            />
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { value: 'ALL', label: 'Todos os Status' },
                { value: 'Disponível', label: 'Disponível' },
                { value: 'Reservado', label: 'Reservado' },
                { value: 'Vendido', label: 'Vendido' },
                { value: 'Retirado por ajuste', label: 'Retirado por ajuste' }
              ]}
            />
            <Select
              value={selectedCompleteness}
              onChange={(e) => setSelectedCompleteness(e.target.value)}
              options={[
                { value: 'ALL', label: 'Todos os dados' },
                { value: 'INCOMPLETE', label: 'Dados incompletos' },
                { value: 'NO_IMEI', label: 'Sem IMEI / Serial' }
              ]}
            />
          </div>

          {filteredDevices.length === 0 ? (
            <EmptyState
              title="Nenhum aparelho encontrado"
              description="Tente ajustar os filtros de busca ou modelo."
            />
          ) : (
            <Table headers={['Modelo & Armazenamento', 'Grade', 'Cor', 'Bateria', 'IMEI / Serial', 'Preço', 'Dados', 'Status', 'Ações']}>
              {filteredDevices.map((dev) => {
                const gradeObj = grades.find(g => g.id === dev.grade_id);
                const statusStyle = getStatusBadge(dev.status);
                const batteryStyle = getBatteryHealthBadge(dev.battery_health);
                const completeness = getDeviceCompleteness(dev);
                const deleteBlockReason = getDeviceDeleteBlock(dev, commercialDeviceIds);

                return (
                  <TableRow key={dev.id}>
                    <TableCell>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {dev.model} <span className="font-normal text-xs text-slate-400">({dev.storage})</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                        {gradeObj?.name || 'A++'}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {formatColor(dev.color)}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${batteryStyle.color}`}>
                        {batteryStyle.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                        {formatImei(dev.imei)}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900 dark:text-white">
                      {(dev.suggested_price_usd || dev.cost_price_usd) ? formatUSD(dev.suggested_price_usd || dev.cost_price_usd) : '—'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                          completeness.complete
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                            : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-white/[0.04] dark:text-slate-300 dark:border-white/10'
                        }`}
                        title={completeness.complete ? 'Todos os dados principais preenchidos' : `Falta: ${completeness.missing.join(', ')}`}
                      >
                        {completeness.complete ? 'Completo' : 'Incompleto'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${statusStyle.bg}`}>
                        {dev.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {onUpdateDevice && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDevice(dev)}
                            title="Editar dados do aparelho (IMEI, cor, bateria...)"
                            icon={Edit2}
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDeviceForHistory(dev)}
                          title="Ver Histórico & Timeline"
                          icon={History}
                        />
                        {onDeleteDevice && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDevice(dev)}
                            title={deleteBlockReason ? `Não pode ser apagado: ${deleteBlockReason}` : 'Apagar aparelho'}
                            aria-label="Apagar aparelho"
                            icon={Trash2}
                            className={deleteBlockReason
                              ? 'opacity-40 hover:opacity-70'
                              : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-300 dark:hover:text-rose-400 dark:hover:bg-rose-500/10'}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </Table>
          )}
        </Card>
      )}

      {/* TAB: APARELHOS REMOVIDOS (auditoria — não fazem parte do estoque operacional) */}
      {activeTab === 'removed' && (
        <Card className="p-6">
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Aparelhos Removidos</h3>
            <p className="text-xs text-slate-400">Cadastros apagados por engano. Ficam registrados para auditoria e não entram em estoque, reservas nem vendas.</p>
          </div>
          {deletedDevices.length === 0 ? (
            <EmptyState
              title="Nenhum aparelho removido"
              description="Quando um cadastro for apagado, ele aparece aqui com o motivo e o responsável."
            />
          ) : (
            <Table headers={['Modelo & Armazenamento', 'Grade', 'IMEI / Serial', 'Preço', 'Status', 'Removido em', 'Por', 'Motivo']}>
              {deletedDevices.map((dev) => {
                const gradeObj = grades.find(g => g.id === dev.grade_id);
                return (
                  <TableRow key={dev.id}>
                    <TableCell>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {dev.model} <span className="font-normal text-xs text-slate-400">({dev.storage})</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                        {gradeObj?.name || dev.grades?.name || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        {formatImei(dev.imei, 'IMEI não informado')}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900 dark:text-white">
                      {(dev.suggested_price_usd || dev.cost_price_usd) ? formatUSD(dev.suggested_price_usd || dev.cost_price_usd) : '—'}
                    </TableCell>
                    <TableCell>
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60">
                        Removido
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-300">{formatDate(dev.deleted_at, true)}</TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-300">{dev.deleted_by || '—'}</TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-300 max-w-[220px]">{dev.deletion_reason || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </Table>
          )}
        </Card>
      )}

      {/* TAB 3: GESTÃO DE GRADES */}
      {activeTab === 'grades' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Grades Estéticas Configuráveis</h3>
              <p className="text-xs text-slate-400">Defina as classificações de qualidade para os iPhones</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingGrade({ name: '', description: '', badge_color: 'lavender' });
                setIsGradeModalOpen(true);
              }}
              icon={Plus}
            >
              Nova Grade
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {grades.map((grade) => (
              <div 
                key={grade.id} 
                className="p-5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex px-3 py-1 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                      Grade {grade.name}
                    </span>
                    <span className={`text-[11px] font-bold ${grade.is_active ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-300'}`}>
                      {grade.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-300 mt-3 leading-relaxed">
                    {grade.description || 'Sem descrição cadastrada.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-300">
                    {devices.filter(d => d.grade_id === grade.id).length} aparelhos
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingGrade(grade);
                      setIsGradeModalOpen(true);
                    }}
                    icon={Edit2}
                  >
                    Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Drawer de Histórico de Aparelho */}
      {selectedDeviceForHistory && (
        <DeviceHistoryDrawer
          isOpen={Boolean(selectedDeviceForHistory)}
          onClose={() => setSelectedDeviceForHistory(null)}
          device={selectedDeviceForHistory}
          movements={movements.filter(m => m.device_id === selectedDeviceForHistory.id || (selectedDeviceForHistory.imei && m.imei === selectedDeviceForHistory.imei))}
          grades={grades}
          onOpenAdjustment={onOpenAdjustment}
        />
      )}

      {/* Modal: apagar aparelho do estoque */}
      <Modal
        isOpen={Boolean(deletingDevice)}
        onClose={() => setDeletingDevice(null)}
        title="Apagar aparelho do estoque?"
        subtitle="Esta ação removerá o aparelho das listagens de estoque. Use apenas para cadastros feitos por engano."
      >
        {deletingDevice && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs space-y-2">
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {deletingDevice.model} <span className="font-normal text-slate-400">({deletingDevice.storage})</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-600 dark:text-slate-300">
                <div><span className="text-slate-400">Grade:</span> <strong>{grades.find(g => g.id === deletingDevice.grade_id)?.name || '—'}</strong></div>
                <div><span className="text-slate-400">Status:</span> <strong>{deletingDevice.status}</strong></div>
                <div className="col-span-2">
                  <span className="text-slate-400">IMEI / Serial:</span>{' '}
                  <strong className="font-mono">{formatImei(deletingDevice.imei, 'IMEI não informado')}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Preço:</span>{' '}
                  <strong>{(deletingDevice.suggested_price_usd || deletingDevice.cost_price_usd) ? formatUSD(deletingDevice.suggested_price_usd || deletingDevice.cost_price_usd) : '—'}</strong>
                </div>
              </div>
            </div>

            {deleteBlock ? (
              <>
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs leading-relaxed flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">{deleteBlock}</p>
                    <p className="mt-1">{DEVICE_DELETE_BLOCKED_MESSAGE}</p>
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <Button variant="outline" size="sm" onClick={() => setDeletingDevice(null)}>Fechar</Button>
                </div>
              </>
            ) : (
              <>
                <Select
                  label="Motivo da exclusão (obrigatório)"
                  value={deleteChoice}
                  onChange={(e) => { setDeleteChoice(e.target.value); setDeleteError(''); }}
                  options={[
                    { value: '', label: 'Selecione o motivo' },
                    ...DELETE_REASON_OPTIONS.map(r => ({ value: r, label: r }))
                  ]}
                />
                {deleteChoice === 'Outro' && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="delete-note" className="text-xs font-semibold text-slate-700 dark:text-slate-200">Descreva o motivo</label>
                    <textarea
                      id="delete-note"
                      rows={3}
                      value={deleteNote}
                      onChange={(e) => setDeleteNote(e.target.value)}
                      placeholder="Ex.: unidade lançada no lote errado"
                      className="w-full p-3 text-sm rounded-xl bg-slate-50 dark:bg-[#111827]/90 border border-slate-200 dark:border-white/15 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-500/40"
                    />
                  </div>
                )}
                {deleteError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold leading-relaxed">
                    {deleteError}
                  </div>
                )}
                <div className="flex justify-end gap-2.5 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setDeletingDevice(null)}>Cancelar</Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    onClick={handleConfirmDelete}
                    disabled={!deletionReason || isDeleting}
                  >
                    {isDeleting ? 'Apagando...' : 'Apagar aparelho'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Modal de edição dos dados opcionais do aparelho */}
      <Modal
        isOpen={Boolean(editingDevice)}
        onClose={() => setEditingDevice(null)}
        title="Editar dados do aparelho"
        subtitle={editingDevice ? `${editingDevice.title} — todos os campos são opcionais e podem ser preenchidos depois.` : ''}
      >
        {editingDevice && (
          <form onSubmit={handleSaveDeviceSubmit} className="space-y-4">
            <Input
              label="IMEI / Serial (opcional)"
              placeholder="Opcional — único quando informado"
              value={editingDevice.imei}
              onChange={(e) => setEditingDevice({ ...editingDevice, imei: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })}
              className="font-mono"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Cor (opcional)"
                value={editingDevice.color}
                onChange={(e) => setEditingDevice({ ...editingDevice, color: e.target.value })}
                options={[
                  { value: '', label: 'Não informada' },
                  ...(editingDevice.color && !COLOR_OPTIONS.includes(editingDevice.color)
                    ? [{ value: editingDevice.color, label: editingDevice.color }]
                    : []),
                  ...COLOR_OPTIONS.map(c => ({ value: c, label: c }))
                ]}
              />
              <Input
                label="Bateria % (opcional)"
                type="number"
                min="0"
                max="100"
                placeholder="—"
                value={editingDevice.battery_health}
                onChange={(e) => setEditingDevice({ ...editingDevice, battery_health: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CurrencyInput
                label="Custo individual (opcional)"
                value={editingDevice.cost_price_usd}
                onChange={(val) => setEditingDevice({ ...editingDevice, cost_price_usd: val })}
                disabled={editingDevice.status === 'Vendido'}
              />
              <CurrencyInput
                label="Preço sugerido (opcional)"
                value={editingDevice.suggested_price_usd}
                onChange={(val) => setEditingDevice({ ...editingDevice, suggested_price_usd: val })}
                disabled={editingDevice.status === 'Vendido'}
              />
            </div>
            {editingDevice.status === 'Vendido' && (
              <p className="text-xs text-slate-400">Custo e preço de aparelhos já vendidos não podem ser alterados.</p>
            )}
            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                {editError}
              </div>
            )}
            <div className="flex justify-end gap-2.5 pt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setEditingDevice(null)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={isSavingDevice}>
                {isSavingDevice ? 'Salvando...' : 'Salvar dados'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal de Criação/Edição de Grade */}
      <Modal
        isOpen={isGradeModalOpen}
        onClose={() => setIsGradeModalOpen(false)}
        title={editingGrade.id ? 'Editar Grade Estética' : 'Criar Nova Grade'}
        subtitle="Configure as especificações e cor de identificação da grade"
      >
        <form onSubmit={handleSaveGradeSubmit} className="space-y-4">
          <Input
            label="Nome da Grade (ex: A++, AB+, B-)"
            required
            value={editingGrade.name}
            onChange={(e) => setEditingGrade({ ...editingGrade, name: e.target.value })}
            placeholder="Ex: A++"
          />
          <Input
            label="Descrição dos Padrões Estéticos"
            value={editingGrade.description}
            onChange={(e) => setEditingGrade({ ...editingGrade, description: e.target.value })}
            placeholder="Ex: Impecável, sem marcas, bateria 88%+"
          />
          <Select
            label="Cor do Badge"
            value={editingGrade.badge_color}
            onChange={(e) => setEditingGrade({ ...editingGrade, badge_color: e.target.value })}
            options={[
              { value: 'mint', label: 'Menta (Verde Suave)' },
              { value: 'lavender', label: 'Lavanda (Roxo Suave)' },
              { value: 'butter', label: 'Manteiga (Dourado Suave)' },
              { value: 'sky', label: 'Céu (Azul Suave)' }
            ]}
          />
          <div className="flex justify-end gap-2.5 pt-4">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsGradeModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Salvar Grade
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
