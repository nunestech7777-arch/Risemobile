import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Trash2,
  AlertTriangle,
  Sparkles,
  Search,
  Undo2
} from 'lucide-react';
import { IPhoneIcon } from '../common/IPhoneIcon';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, Select, CurrencyInput } from '../ui/Input';
import { Table, TableRow, TableCell } from '../ui/Table';
import { Modal, Drawer } from '../ui/Modal';
import { ConfirmDialog, EmptyState } from '../ui/EmptyState';
import { FinalizeSaleModal } from './FinalizeSaleModal';
import { RegisterReturnModal } from './RegisterReturnModal';
import { formatUSD, formatImei, formatColor, formatBattery, formatDate, getStatusBadge, getBatteryHealthBadge } from '../../lib/formatters';

const IPHONE_MODELS = [
  'iPhone 13', 'iPhone 13 mini', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
  'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
  'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
  'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max'
];

const STORAGE_OPTIONS = ['64GB', '128GB', '256GB', '512GB', '1TB'];

export const SalesModule = ({
  orders = [],
  retailers = [],
  devices = [],
  grades = [],
  exchangeRate = 5.48,
  onReserveOrder,
  onCancelOrder,
  onDeleteOrder,
  onFinalizeSale,
  onRegisterReturn
}) => {
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [orderToFinalize, setOrderToFinalize] = useState(null);
  const [saleToReturn, setSaleToReturn] = useState(null);

  // Modal Nova Venda
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSaleRetailerId, setNewSaleRetailerId] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

  // Auto-selecionar o primeiro lojista quando a lista de lojistas for carregada
  useEffect(() => {
    if ((!newSaleRetailerId || newSaleRetailerId === '') && retailers && retailers.length > 0) {
      setNewSaleRetailerId(retailers[0].id);
    }
  }, [retailers, newSaleRetailerId]);

  // Item atual sendo configurado para adicionar
  const [currentItem, setCurrentItem] = useState({
    model: 'iPhone 13',
    storage: '128GB',
    grade_id: grades[0]?.id || '',
    quantity: 1,
    unit_price_usd: '440.00'
  });

  // Lista de itens no carrinho da venda
  const [saleItems, setSaleItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Diálogo de Cancelamento
  const [saleToCancel, setSaleToCancel] = useState(null);

  // Diálogo de Exclusão de Venda
  const [saleToDelete, setSaleToDelete] = useState(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Filtragem da lista de vendas
  const filteredSales = useMemo(() => {
    return orders.filter(o => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        o.order_number.toLowerCase().includes(q) || 
        o.retailer_name.toLowerCase().includes(q) ||
        (o.allocated_devices && o.allocated_devices.some(d => (d.imei || '').toLowerCase().includes(q)));
      const matchStatus = selectedStatus === 'ALL' || o.status === selectedStatus;
      return matchSearch && matchStatus;
    });
  }, [orders, searchQuery, selectedStatus]);

  // Consulta de estoque físico real no banco/sistema
  const getRawStockCount = (model, storage, gradeId) => {
    return devices.filter(d => 
      d.model === model && 
      d.storage === storage && 
      (!gradeId || d.grade_id === gradeId) && 
      d.status === 'Disponível'
    ).length;
  };

  // Quantidade total já inserida na venda atual para uma configuração específica
  const getQuantityAlreadyInSale = (model, storage, gradeId) => {
    return saleItems
      .filter(it => it.model === model && it.storage === storage && (!gradeId || it.grade_id === gradeId))
      .reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 0), 0);
  };

  // Preço de referência para a configuração selecionada
  const getReferencePrice = (model, storage, gradeId) => {
    const matching = devices.find(d => 
      d.model === model && 
      d.storage === storage && 
      (!gradeId || d.grade_id === gradeId) &&
      (d.suggested_price_usd || d.cost_price_usd)
    );
    if (matching) {
      return (matching.suggested_price_usd || matching.cost_price_usd).toFixed(2);
    }
    return '450.00';
  };

  // Disponibilidade líquida em tempo real da configuração atualmente selecionada
  const remainingAvailable = useMemo(() => {
    const raw = getRawStockCount(currentItem.model, currentItem.storage, currentItem.grade_id);
    const inSale = getQuantityAlreadyInSale(currentItem.model, currentItem.storage, currentItem.grade_id);
    return Math.max(0, raw - inSale);
  }, [devices, saleItems, currentItem.model, currentItem.storage, currentItem.grade_id]);

  // Atualiza campo do item em configuração
  const handleCurrentItemChange = (field, value) => {
    const updated = { ...currentItem, [field]: value };
    if (field === 'model' || field === 'storage' || field === 'grade_id') {
      const price = getReferencePrice(
        field === 'model' ? value : currentItem.model,
        field === 'storage' ? value : currentItem.storage,
        field === 'grade_id' ? value : currentItem.grade_id
      );
      updated.unit_price_usd = price;
    }
    setCurrentItem(updated);
    setErrorMessage('');
  };

  // Adicionar item ao carrinho da venda com consolidação instantânea
  const handleAddItemToSale = () => {
    const qty = parseInt(currentItem.quantity, 10);
    if (!qty || qty <= 0) {
      setErrorMessage('Informe uma quantidade válida (mínimo 1).');
      return;
    }

    if (qty > remainingAvailable) {
      setErrorMessage(`Estoque insuficiente para esta configuração (${remainingAvailable} restantes disponíveis).`);
      return;
    }

    const gradeObj = grades.find(g => g.id === currentItem.grade_id);
    const unitPrice = parseFloat(currentItem.unit_price_usd) || 0;
    const targetGradeId = currentItem.grade_id || (grades[0]?.id || '');

    // Se já existir um item com exatamente a mesma configuração na venda, consolida na mesma linha
    const existingIndex = saleItems.findIndex(it => 
      it.model === currentItem.model && 
      it.storage === currentItem.storage && 
      it.grade_id === targetGradeId
    );

    if (existingIndex !== -1) {
      const updated = [...saleItems];
      const newTotalQty = updated[existingIndex].quantity + qty;
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newTotalQty,
        unit_price_usd: unitPrice,
        total_price_usd: newTotalQty * unitPrice
      };
      setSaleItems(updated);
    } else {
      const newItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        model: currentItem.model,
        storage: currentItem.storage,
        grade_id: targetGradeId,
        grade_name: gradeObj?.name || 'A++',
        quantity: qty,
        unit_price_usd: unitPrice,
        total_price_usd: qty * unitPrice
      };
      setSaleItems([...saleItems, newItem]);
    }

    setErrorMessage('');

    // Prepara próximo item com quantidade 1
    setCurrentItem(prev => ({ ...prev, quantity: 1 }));
  };

  // Remover item do carrinho (devolve imediatamente a quantidade para o cálculo visual)
  const handleRemoveSaleItem = (id) => {
    setSaleItems(saleItems.filter(item => item.id !== id));
    setErrorMessage('');
  };

  // Atualizar quantidade de um item no carrinho com limite automático
  const handleUpdateItemQuantity = (id, newQty) => {
    const targetItem = saleItems.find(it => it.id === id);
    if (!targetItem) return;

    const rawStock = getRawStockCount(targetItem.model, targetItem.storage, targetItem.grade_id);
    const otherInSale = saleItems
      .filter(it => it.id !== id && it.model === targetItem.model && it.storage === targetItem.storage && it.grade_id === targetItem.grade_id)
      .reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 0), 0);

    const maxAllowed = Math.max(1, rawStock - otherInSale);
    const requestedQty = parseInt(newQty, 10);
    const validQty = isNaN(requestedQty) ? 1 : Math.max(1, Math.min(maxAllowed, requestedQty));

    setSaleItems(saleItems.map(item => {
      if (item.id === id) {
        return {
          ...item,
          quantity: validQty,
          total_price_usd: validQty * item.unit_price_usd
        };
      }
      return item;
    }));
  };

  // Totalizadores da venda
  const totalSaleAmount = useMemo(() => {
    return saleItems.reduce((sum, item) => sum + (item.quantity * item.unit_price_usd), 0);
  }, [saleItems]);

  const totalSaleUnits = useMemo(() => {
    return saleItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [saleItems]);

  // Aparelhos que serão automaticamente selecionados pelo sistema
  const autoAllocatedPreview = useMemo(() => {
    const result = [];
    const usedDeviceIds = new Set();

    for (const item of saleItems) {
      const matching = devices
        .filter(d => 
          d.model === item.model &&
          d.storage === item.storage &&
          (!item.grade_id || d.grade_id === item.grade_id) &&
          d.status === 'Disponível' &&
          !usedDeviceIds.has(d.id)
        )
        .sort((a, b) => (b.battery_health || 0) - (a.battery_health || 0));

      const chosen = matching.slice(0, item.quantity);
      chosen.forEach(d => {
        usedDeviceIds.add(d.id);
        result.push({
          ...d,
          item_model: item.model,
          item_storage: item.storage,
          unit_price_usd: item.unit_price_usd
        });
      });
    }

    return result;
  }, [devices, saleItems]);

  // Submissão da Nova Venda
  const handleConfirmSale = async (proceedToPayment = false) => {
    const effectiveRetailerId = newSaleRetailerId || (retailers && retailers.length > 0 ? retailers[0].id : null);
    if (!effectiveRetailerId) {
      setErrorMessage('Por favor, cadastre e selecione um lojista parceiro antes de prosseguir.');
      return;
    }
    if (saleItems.length === 0) {
      setErrorMessage('Adicione pelo menos um aparelho à venda.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const orderPayload = {
        retailer_id: effectiveRetailerId,
        notes: saleNotes
      };

      const createdSale = await onReserveOrder(orderPayload, saleItems);

      setIsCreateModalOpen(false);
      setSaleItems([]);
      setNewSaleRetailerId('');
      setSaleNotes('');

      if (proceedToPayment && createdSale?.id) {
        setOrderToFinalize(createdSale);
      } else {
        setSelectedSale(createdSale);
      }
    } catch (err) {
      setErrorMessage(`Erro ao processar venda: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir Modal de Nova Venda
  const handleOpenNewSale = () => {
    setSaleItems([]);
    setNewSaleRetailerId(retailers[0]?.id || '');
    setSaleNotes('');
    setErrorMessage('');
    setCurrentItem({
      model: 'iPhone 13',
      storage: '128GB',
      grade_id: grades[0]?.id || '',
      quantity: 1,
      unit_price_usd: getReferencePrice('iPhone 13', '128GB', grades[0]?.id)
    });
    setIsCreateModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Módulo de Vendas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            Monte pedidos por modelo e configuração com seleção atômica automática de estoque
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleOpenNewSale}
          icon={Plus}
        >
          Nova Venda
        </Button>
      </div>

      {/* Filters Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="Buscar por número da venda, lojista, IMEI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={Search}
          />
          <Select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            options={[
              { value: 'ALL', label: 'Todos os Status' },
              { value: 'Reservado', label: 'Reservado' },
              { value: 'Em Separação', label: 'Em Separação' },
              { value: 'Finalizado', label: 'Finalizado' },
              { value: 'Parcialmente Devolvida', label: 'Parcialmente Devolvida' },
              { value: 'Totalmente Devolvida', label: 'Totalmente Devolvida' },
              { value: 'Cancelado', label: 'Cancelado' }
            ]}
          />
          <div className="flex items-center justify-end px-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
            Total de {filteredSales.length} {filteredSales.length === 1 ? 'venda' : 'vendas'}
          </div>
        </div>
      </Card>

      {/* Sales List Table */}
      <Card className="p-6">
        {filteredSales.length === 0 ? (
          <EmptyState
            title="Nenhuma venda encontrada"
            description="Inicie uma nova venda selecionando modelos e quantidades."
            actionText="Criar Nova Venda"
            onAction={handleOpenNewSale}
          />
        ) : (
          <Table headers={['Venda', 'Lojista', 'Modelos & Itens', 'Total Original', 'Devolução', 'Total Líquido', 'Status', 'Data', 'Ações']}>
            {filteredSales.map((sale) => {
              const activeUnits = sale.allocated_devices?.length ?? (sale.items?.reduce((acc, i) => acc + (i.quantity || 1), 0) || 0);
              const returnedUnits = sale.returned_devices?.length || 0;
              const totalUnits = activeUnits + returnedUnits;
              const statusStyle = getStatusBadge(sale.status);
              const returnedAmount = parseFloat(sale.returned_amount_usd) || 0;
              const netTotal = (parseFloat(sale.total_amount_usd) || 0) - returnedAmount;
              const isPendingFinalization = sale.status !== 'Finalizado' && sale.status !== 'Cancelado' && sale.status !== 'Parcialmente Devolvida' && sale.status !== 'Totalmente Devolvida';

              return (
                <TableRow key={sale.id}>
                  <TableCell>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {sale.order_number}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {sale.retailer_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {returnedUnits > 0
                        ? `${activeUnits} ativos • ${returnedUnits} devolvidos`
                        : `${totalUnits} ${totalUnits === 1 ? 'aparelho' : 'aparelhos'}`}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-xs">
                      {sale.items?.map(i => `${i.quantity}x ${i.model} ${i.storage}`).join(', ') || 'Aparelhos selecionados'}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-600 dark:text-slate-300">
                    {formatUSD(sale.total_amount_usd)}
                  </TableCell>
                  <TableCell className={returnedAmount > 0 ? 'font-bold text-rose-500 dark:text-rose-400' : 'text-slate-400'}>
                    {returnedAmount > 0 ? `-${formatUSD(returnedAmount)}` : '—'}
                  </TableCell>
                  <TableCell className="font-extrabold text-slate-900 dark:text-white">
                    {formatUSD(netTotal)}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${statusStyle.bg}`}>
                      {sale.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {formatDate(sale.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSale(sale)}
                        title="Ver Detalhes e IMEIs"
                      >
                        Ver Detalhes
                      </Button>
                      {isPendingFinalization && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOrderToFinalize(sale)}
                          icon={DollarSign}
                          title="Finalizar Venda"
                        >
                          Finalizar Venda
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeleteError('');
                          setSaleToDelete(sale);
                        }}
                        icon={Trash2}
                        title="Excluir Venda"
                        className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </Table>
        )}
      </Card>

      {/* MODAL CONSTRUTOR DE NOVA VENDA */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Nova Venda de iPhones"
        subtitle="Selecione modelos, grade e quantidade. O backend alocará os melhores IMEIs automaticamente."
        size="xl"
      >
        <div className="space-y-6">
          {/* SEÇÃO 1: SELETOR DE CONFIGURAÇÃO DO ITEM */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <IPhoneIcon className="w-4 h-4" /> Configurar Item do Pedido
              </h4>
              <span className="inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#111418] text-white dark:bg-slate-900 dark:text-white border border-slate-900 dark:border-slate-700 shadow-xs tracking-tight">
                {remainingAvailable > 0 ? `${remainingAvailable} disponíveis no estoque` : '0 disponíveis no estoque'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select
                label="Modelo"
                value={currentItem.model}
                onChange={(e) => handleCurrentItemChange('model', e.target.value)}
                options={IPHONE_MODELS.map(m => ({ value: m, label: m }))}
              />
              <Select
                label="Armazenamento"
                value={currentItem.storage}
                onChange={(e) => handleCurrentItemChange('storage', e.target.value)}
                options={STORAGE_OPTIONS.map(s => ({ value: s, label: s }))}
              />
              <Select
                label="Grade Estética"
                value={currentItem.grade_id}
                onChange={(e) => handleCurrentItemChange('grade_id', e.target.value)}
                options={grades.map(g => ({ value: g.id, label: `Grade ${g.name}` }))}
              />
              <Input
                label="Quantidade"
                type="number"
                min="1"
                max={Math.max(1, remainingAvailable)}
                value={remainingAvailable <= 0 ? 0 : currentItem.quantity}
                onChange={(e) => handleCurrentItemChange('quantity', e.target.value)}
                disabled={remainingAvailable <= 0}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <div className="w-full sm:w-48">
                <CurrencyInput
                  label="Preço Unitário (USD)"
                  value={currentItem.unit_price_usd}
                  onChange={(val) => handleCurrentItemChange('unit_price_usd', val)}
                  currency="USD"
                />
              </div>

              <div className="flex items-end justify-end">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleAddItemToSale}
                  disabled={remainingAvailable <= 0 || isSubmitting}
                  icon={Plus}
                >
                  {remainingAvailable > 0 ? 'Adicionar à Venda' : 'Sem Estoque'}
                </Button>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: ITENS ADICIONADOS NA VENDA */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Itens na Venda ({saleItems.length})
              </h4>
              {saleItems.length > 0 && (
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Total: {totalSaleUnits} un. • {formatUSD(totalSaleAmount)}
                </span>
              )}
            </div>

            {saleItems.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                Nenhum item adicionado ainda. Configure o modelo acima e clique em "Adicionar à Venda".
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <Table headers={['Modelo & Configuração', 'Grade', 'Preço Unit.', 'Qtd', 'Subtotal', 'Ação']}>
                  {saleItems.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-bold text-slate-900 dark:text-white">
                        {item.model} <span className="text-xs text-slate-400 font-normal">({item.storage})</span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                          {item.grade_name}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-700 dark:text-slate-300">
                        {formatUSD(item.unit_price_usd)}
                      </TableCell>
                      <TableCell>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItemQuantity(item.id, e.target.value)}
                          className="w-16 bg-slate-100 dark:bg-white/[0.08] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 rounded-lg px-2 py-1 text-xs font-bold text-center"
                        />
                      </TableCell>
                      <TableCell className="font-extrabold text-slate-900 dark:text-white">
                        {formatUSD(item.quantity * item.unit_price_usd)}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleRemoveSaleItem(item.id)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Remover item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </Table>
              </div>
            )}
          </div>

          {/* SEÇÃO 3: PRÉVIA DOS IMEIs SELECIONADOS AUTOMATICAMENTE */}
          {autoAllocatedPreview.length > 0 && (
            <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-cyan-400" />
                <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                  Seleção Automática de Aparelhos ({autoAllocatedPreview.length} selecionados por maior saúde de bateria; IMEI é opcional):
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {autoAllocatedPreview.map(dev => {
                  const bStyle = getBatteryHealthBadge(dev.battery_health);
                  return (
                    <div key={dev.id} className="p-2 bg-white dark:bg-white/[0.04] dark:backdrop-blur-sm rounded-xl border border-indigo-100 dark:border-white/10 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-mono font-bold text-slate-900 dark:text-white">{formatImei(dev.imei, 'IMEI não informado')}</div>
                        <div className="text-[10px] text-slate-400">{dev.model}{dev.color ? ` • ${dev.color}` : ''}</div>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${bStyle.color}`}>
                        {formatBattery(dev.battery_health)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SEÇÃO 4: LOJISTA E FINALIZAÇÃO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Select
              label="Lojista Parceiro"
              value={newSaleRetailerId || (retailers && retailers.length > 0 ? retailers[0].id : '')}
              onChange={(e) => setNewSaleRetailerId(e.target.value)}
              options={retailers.map(r => ({ value: r.id, label: r.contact_name ? `${r.store_name} (${r.contact_name})` : r.store_name }))}
              required
            />
            <Input
              label="Observações da Venda"
              placeholder="Ex: Entrega via motoboy, cliente VIP..."
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
            />
          </div>

          {/* MENSAGEM DE ERRO */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* AÇÕES DE SUBMISSÃO */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500">
              Total da Venda: <strong className="text-base text-slate-900 dark:text-white">{formatUSD(totalSaleAmount)}</strong>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => handleConfirmSale(false)}
                disabled={isSubmitting || saleItems.length === 0}
                icon={Clock}
              >
                Confirmar Reserva
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => handleConfirmSale(true)}
                disabled={isSubmitting || saleItems.length === 0}
                icon={CheckCircle2}
              >
                {isSubmitting ? 'Processando...' : 'Confirmar & Ir para Pagamento'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* DRAWER DE DETALHES DA VENDA */}
      {selectedSale && (
        <Drawer
          isOpen={Boolean(selectedSale)}
          onClose={() => setSelectedSale(null)}
          title={`Venda ${selectedSale.order_number}`}
          subtitle={`Lojista: ${selectedSale.retailer_name} • Realizada em ${formatDate(selectedSale.created_at)}`}
        >
          <div className="space-y-6">
            {/* Resumo Financeiro */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-400">
                  {selectedSale.returned_amount_usd > 0 ? 'Faturamento Bruto' : 'Total da Venda'}
                </span>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                  {formatUSD(selectedSale.total_amount_usd)}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-400">Saldo Devedor</span>
                <div className={`text-lg font-extrabold mt-1 ${
                  selectedSale.balance_due_usd > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {formatUSD(selectedSale.balance_due_usd || 0)}
                </div>
              </div>
              {selectedSale.returned_amount_usd > 0 && (
                <>
                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60">
                    <span className="text-xs text-rose-600 dark:text-rose-300">Devolvido</span>
                    <div className="text-lg font-extrabold text-rose-600 dark:text-rose-400 mt-1">
                      -{formatUSD(selectedSale.returned_amount_usd)}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60">
                    <span className="text-xs text-emerald-700 dark:text-emerald-300">Faturamento Líquido</span>
                    <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatUSD(selectedSale.total_amount_usd - selectedSale.returned_amount_usd)}
                    </div>
                  </div>
                </>
              )}
              {selectedSale.credit_due_usd > 0 && (
                <div className="col-span-2 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Crédito ao lojista pendente de tratamento: {formatUSD(selectedSale.credit_due_usd)}
                </div>
              )}
            </div>

            {/* Aparelhos Ativos na Venda */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Aparelhos na Venda ({selectedSale.allocated_devices?.length || 0})
              </h4>
              <div className="space-y-2">
                {(selectedSale.allocated_devices || []).length === 0 ? (
                  <div className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    Todos os aparelhos desta venda foram devolvidos.
                  </div>
                ) : (
                  selectedSale.allocated_devices.map((dev, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          {dev.model} {dev.storage} — <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{formatImei(dev.imei, 'IMEI não informado')}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Cor: {formatColor(dev.color)} • Bateria: {formatBattery(dev.battery_health)}
                        </div>
                      </div>
                      <Badge variant={dev.separated ? 'mint' : 'lavender'} size="sm">
                        {dev.separated ? 'Separado' : 'Reservado'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Aparelhos Devolvidos */}
            {selectedSale.returned_devices?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Aparelhos Devolvidos ({selectedSale.returned_devices.length})
                </h4>
                <div className="space-y-2">
                  {selectedSale.returned_devices.map((dev, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 flex items-center justify-between opacity-70">
                      <div>
                        <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          {dev.model} {dev.storage} — <span className="font-mono text-xs text-slate-400">{formatImei(dev.imei, 'IMEI não informado')}</span>
                        </div>
                      </div>
                      <Badge variant="lavender" size="sm">Devolvido</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Histórico de Devoluções */}
            {selectedSale.returns?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Devoluções ({selectedSale.returns.length})
                </h4>
                <div className="space-y-2.5">
                  {selectedSale.returns.map((ret, idx) => (
                    <div key={ret.id || idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{ret.reason}</span>
                        <span className="text-xs text-slate-400">{formatDate(ret.created_at, true)}</span>
                      </div>
                      {ret.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ret.notes}</p>
                      )}
                      <div className="mt-2 space-y-1">
                        {(ret.items || []).map((item, iIdx) => (
                          <div key={iIdx} className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between">
                            <span>{formatImei(item.imei, 'IMEI não informado')} — {item.model} {item.storage}</span>
                            <span className="font-bold text-rose-500">-{formatUSD(item.original_sale_price_usd)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ações da Venda */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
              {selectedSale.status !== 'Finalizado' && selectedSale.status !== 'Cancelado' && selectedSale.status !== 'Parcialmente Devolvida' && selectedSale.status !== 'Totalmente Devolvida' && (
                <>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => {
                      setOrderToFinalize(selectedSale);
                      setSelectedSale(null);
                    }}
                    icon={DollarSign}
                  >
                    Finalizar Venda
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSaleToCancel(selectedSale);
                      setSelectedSale(null);
                    }}
                    icon={XCircle}
                    className="text-rose-600 hover:bg-rose-50"
                  >
                    Cancelar Venda & Liberar Estoque
                  </Button>
                </>
              )}

              {(selectedSale.status === 'Finalizado' || selectedSale.status === 'Parcialmente Devolvida') && selectedSale.allocated_devices?.length > 0 && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setSaleToReturn(selectedSale);
                    setSelectedSale(null);
                  }}
                  icon={Undo2}
                  className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950/30"
                >
                  Registrar Devolução
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDeleteError('');
                  setSaleToDelete(selectedSale);
                  setSelectedSale(null);
                }}
                icon={Trash2}
                className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-900/60 dark:hover:bg-rose-950/30"
              >
                Excluir Venda
              </Button>
            </div>
          </div>
        </Drawer>
      )}

      {/* DIÁLOGO DE CANCELAMENTO */}
      {saleToCancel && (
        <ConfirmDialog
          isOpen={Boolean(saleToCancel)}
          onClose={() => setSaleToCancel(null)}
          onConfirm={async () => {
            await onCancelOrder(saleToCancel.id, 'Cancelado pelo administrador');
            setSaleToCancel(null);
          }}
          title="Cancelar Venda e Liberar Estoque"
          message={`Tem certeza que deseja cancelar a venda ${saleToCancel.order_number}? Todos os ${saleToCancel.allocated_devices?.length || 0} aparelhos retornarão imediatamente para o status Disponível.`}
          confirmText="Sim, Cancelar Venda"
          cancelText="Não, Manter"
          variant="danger"
        />
      )}

      {/* DIÁLOGO DE EXCLUSÃO DE VENDA */}
      {saleToDelete && (
        <ConfirmDialog
          isOpen={Boolean(saleToDelete)}
          onClose={() => { if (!isDeletingOrder) setSaleToDelete(null); }}
          onConfirm={async () => {
            setIsDeletingOrder(true);
            setDeleteError('');
            try {
              await onDeleteOrder(saleToDelete.id);
              setSaleToDelete(null);
            } catch (err) {
              setDeleteError(err.message || 'Erro ao excluir a venda.');
            } finally {
              setIsDeletingOrder(false);
            }
          }}
          title="Excluir Venda Permanentemente"
          message={
            deleteError
              ? deleteError
              : `Tem certeza que deseja excluir a venda ${saleToDelete.order_number}? Os aparelhos ainda vinculados voltarão automaticamente para Disponível no estoque. Pagamentos, parcelas e devoluções desta venda serão apagados. Esta ação não pode ser desfeita.`
          }
          confirmText="Sim, Excluir Venda"
          cancelText="Não, Manter"
          variant="danger"
          loading={isDeletingOrder}
        />
      )}

      {/* MODAL DE FINALIZAÇÃO DE VENDA (pagamento + parcelamento em uma única etapa) */}
      <FinalizeSaleModal
        isOpen={Boolean(orderToFinalize)}
        order={orderToFinalize}
        exchangeRate={exchangeRate}
        onClose={() => setOrderToFinalize(null)}
        onFinalizeSale={onFinalizeSale}
      />

      {/* MODAL DE DEVOLUÇÃO DE APARELHOS (venda já finalizada) */}
      <RegisterReturnModal
        isOpen={Boolean(saleToReturn)}
        order={saleToReturn}
        onClose={() => setSaleToReturn(null)}
        onRegisterReturn={onRegisterReturn}
      />
    </div>
  );
};
