import React, { useState, useMemo } from 'react';
import { 
  Smartphone, 
  Search, 
  Download, 
  Plus,
  History, 
  Edit2
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, Select } from '../ui/Input';
import { Table, TableRow, TableCell } from '../ui/Table';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { DeviceHistoryDrawer } from './DeviceHistoryDrawer';
import { formatUSD, formatImei, getStatusBadge, getBatteryHealthBadge } from '../../lib/formatters';
import { exportDataToFile } from '../../lib/excelUtils';

export const StockManagement = ({
  devices = [],
  grades = [],
  movements = [],
  onNavigate,
  onSaveGrade,
  onOpenAdjustment
}) => {
  const [activeTab, setActiveTab] = useState('grouped'); // grouped, devices, grades
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState('ALL');
  const [selectedGrade, setSelectedGrade] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

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
        d.imei.toLowerCase().includes(q) || 
        d.model.toLowerCase().includes(q) || 
        d.color.toLowerCase().includes(q) ||
        d.storage.toLowerCase().includes(q);

      const matchModel = selectedModel === 'ALL' || d.model === selectedModel;
      const matchGrade = selectedGrade === 'ALL' || d.grade_id === selectedGrade;
      const matchStatus = selectedStatus === 'ALL' || d.status === selectedStatus;

      return matchSearch && matchModel && matchGrade && matchStatus;
    });
  }, [devices, searchQuery, selectedModel, selectedGrade, selectedStatus]);

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
        'Cor': d.color,
        'Saúde Bateria (%)': d.battery_health,
        'IMEI': d.imei,
        'Preço (USD)': d.suggested_price_usd || d.cost_price_usd || 0,
        'Status': d.status,
        'Cadastrado em': d.created_at
      };
    });
    exportDataToFile(exportData, `RiseMobile_Estoque_${new Date().toISOString().split('T')[0]}`, 'xlsx');
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
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
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
              <p className="text-xs text-slate-400">Visão operacional dos aparelhos sincronizados</p>
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
              title="Nenhum modelo sincronizado no estoque"
              description="Os aparelhos aparecerão automaticamente após a sincronização com o sistema externo."
            />
          ) : (
            <Table headers={['Modelo & Armazenamento', 'Grade', 'Preço', 'Disponíveis', 'Reservados', 'Total', 'Ações']}>
              {groupedStock.map((group) => (
                <TableRow key={group.key}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Smartphone className="w-4 h-4 text-slate-700 dark:text-slate-300 stroke-[1.8]" />
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-900 dark:text-white">{group.model}</span>
                        <span className="ml-2 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {group.storage}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                      {group.gradeName}
                    </span>
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 dark:text-white">
                    {formatUSD(group.price)}
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
                      Ver IMEIs
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Input
              placeholder="Buscar por IMEI, Cor..."
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
          </div>

          {filteredDevices.length === 0 ? (
            <EmptyState
              title="Nenhum aparelho encontrado"
              description="Tente ajustar os filtros de busca ou modelo."
            />
          ) : (
            <Table headers={['Modelo & Armazenamento', 'Grade', 'Cor', 'Bateria', 'IMEI / Serial', 'Preço', 'Status', 'Ações']}>
              {filteredDevices.map((dev) => {
                const gradeObj = grades.find(g => g.id === dev.grade_id);
                const statusStyle = getStatusBadge(dev.status);
                const batteryStyle = getBatteryHealthBadge(dev.battery_health);

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
                      {dev.color}
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
                      {formatUSD(dev.suggested_price_usd || dev.cost_price_usd)}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${statusStyle.bg}`}>
                        {dev.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDeviceForHistory(dev)}
                          title="Ver Histórico & Timeline"
                          icon={History}
                        />
                      </div>
                    </TableCell>
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
          movements={movements.filter(m => m.device_id === selectedDeviceForHistory.id || m.imei === selectedDeviceForHistory.imei)}
          grades={grades}
          onOpenAdjustment={onOpenAdjustment}
        />
      )}

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
