import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Award, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  DollarSign, 
  Users, 
  Building2,
  Calendar,
  Receipt,
  FileText,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Check,
  Filter,
  X
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, Select, CurrencyInput } from '../ui/Input';
import { Table, TableRow, TableCell } from '../ui/Table';
import { IPhoneIcon } from '../common/IPhoneIcon';
import { Modal, Drawer } from '../ui/Modal';
import { formatUSD, formatDate } from '../../lib/formatters';

export const CommissionsModule = ({
  orders = [],
  retailers = [],
  retailerReferrals = [],
  onSaveReferral,
  onDeleteReferral
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('all'); // all, today, yesterday, this_week, this_month, last_month, last_7_days, last_20_days, last_30_days, this_year, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const periodDropdownRef = useRef(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReferral, setEditingReferral] = useState(null);
  const [detailReferral, setDetailReferral] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    referrer_name: '',
    retailer_id: '',
    commission_per_unit_usd: '1.00',
    notes: '',
    status: 'Ativo'
  });

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target)) {
        setIsPeriodDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lista de Opções Rápidas de Período
  const PERIOD_OPTIONS = [
    { id: 'all', label: 'Todo o período' },
    { id: 'today', label: 'Hoje' },
    { id: 'yesterday', label: 'Ontem' },
    { id: 'this_week', label: 'Esta semana' },
    { id: 'this_month', label: 'Este mês' },
    { id: 'last_month', label: 'Mês anterior' },
    { id: 'last_7_days', label: 'Últimos 7 dias' },
    { id: 'last_20_days', label: 'Últimos 20 dias' },
    { id: 'last_30_days', label: 'Últimos 30 dias' },
    { id: 'this_year', label: 'Este ano' },
    { id: 'custom', label: 'Período personalizado' }
  ];

  // Função auxiliar de normalização de data local (YYYY-MM-DD)
  const getLocalDateString = (d) => {
    if (!d || isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Label formatado do período ativo
  const activePeriodLabel = useMemo(() => {
    if (selectedPeriod === 'custom') {
      if (customStartDate && customEndDate) {
        const startFormatted = customStartDate.split('-').reverse().join('/');
        const endFormatted = customEndDate.split('-').reverse().join('/');
        return `${startFormatted} — ${endFormatted}`;
      }
      if (customStartDate) return `A partir de ${customStartDate.split('-').reverse().join('/')}`;
      if (customEndDate) return `Até ${customEndDate.split('-').reverse().join('/')}`;
      return 'Período personalizado';
    }
    const opt = PERIOD_OPTIONS.find(o => o.id === selectedPeriod);
    return opt ? opt.label : 'Todo o período';
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Função para testar se um pedido finalizado está no período selecionado
  const isOrderInPeriod = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = getLocalDateString(today);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    return (order) => {
      // Regra 1: Somente vendas com status "Finalizado" são válidas
      if (order.status !== 'Finalizado') return false;

      // Regra 2: "all" inclui todo o histórico
      if (selectedPeriod === 'all') return true;

      const orderDate = new Date(order.finalized_at || order.created_at);
      if (isNaN(orderDate.getTime())) return false;
      const orderDateStr = getLocalDateString(orderDate);

      if (selectedPeriod === 'custom') {
        if (customStartDate && orderDateStr < customStartDate) return false;
        if (customEndDate && orderDateStr > customEndDate) return false;
        return true;
      }

      switch (selectedPeriod) {
        case 'today':
          return orderDateStr === todayStr;

        case 'yesterday':
          return orderDateStr === yesterdayStr;

        case 'this_week': {
          const firstDayOfWeek = new Date(today);
          firstDayOfWeek.setDate(today.getDate() - today.getDay());
          return orderDate >= firstDayOfWeek;
        }

        case 'this_month': {
          const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return orderDate >= firstDayOfMonth;
        }

        case 'last_month': {
          const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
          return orderDate >= firstDayOfLastMonth && orderDate <= lastDayOfLastMonth;
        }

        case 'last_7_days': {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(today.getDate() - 7);
          return orderDate >= sevenDaysAgo;
        }

        case 'last_20_days': {
          const twentyDaysAgo = new Date(today);
          twentyDaysAgo.setDate(today.getDate() - 20);
          return orderDate >= twentyDaysAgo;
        }

        case 'last_30_days': {
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(today.getDate() - 30);
          return orderDate >= thirtyDaysAgo;
        }

        case 'this_year': {
          const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
          return orderDate >= firstDayOfYear;
        }

        default:
          return true;
      }
    };
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Vendas Concluídas Válidas no Período Selecionado
  const validCompletedOrders = useMemo(() => {
    return orders.filter(isOrderInPeriod);
  }, [orders, isOrderInPeriod]);

  // Cálculo de Peças e Comissão por Indicação de Lojista com Suporte a Snapshot
  const calculatedReferrals = useMemo(() => {
    return retailerReferrals.map(ref => {
      // Vendas válidas deste lojista no período filtrado
      const matchingOrders = validCompletedOrders.filter(o => o.retailer_id === ref.retailer_id);

      // Soma das peças e cálculo de comissão com base no valor snapshot da venda ou taxa atual
      let totalPieces = 0;
      let totalCommission = 0;
      const salesBreakdown = [];

      matchingOrders.forEach(order => {
        const units = order.allocated_devices?.length || 0;
        // Snapshot histórico preserva o valor aplicado no momento da venda
        const rateApplied = typeof order.commission_per_unit_snapshot === 'number'
          ? order.commission_per_unit_snapshot
          : (parseFloat(ref.commission_per_unit_usd) || 0);

        const orderCommission = units * rateApplied;
        totalPieces += units;
        totalCommission += orderCommission;

        salesBreakdown.push({
          order_id: order.id,
          order_number: order.order_number,
          units,
          rateApplied,
          orderCommission,
          finalized_at: order.finalized_at || order.created_at
        });
      });

      // Ordena extrato da mais recente para a mais antiga
      salesBreakdown.sort((a, b) => new Date(b.finalized_at) - new Date(a.finalized_at));

      return {
        ...ref,
        unitsCount: totalPieces,
        totalCommission,
        currentRate: parseFloat(ref.commission_per_unit_usd) || 0,
        salesBreakdown
      };
    });
  }, [retailerReferrals, validCompletedOrders]);

  // Filtro de Busca combinado com os dados calculados do período
  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return calculatedReferrals;
    return calculatedReferrals.filter(r => 
      r.referrer_name?.toLowerCase().includes(q) ||
      r.retailer_name?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q)
    );
  }, [calculatedReferrals, searchQuery]);

  // Totais dos Indicadores do Topo (Respeitam o Período Selecionado)
  const totalCommissionedPieces = useMemo(() => {
    return calculatedReferrals.reduce((sum, r) => sum + r.unitsCount, 0);
  }, [calculatedReferrals]);

  const totalCommissionsAmount = useMemo(() => {
    return calculatedReferrals.reduce((sum, r) => sum + r.totalCommission, 0);
  }, [calculatedReferrals]);

  const activeReferralsCount = useMemo(() => {
    return retailerReferrals.filter(r => r.status === 'Ativo').length;
  }, [retailerReferrals]);

  // Lojistas disponíveis para cadastro (impede dois indicadores ativos para o mesmo lojista)
  const availableRetailersForCreate = useMemo(() => {
    const usedRetailerIds = new Set(
      retailerReferrals
        .filter(r => r.status === 'Ativo' && (!editingReferral || r.id !== editingReferral.id))
        .map(r => r.retailer_id)
    );
    return retailers.filter(ret => !usedRetailerIds.has(ret.id));
  }, [retailers, retailerReferrals, editingReferral]);

  // Sincroniza dados do extrato aberto com as alterações de período
  const activeDetailData = useMemo(() => {
    if (!detailReferral) return null;
    return calculatedReferrals.find(r => r.id === detailReferral.id) || detailReferral;
  }, [detailReferral, calculatedReferrals]);

  // Abrir Modal para Cadastro
  const handleOpenCreateModal = () => {
    setEditingReferral(null);
    setFormData({
      referrer_name: '',
      retailer_id: availableRetailersForCreate[0]?.id || '',
      commission_per_unit_usd: '1.00',
      notes: '',
      status: 'Ativo'
    });
    setIsModalOpen(true);
  };

  // Abrir Modal para Edição
  const handleOpenEditModal = (ref, e) => {
    e?.stopPropagation();
    setEditingReferral(ref);
    setFormData({
      referrer_name: ref.referrer_name || '',
      retailer_id: ref.retailer_id || '',
      commission_per_unit_usd: String(ref.commission_per_unit_usd || '1.00'),
      notes: ref.notes || '',
      status: ref.status || 'Ativo'
    });
    setIsModalOpen(true);
  };

  // Salvar Indicação
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.referrer_name.trim()) {
      alert('Informe o nome da pessoa que indicou.');
      return;
    }
    if (!formData.retailer_id) {
      alert('Selecione o lojista indicado.');
      return;
    }

    const ret = retailers.find(r => r.id === formData.retailer_id);

    const payload = {
      ...(editingReferral ? { id: editingReferral.id } : {}),
      referrer_name: formData.referrer_name.trim(),
      retailer_id: formData.retailer_id,
      retailer_name: ret?.store_name || formData.retailer_name || 'Lojista',
      commission_per_unit_usd: parseFloat(formData.commission_per_unit_usd) || 0,
      notes: formData.notes.trim(),
      status: formData.status
    };

    if (onSaveReferral) {
      await onSaveReferral(payload);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id, name, e) => {
    e?.stopPropagation();
    if (window.confirm(`Deseja remover a indicação de ${name}?`)) {
      if (onDeleteReferral) {
        await onDeleteReferral(id);
      }
      if (detailReferral?.id === id) {
        setDetailReferral(null);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header & Botão Nova Indicação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-slate-800 dark:text-slate-200" />
            Comissões por Indicação de Lojista
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
            Valor fixo devido ao indicador por cada aparelho comprado pelo lojista indicado
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="primary" 
            size="md" 
            onClick={handleOpenCreateModal} 
            icon={Plus}
          >
            Nova Indicação
          </Button>
        </div>
      </div>

      {/* 3 Indicadores Minimalistas do Topo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Peças Comissionadas */}
        <div className="p-5 rounded-none bg-white dark:bg-[#0B1220]/90 dark:backdrop-blur-xl border border-slate-200/80 dark:border-white/12 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Total de Peças Comissionadas
            </span>
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-cyan-300">
              <IPhoneIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            {totalCommissionedPieces} <span className="text-sm font-semibold text-slate-500 dark:text-slate-300">un.</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-300 mt-1">
            <span>Período:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">{activePeriodLabel}</span>
          </div>
        </div>

        {/* Total de Comissões */}
        <div className="p-5 rounded-none bg-white dark:bg-[#0B1220]/90 dark:backdrop-blur-xl border border-slate-200/80 dark:border-white/12 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Total de Comissões
            </span>
            <div className="p-2 rounded-lg bg-[#111418] text-white dark:bg-emerald-500/20 dark:text-emerald-300 dark:border dark:border-emerald-500/30">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            {formatUSD(totalCommissionsAmount)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-300 mt-1">
            <span>Período:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">{activePeriodLabel}</span>
          </div>
        </div>

        {/* Indicações Ativas */}
        <div className="p-5 rounded-none bg-white dark:bg-[#0B1220]/90 dark:backdrop-blur-xl border border-slate-200/80 dark:border-white/12 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Indicações Ativas
            </span>
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-purple-300">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            {activeReferralsCount} <span className="text-sm font-semibold text-slate-500 dark:text-slate-300">lojistas</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-300 mt-1">Relações indicador $\rightarrow$ lojista</span>
        </div>
      </div>

      {/* Tabela Principal de Indicações de Lojistas */}
      <Card className="p-6">
        {/* Cabeçalho da Tabela com Filtro de Data e Busca Integrados */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Indicações e Comissões Acumuladas
            </h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-xs text-slate-400">
                Fórmula: Peças Compradas pelo Lojista × Valor Fixo por Peça
              </p>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-md">
                <Calendar className="w-3 h-3 text-slate-400" />
                {activePeriodLabel}
              </span>
            </div>
          </div>

          {/* Controles de Ação: Filtro de Período + Campo de Busca */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Popover / Dropdown do Filtro de Período */}
            <div className="relative" ref={periodDropdownRef}>
              <button
                type="button"
                onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
                className={`flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all w-full sm:w-auto ${
                  selectedPeriod !== 'all'
                    ? 'bg-[#111418] text-white border-[#111418] dark:bg-white/20 dark:border-white/30 dark:text-white shadow-xs'
                    : 'bg-white dark:bg-white/[0.05] text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 shadow-xs'
                }`}
                title="Filtrar compras por período"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 opacity-80" />
                  <span className="truncate max-w-[160px]">{activePeriodLabel}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform ${isPeriodDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Menu Flutuante de Períodos */}
              {isPeriodDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-[#0D121D]/95 dark:backdrop-blur-2xl border border-slate-200 dark:border-white/15 rounded-2xl shadow-modal dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50 p-3 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-white/10">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Filtrar Comissões por Período
                    </span>
                    {selectedPeriod !== 'all' && (
                      <button
                        onClick={() => {
                          setSelectedPeriod('all');
                          setCustomStartDate('');
                          setCustomEndDate('');
                        }}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        Limpar Filtro
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {PERIOD_OPTIONS.filter(o => o.id !== 'custom').map(opt => {
                      const isSelected = selectedPeriod === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setSelectedPeriod(opt.id);
                            setIsPeriodDropdownOpen(false);
                          }}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                            isSelected
                              ? 'bg-[#111418] text-white dark:bg-white/20 dark:text-white font-bold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08]'
                          }`}
                        >
                          <span className="truncate">{opt.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 ml-1 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Opção de Período Personalizado */}
                  <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-white/10">
                    <button
                      onClick={() => setSelectedPeriod('custom')}
                      className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedPeriod === 'custom'
                          ? 'bg-[#111418] text-white dark:bg-white/20 dark:text-white'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08]'
                      }`}
                    >
                      <span>Período personalizado</span>
                      {selectedPeriod === 'custom' && <Check className="w-3.5 h-3.5 ml-1 shrink-0" />}
                    </button>

                    {selectedPeriod === 'custom' && (
                      <div className="mt-2.5 space-y-2 p-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/10 animate-in fade-in">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 block mb-1">
                              Data inicial
                            </label>
                            <input
                              type="date"
                              value={customStartDate}
                              onChange={(e) => setCustomStartDate(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 block mb-1">
                              Data final
                            </label>
                            <input
                              type="date"
                              value={customEndDate}
                              onChange={(e) => setCustomEndDate(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => setIsPeriodDropdownOpen(false)}
                            className="px-3 py-1 bg-[#111418] text-white dark:bg-white dark:text-slate-900 text-[11px] font-bold rounded-lg hover:opacity-90 transition-opacity"
                          >
                            Aplicar Período
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Campo de Busca por Indicador ou Lojista */}
            <div className="w-full sm:w-64">
              <Input
                icon={Search}
                placeholder="Buscar indicador ou lojista..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
            Nenhuma indicação encontrada para a busca "{searchQuery}" no período selecionado.
          </div>
        ) : (
          <Table headers={['Pessoa que Indicou', 'Lojista Indicado', 'Comissão / Peça', 'Peças Compradas', 'Comissão Acumulada', 'Status', 'Ações']}>
            {filteredList.map((ref) => (
              <TableRow 
                key={ref.id}
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => setDetailReferral(ref)}
              >
                <TableCell className="font-extrabold text-slate-900 dark:text-white">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#111418] text-white flex items-center justify-center text-xs font-black shrink-0">
                      {ref.referrer_name.charAt(0)}
                    </div>
                    <div>
                      <div>{ref.referrer_name}</div>
                      {ref.notes && <div className="text-[11px] text-slate-400 font-normal">{ref.notes}</div>}
                    </div>
                  </div>
                </TableCell>

                <TableCell className="font-semibold text-slate-800 dark:text-slate-200">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {ref.retailer_name}
                  </span>
                </TableCell>

                <TableCell className="font-bold text-slate-800 dark:text-slate-200">
                  {formatUSD(ref.currentRate)} <span className="text-xs font-normal text-slate-400">/ peça</span>
                </TableCell>

                <TableCell className="font-bold text-slate-600 dark:text-slate-300">
                  {ref.unitsCount} un.
                </TableCell>

                <TableCell className="font-black text-slate-900 dark:text-white text-base">
                  {formatUSD(ref.totalCommission)}
                </TableCell>

                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${
                    ref.status === 'Ativo'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                  }`}>
                    {ref.status}
                  </span>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetailReferral(ref)}
                      icon={FileText}
                      title="Ver compras e extrato do período"
                    >
                      Extrato
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleOpenEditModal(ref, e)}
                      icon={Edit3}
                      title="Editar indicação"
                    >
                      Editar
                    </Button>
                    <button
                      onClick={(e) => handleDelete(ref.id, ref.referrer_name, e)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Excluir indicação"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </Card>

      {/* Drawer de Detalhes da Indicação & Extrato de Compras Filtrado por Período */}
      {activeDetailData && (
        <Drawer
          isOpen={Boolean(activeDetailData)}
          onClose={() => setDetailReferral(null)}
          title={`Extrato: ${activeDetailData.referrer_name}`}
          subtitle={`Indicação do Lojista: ${activeDetailData.retailer_name}`}
          width="max-w-xl"
        >
          <div className="space-y-6">
            {/* Header Card do Extrato */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400">Pessoa que Indicou:</span>
                  <div className="text-lg font-black text-slate-900 dark:text-white">{activeDetailData.referrer_name}</div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Comissão Cadastrada:</span>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {formatUSD(activeDetailData.currentRate)}/peça
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">Lojista Vinculado:</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{activeDetailData.retailer_name}</div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400">Comissão no Período:</span>
                  <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                    {formatUSD(activeDetailData.totalCommission)}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/40 dark:border-slate-700/40 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Período do Extrato:
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700/50 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                  {activePeriodLabel}
                </span>
              </div>
            </div>

            {/* Lista das Vendas Válidas que Geraram Comissão no Período */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4" /> Vendas Concluídas no Período ({activeDetailData.salesBreakdown?.length || 0})
                </h4>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {activeDetailData.unitsCount} peças comissionadas
                </span>
              </div>

              {!activeDetailData.salesBreakdown || activeDetailData.salesBreakdown.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
                  Nenhuma compra finalizada registrada para este lojista no período <span className="font-semibold text-slate-600 dark:text-slate-300">"{activePeriodLabel}"</span>.
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <Table headers={['Venda / Pedido', 'Peças', 'Taxa Aplicada', 'Comissão Gerada', 'Data']}>
                    {activeDetailData.salesBreakdown.map((sale, idx) => (
                      <TableRow key={sale.order_id || idx}>
                        <TableCell className="font-bold text-slate-900 dark:text-white">
                          {sale.order_number}
                        </TableCell>
                        <TableCell className="font-bold text-slate-600 dark:text-slate-300">
                          {sale.units} un.
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          ${sale.rateApplied.toFixed(2)}/un
                        </TableCell>
                        <TableCell className="font-black text-emerald-600 dark:text-emerald-400">
                          {formatUSD(sale.orderCommission)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {formatDate(sale.finalized_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </Table>
                </div>
              )}
            </div>
          </div>
        </Drawer>
      )}

      {/* Modal de Cadastro / Edição de Indicação de Lojista */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingReferral ? 'Editar Indicação de Lojista' : 'Cadastrar Indicação de Lojista'}
        subtitle="Defina o indicador, selecione o lojista e a comissão fixa por aparelho comprado."
        size="md"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <Input
            label="Pessoa que Indicou (Indicador)"
            placeholder="Ex: Pedro, João Silva..."
            value={formData.referrer_name}
            onChange={(e) => setFormData({ ...formData, referrer_name: e.target.value })}
            required
          />

          <div>
            <Select
              label="Lojista Indicado"
              value={formData.retailer_id}
              onChange={(e) => setFormData({ ...formData, retailer_id: e.target.value })}
              options={
                editingReferral
                  ? [{ value: editingReferral.retailer_id, label: editingReferral.retailer_name }, ...availableRetailersForCreate.map(r => ({ value: r.id, label: r.store_name }))]
                  : availableRetailersForCreate.map(r => ({ value: r.id, label: `${r.store_name} (${r.city}/${r.state || 'BR'})` }))
              }
              required
            />
            {availableRetailersForCreate.length === 0 && !editingReferral && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                Todos os lojistas cadastrados já possuem uma indicação ativa.
              </p>
            )}
          </div>

          <CurrencyInput
            label="Comissão Fixa por Peça Comprada (USD)"
            value={formData.commission_per_unit_usd}
            onChange={(val) => setFormData({ ...formData, commission_per_unit_usd: val })}
            currency="USD"
          />

          <Input
            label="Observações / Termos"
            placeholder="Ex: Contrato de indicação comercial SP..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!formData.retailer_id}
            >
              {editingReferral ? 'Salvar Alterações' : 'Cadastrar Indicação'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CommissionsModule;
