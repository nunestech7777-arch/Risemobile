import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Lock
} from 'lucide-react';
import { formatBRL } from '../../lib/formatters';
import { supabase } from '../../lib/supabaseClient';
import {
  MONTH_NAMES,
  MONTH_SHORT_NAMES,
  getSaoPauloDateParts,
  calculateMonthlySalesMetrics
} from '../../lib/salesMetrics';

export const SalesMetricCards = ({
  orders = [],
  exchangeRate = 5.48,
  ordersLoadError = '',
  user = null,
  onReloadData
}) => {
  const nowSp = useMemo(() => getSaoPauloDateParts(), []);

  // Mês e Ano selecionados para o filtro dos 3 cards (padrão: mês atual em SP)
  const [selectedYear, setSelectedYear] = useState(nowSp.year);
  const [selectedMonth, setSelectedMonth] = useState(nowSp.month);

  // Ano sendo navegado dentro do popover do mini calendário
  const [viewingYear, setViewingYear] = useState(nowSp.year);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef(null);

  // Fechar mini calendário ao clicar fora ou pressionar ESC
  useEffect(() => {
    if (!isCalendarOpen) return;

    const handleClickOutside = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setIsCalendarOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCalendarOpen]);

  // Atualização em tempo real via Supabase Realtime Channel
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('sales-metric-cards-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        if (typeof onReloadData === 'function') onReloadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_device_allocations' }, () => {
        if (typeof onReloadData === 'function') onReloadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_returns' }, () => {
        if (typeof onReloadData === 'function') onReloadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onReloadData]);

  // Verificação de permissões do usuário
  // Administradores veem todos os 3 cards. Vendedores sem autorização não veem custos/lucro.
  const isSeller = user?.user_metadata?.role === 'vendedor' || user?.user_metadata?.role === 'seller';
  const canViewProfit = !isSeller && (user?.user_metadata?.role === 'admin' || !user || user?.user_metadata?.can_view_profit !== false);

  // Cálculo das métricas das vendas concluídas do mês selecionado
  const metrics = useMemo(() => {
    if (ordersLoadError) {
      return { deviceCount: 0, totalRevenueBRL: 0, totalProfitBRL: 0, validSalesCount: 0 };
    }
    return calculateMonthlySalesMetrics(orders, selectedYear, selectedMonth, exchangeRate);
  }, [orders, selectedYear, selectedMonth, exchangeRate, ordersLoadError]);

  // Ações do Mini Calendário
  const handleSelectMonth = (monthIndex) => {
    setSelectedYear(viewingYear);
    setSelectedMonth(monthIndex + 1);
    setIsCalendarOpen(false);
  };

  const handleSelectCurrentMonth = () => {
    setSelectedYear(nowSp.year);
    setSelectedMonth(nowSp.month);
    setViewingYear(nowSp.year);
    setIsCalendarOpen(false);
  };

  const handleSelectPreviousMonth = () => {
    let prevYear = nowSp.year;
    let prevMonth = nowSp.month - 1;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }
    setSelectedYear(prevYear);
    setSelectedMonth(prevMonth);
    setViewingYear(prevYear);
    setIsCalendarOpen(false);
  };

  const isCurrentSelection = selectedYear === nowSp.year && selectedMonth === nowSp.month;
  const currentMonthLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;

  return (
    <div className="space-y-3">
      {/* Barra superior: Alinhada à direita com o seletor do Mini Calendário */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Indicadores Mensais
          </span>
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
            • {currentMonthLabel}
          </span>
        </div>

        {/* Mini Calendário Trigger & Popover */}
        <div className="relative self-end sm:self-auto" ref={calendarRef}>
          <button
            type="button"
            onClick={() => {
              setViewingYear(selectedYear);
              setIsCalendarOpen(!isCalendarOpen);
            }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all shadow-xs ${
              isCalendarOpen
                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300'
                : 'border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0B1220]/90 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]'
            }`}
            title="Filtrar os 3 cards por mês e ano"
          >
            <Calendar className="w-3.5 h-3.5 text-cyan-500" />
            <span>{currentMonthLabel}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCalendarOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Mini Calendário Compacto */}
          {isCalendarOpen && (
            <div className="absolute right-0 top-full mt-2 z-40 w-72 p-3.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0D1424] shadow-2xl backdrop-blur-xl animate-fade-in text-slate-900 dark:text-slate-100">
              {/* Atalhos Rápidos: Mês Atual e Mês Anterior */}
              <div className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-slate-100 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={handleSelectCurrentMonth}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold text-center transition-all ${
                    isCurrentSelection
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  Mês Atual
                </button>
                <button
                  type="button"
                  onClick={handleSelectPreviousMonth}
                  className="px-2 py-1.5 rounded-lg text-xs font-semibold text-center bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
                >
                  Mês Anterior
                </button>
              </div>

              {/* Seletor de Ano */}
              <div className="flex items-center justify-between mb-3 px-1">
                <button
                  type="button"
                  onClick={() => setViewingYear(v => v - 1)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300 transition-colors"
                  title="Ano anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {viewingYear}
                </span>
                <button
                  type="button"
                  onClick={() => setViewingYear(v => v + 1)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300 transition-colors"
                  title="Próximo ano"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Grade de 12 Meses */}
              <div className="grid grid-cols-4 gap-1.5">
                {MONTH_SHORT_NAMES.map((shortName, idx) => {
                  const mNum = idx + 1;
                  const isSelected = selectedYear === viewingYear && selectedMonth === mNum;
                  const isCurrentMonthOfToday = nowSp.year === viewingYear && nowSp.month === mNum;

                  return (
                    <button
                      key={shortName}
                      type="button"
                      onClick={() => handleSelectMonth(idx)}
                      className={`relative py-2 px-1 rounded-lg text-xs font-medium text-center transition-all ${
                        isSelected
                          ? 'bg-cyan-600 text-white font-bold shadow-xs'
                          : 'hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {shortName}
                      {isCurrentMonthOfToday && !isSelected && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-500" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Rodapé do Mini Calendário */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-between text-[11px] text-slate-400">
                <span>Fuso: America/Sao_Paulo</span>
                {!isCurrentSelection && (
                  <button
                    type="button"
                    onClick={handleSelectCurrentMonth}
                    className="flex items-center gap-1 font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Voltar ao atual
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3 CARDS SEPARADOS */}
      {/* Desktop: Lado a lado (grid-cols-3) | Mobile: Vertical (grid-cols-1) */}
      <div className={`grid grid-cols-1 ${canViewProfit ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
        {/* CARD 1 — APARELHOS VENDIDOS */}
        <div className="rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0B1220]/90 shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-white/20">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                APARELHOS VENDIDOS
              </span>
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3">
              {ordersLoadError ? (
                <div className="flex items-center gap-2 text-rose-500 text-sm font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Erro ao carregar</span>
                </div>
              ) : (
                <div className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  {metrics.deviceCount} {metrics.deviceCount === 1 ? 'aparelho' : 'aparelhos'}
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between">
            <span>Total de aparelhos no mês</span>
            {metrics.validSalesCount > 0 && !ordersLoadError && (
              <span className="text-[11px] text-slate-400">
                {metrics.validSalesCount} {metrics.validSalesCount === 1 ? 'pedido' : 'pedidos'}
              </span>
            )}
          </div>
        </div>

        {/* CARD 2 — FATURAMENTO TOTAL */}
        <div className="rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0B1220]/90 shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-white/20">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                FATURAMENTO TOTAL
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3">
              {ordersLoadError ? (
                <div className="flex items-center gap-2 text-rose-500 text-sm font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Erro ao carregar</span>
                </div>
              ) : (
                <div className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  {formatBRL(metrics.totalRevenueBRL)}
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
            Faturamento bruto das vendas válidas
          </div>
        </div>

        {/* CARD 3 — LUCRO TOTAL (Visualizado apenas por administradores / autorizados) */}
        {canViewProfit && (
          <div className="rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0B1220]/90 shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  LUCRO TOTAL
                </span>
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-3">
                {ordersLoadError ? (
                  <div className="flex items-center gap-2 text-rose-500 text-sm font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Erro ao carregar</span>
                  </div>
                ) : (
                  <div className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                    {formatBRL(metrics.totalProfitBRL)}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
              Lucro bruto dos produtos vendidos
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
