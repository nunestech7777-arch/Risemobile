import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Award, 
  DollarSign, 
  ShoppingBag, 
  Building2, 
  Calendar, 
  LogOut, 
  Sun, 
  Moon, 
  Filter, 
  ChevronDown, 
  Check, 
  X, 
  RefreshCw,
  AlertCircle,
  FileText,
  User,
  ExternalLink
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Table, TableRow, TableCell } from '../ui/Table';
import { EmptyState } from '../ui/EmptyState';
import { RiseMobileLogo } from '../common/RiseMobileLogo';
import { ShaderBackground } from '../ui/adisyon-shader';
import { formatUSD, formatDate } from '../../lib/formatters';
import { DataService } from '../../lib/supabaseClient';

export const CommissionAgentPortal = ({
  user,
  exchangeRate = 5.20,
  theme = 'dark',
  onThemeChange,
  onLogout
}) => {
  const [portalData, setPortalData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Filtro de Período
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const periodDropdownRef = useRef(null);

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

  const PERIOD_OPTIONS = [
    { id: 'all', label: 'Todo o período' },
    { id: 'today', label: 'Hoje' },
    { id: 'yesterday', label: 'Ontem' },
    { id: 'this_week', label: 'Esta semana' },
    { id: 'this_month', label: 'Este mês' },
    { id: 'last_month', label: 'Mês anterior' },
    { id: 'last_7_days', label: 'Últimos 7 dias' },
    { id: 'last_30_days', label: 'Últimos 30 dias' },
    { id: 'this_year', label: 'Este ano' },
    { id: 'custom', label: 'Período personalizado' }
  ];

  const getLocalDateString = (d) => {
    if (!d || isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const periodRange = useMemo(() => {
    const now = new Date();
    let startDate = null;
    let endDate = null;

    if (selectedPeriod === 'today') {
      startDate = getLocalDateString(now);
      endDate = getLocalDateString(now);
    } else if (selectedPeriod === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = getLocalDateString(yesterday);
      endDate = getLocalDateString(yesterday);
    } else if (selectedPeriod === 'this_week') {
      const current = new Date(now);
      const day = current.getDay();
      const diff = current.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(current.setDate(diff));
      startDate = getLocalDateString(monday);
      endDate = getLocalDateString(now);
    } else if (selectedPeriod === 'this_month') {
      startDate = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
      endDate = getLocalDateString(now);
    } else if (selectedPeriod === 'last_month') {
      startDate = getLocalDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      endDate = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 0));
    } else if (selectedPeriod === 'last_7_days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      startDate = getLocalDateString(past);
      endDate = getLocalDateString(now);
    } else if (selectedPeriod === 'last_30_days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      startDate = getLocalDateString(past);
      endDate = getLocalDateString(now);
    } else if (selectedPeriod === 'this_year') {
      startDate = getLocalDateString(new Date(now.getFullYear(), 0, 1));
      endDate = getLocalDateString(now);
    } else if (selectedPeriod === 'custom') {
      startDate = customStartDate || null;
      endDate = customEndDate || null;
    }

    return { startDate, endDate };
  }, [selectedPeriod, customStartDate, customEndDate]);

  const activePeriodLabel = useMemo(() => {
    if (selectedPeriod === 'custom') {
      if (customStartDate && customEndDate) {
        return `${customStartDate.split('-').reverse().join('/')} — ${customEndDate.split('-').reverse().join('/')}`;
      }
      if (customStartDate) return `A partir de ${customStartDate.split('-').reverse().join('/')}`;
      if (customEndDate) return `Até ${customEndDate.split('-').reverse().join('/')}`;
      return 'Período personalizado';
    }
    const found = PERIOD_OPTIONS.find(p => p.id === selectedPeriod);
    return found ? found.label : 'Todo o período';
  }, [selectedPeriod, customStartDate, customEndDate]);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await DataService.getCommissionAgentPortalData(
        { 
          agentId: user?.user_metadata?.agent_id || user?.id,
          email: user?.email,
          userId: user?.id
        },
        periodRange
      );
      setPortalData(data);
    } catch (err) {
      console.error('Erro ao carregar dados do portal:', err);
      setErrorMessage(err.message || 'Não foi possível carregar as informações de comissão.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, periodRange]);

  const agentName = portalData?.agent?.name || user?.user_metadata?.name || 'Parceiro Comissionado';
  const totalCommissionBRL = (portalData?.total_commission_usd || 0) * (exchangeRate || 5.20);

  return (
    <div className="min-h-screen bg-[#EEF2F6] dark:bg-[#030407] dark-ambient-canvas transition-colors duration-200 text-slate-900 dark:text-slate-100 flex flex-col relative pb-12">
      {/* Dark Mode Ambient Canvas Layer */}
      <div className="hidden dark:block pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <ShaderBackground className="w-full h-full" />
      </div>

      {/* Top Header do Portal do Comissionado */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0D121D]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <RiseMobileLogo isExpanded={true} size="md" />
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-white/10">
            <Badge variant="neutral" className="bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40">
              Portal do Parceiro
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Theme Toggle */}
          <button
            onClick={() => onThemeChange?.(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
            title="Alternar tema"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/10 text-xs">
            <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-[10px]">
              {agentName.slice(0, 2).toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <p className="font-bold text-slate-800 dark:text-white leading-tight">{agentName}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-400">{user?.email}</p>
            </div>
          </div>

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            icon={LogOut}
            className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6 relative z-10">
        
        {/* Welcome & Filter Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#0D121D]/90 p-5 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Olá, {agentName.split(' ')[0]} 👋
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
              Acompanhe aqui suas comissões acumuladas e desempenho das lojas indicadas.
            </p>
          </div>

          {/* Period Filter Dropdown */}
          <div className="relative" ref={periodDropdownRef}>
            <button
              onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
              className="flex items-center justify-between gap-2.5 px-4 py-2 rounded-2xl bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200/70 dark:hover:bg-white/[0.12] border border-slate-200/80 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-slate-100 transition-all shadow-sm w-full sm:w-auto"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>{activePeriodLabel}</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isPeriodDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isPeriodDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/15 rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-fade-in text-xs">
                <div className="px-3 py-1.5 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                  Filtrar Período
                </div>
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSelectedPeriod(opt.id);
                      if (opt.id !== 'custom') setIsPeriodDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-medium transition-colors ${
                      selectedPeriod === opt.id 
                        ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold' 
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {selectedPeriod === opt.id && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
                  </button>
                ))}

                {selectedPeriod === 'custom' && (
                  <div className="pt-2 mt-2 border-t border-slate-100 dark:border-white/10 space-y-2 p-1">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">Data Início:</span>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">Data Fim:</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => setIsPeriodDropdownOpen(false)}
                    >
                      Aplicar Filtro
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} icon={RefreshCw}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Card 1: Total Comprado */}
          <Card className="p-6 bg-gradient-to-br from-[#EDE8F8] to-[#E5DCF8] dark:from-purple-950/40 dark:to-indigo-950/30 border-purple-200/70 dark:border-purple-500/20 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300">
                Peças Comissionadas
              </span>
              <div className="w-9 h-9 rounded-2xl bg-purple-200/80 dark:bg-purple-900/50 flex items-center justify-center text-purple-800 dark:text-purple-300 shadow-inner">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-black text-slate-950 dark:text-white tracking-tight">
                {isLoading ? '...' : (portalData?.total_units || 0)}
              </p>
              <p className="text-xs text-purple-900/80 dark:text-purple-300/80 mt-1 font-medium">
                aparelhos faturados no período
              </p>
            </div>
          </Card>

          {/* Card 2: Comissão Acumulada */}
          <Card className="p-6 bg-gradient-to-br from-[#FAF3D6] to-[#F5E8BA] dark:from-amber-950/40 dark:to-yellow-950/30 border-amber-200/70 dark:border-amber-500/20 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                Comissão Acumulada
              </span>
              <div className="w-9 h-9 rounded-2xl bg-amber-200/80 dark:bg-amber-900/50 flex items-center justify-center text-amber-800 dark:text-amber-300 shadow-inner">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-black text-slate-950 dark:text-white tracking-tight">
                {isLoading ? '...' : formatUSD(portalData?.total_commission_usd || 0)}
              </p>
              <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-1 font-medium">
                ≈ R$ {totalCommissionBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (câmbio R$ {exchangeRate.toFixed(2)})
              </p>
            </div>
          </Card>

          {/* Card 3: Lojistas Indicados */}
          <Card className="p-6 bg-gradient-to-br from-[#E2F5EA] to-[#D0EFE0] dark:from-emerald-950/40 dark:to-teal-950/30 border-emerald-200/70 dark:border-emerald-500/20 shadow-sm relative overflow-hidden flex flex-col justify-between sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                Lojistas Indicados
              </span>
              <div className="w-9 h-9 rounded-2xl bg-emerald-200/80 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shadow-inner">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-black text-slate-950 dark:text-white tracking-tight">
                {isLoading ? '...' : (portalData?.active_retailers_count || 0)}
              </p>
              <p className="text-xs text-emerald-900/80 dark:text-emerald-300/80 mt-1 font-medium">
                {portalData?.referrals?.length || 0} lojas cadastradas no total
              </p>
            </div>
          </Card>

        </div>

        {/* Lojistas Indicados (Cards no Mobile / Tabela no Desktop) */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Lojas Indicadas por Você
              </h2>
            </div>
            <Badge variant="neutral" size="sm">
              {portalData?.referrals?.length || 0} lojas
            </Badge>
          </div>

          {!portalData?.referrals || portalData.referrals.length === 0 ? (
            <EmptyState
              title="Nenhuma loja vinculada"
              description="Você ainda não possui lojas vinculadas à sua conta. Entre em contato com a administração para vincular suas indicações."
            />
          ) : (
            <div className="space-y-3">
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table headers={['Lojista Parceiro', 'Comissão / Peça', 'Peças Faturadas', 'Comissão Acumulada', 'Status']}>
                  {portalData.referrals.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-extrabold text-slate-900 dark:text-white">
                        <div>
                          <span>{r.retailer_name}</span>
                          {(r.retailer_city || r.retailer_state) && (
                            <p className="text-[11px] text-slate-400 font-normal">
                              {[r.retailer_city, r.retailer_state].filter(Boolean).join('/')}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-700 dark:text-slate-200">
                        {formatUSD(r.commission_per_unit_usd)} / un
                      </TableCell>
                      <TableCell className="font-extrabold text-purple-600 dark:text-purple-400">
                        {r.units_count} {r.units_count === 1 ? 'aparelho' : 'aparelhos'}
                      </TableCell>
                      <TableCell className="font-black text-slate-900 dark:text-white">
                        {formatUSD(r.accumulated_commission_usd)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.status === 'Ativo' ? 'success' : 'neutral'} size="sm">
                          {r.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </Table>
              </div>

              {/* Mobile Cards List */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {portalData.referrals.map((r) => (
                  <div 
                    key={r.id} 
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">{r.retailer_name}</h3>
                        {(r.retailer_city || r.retailer_state) && (
                          <p className="text-xs text-slate-400">
                            {[r.retailer_city, r.retailer_state].filter(Boolean).join('/')}
                          </p>
                        )}
                      </div>
                      <Badge variant={r.status === 'Ativo' ? 'success' : 'neutral'} size="sm">
                        {r.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-white/10 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Por Peça</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{formatUSD(r.commission_per_unit_usd)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Peças</span>
                        <span className="font-bold text-purple-600 dark:text-purple-400">{r.units_count}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Total</span>
                        <span className="font-black text-slate-900 dark:text-white">{formatUSD(r.accumulated_commission_usd)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Histórico / Extrato de Comissões por Venda */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Extrato de Comissões por Venda
              </h2>
            </div>
            <Badge variant="neutral" size="sm">
              {portalData?.orders_history?.length || 0} pedidos
            </Badge>
          </div>

          {!portalData?.orders_history || portalData.orders_history.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Nenhuma venda finalizada encontrada para as suas lojas indicadas no período selecionado.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table headers={['Data', 'Pedido', 'Lojista', 'Peças', 'Comissão / Un', 'Comissão Gerada', 'Status']}>
                  {portalData.orders_history.map((ord, idx) => (
                    <TableRow key={ord.order_id || idx}>
                      <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(ord.date)}
                      </TableCell>
                      <TableCell className="font-bold text-slate-900 dark:text-white">
                        {ord.order_number}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                        {ord.retailer_name}
                      </TableCell>
                      <TableCell className="font-bold text-purple-600 dark:text-purple-400">
                        {ord.units_count} un
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                        {formatUSD(ord.commission_rate_usd)}
                      </TableCell>
                      <TableCell className="font-black text-emerald-600 dark:text-emerald-400">
                        +{formatUSD(ord.commission_usd)}
                      </TableCell>
                      <TableCell>
                        <Badge size="sm" variant="success">
                          {ord.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </Table>
              </div>

              {/* Mobile List */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {portalData.orders_history.map((ord, idx) => (
                  <div
                    key={ord.order_id || idx}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">{ord.order_number}</span>
                      <span className="text-[11px] text-slate-400">{formatDate(ord.date)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span>{ord.retailer_name}</span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">{ord.units_count} aparelhos</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                      <span className="text-slate-400 text-[11px]">Comissão ({formatUSD(ord.commission_rate_usd)}/un)</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">+{formatUSD(ord.commission_usd)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

      </main>
    </div>
  );
};
