import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Download, 
  Calendar, 
  Users,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  PackageCheck,
  Layers,
  BarChart3,
  LineChart,
  Clock,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Table, TableRow, TableCell } from '../ui/Table';
import { formatUSD, formatDate } from '../../lib/formatters';
import { exportDataToFile } from '../../lib/excelUtils';

export const ProfitModule = ({
  orders = [],
  devices = [],
  retailerReferrals = []
}) => {
  // Filtro de Período selecionado
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');
  const [specificDate, setSpecificDate] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [chartViewMode, setChartViewMode] = useState('daily'); // 'daily' | 'cumulative'
  const [activeAnalysisTab, setActiveAnalysisTab] = useState('models'); // 'models' | 'retailers' | 'orders'

  // Vendas concluídas (Finalizado, Parcialmente ou Totalmente Devolvida)
  const finalizedOrders = useMemo(() => {
    return orders.filter(o => o.status === 'Finalizado' || o.status === 'Parcialmente Devolvida' || o.status === 'Totalmente Devolvida');
  }, [orders]);

  // Faturamento líquido de uma venda (bruto histórico menos o que foi devolvido)
  const getNetRevenue = (order) => (parseFloat(order.total_amount_usd) || 0) - (parseFloat(order.returned_amount_usd) || 0);

  // Função auxiliar para normalização de data local (YYYY-MM-DD)
  const getLocalDateString = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Filtragem estrita pelo período selecionado
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = getLocalDateString(today);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    return finalizedOrders.filter(order => {
      const orderDate = new Date(order.finalized_at || order.created_at);
      const orderDateStr = getLocalDateString(orderDate);

      // 1. Data Específica
      if (selectedPeriod === 'specific_date') {
        if (!specificDate) return true;
        return orderDateStr === specificDate;
      }

      // 2. Período Personalizado
      if (selectedPeriod === 'custom') {
        if (customStartDate && orderDateStr < customStartDate) return false;
        if (customEndDate && orderDateStr > customEndDate) return false;
        return true;
      }

      // 3. Filtros Rápidos
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

        case 'last_3_months': {
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          return orderDate >= threeMonthsAgo;
        }

        case 'last_6_months': {
          const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          return orderDate >= sixMonthsAgo;
        }

        case 'this_year': {
          const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
          return orderDate >= firstDayOfYear;
        }

        case 'all':
        default:
          return true;
      }
    });
  }, [finalizedOrders, selectedPeriod, specificDate, customStartDate, customEndDate]);

  // ==========================================
  // CÁLCULOS PRINCIPAIS DE FATURAMENTO
  // ==========================================

  // CARD 1: Faturamento do Período
  const periodRevenueUSD = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + getNetRevenue(o), 0);
  }, [filteredOrders]);

  const periodUnitsSold = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.allocated_devices?.length || 0), 0);
  }, [filteredOrders]);

  const periodOrdersCount = filteredOrders.length;

  // CARD 2: Faturamento de Hoje vs Ontem
  const { todayRevenueUSD, yesterdayRevenueUSD, todayUnitsSold } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = getLocalDateString(today);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    let tRev = 0;
    let tUnits = 0;
    let yRev = 0;

    finalizedOrders.forEach(order => {
      const d = new Date(order.finalized_at || order.created_at);
      const dStr = getLocalDateString(d);
      const val = getNetRevenue(order);
      const units = order.allocated_devices?.length || 0;

      if (dStr === todayStr) {
        tRev += val;
        tUnits += units;
      } else if (dStr === yesterdayStr) {
        yRev += val;
      }
    });

    return {
      todayRevenueUSD: tRev,
      yesterdayRevenueUSD: yRev,
      todayUnitsSold: tUnits
    };
  }, [finalizedOrders]);

  const todayDiffPercent = useMemo(() => {
    if (yesterdayRevenueUSD <= 0) return null;
    return ((todayRevenueUSD - yesterdayRevenueUSD) / yesterdayRevenueUSD) * 100;
  }, [todayRevenueUSD, yesterdayRevenueUSD]);

  // CARD 3: Previsão de Faturamento até o Fim do Mês (Projeção Linear por Ritmo Médio Diário)
  const monthlyProjection = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate(); // Dia atual (ex: 12)
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate(); // Ex: 30

    // Vendas deste mês
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const thisMonthOrders = finalizedOrders.filter(o => {
      const d = new Date(o.finalized_at || o.created_at);
      return d >= startOfMonth;
    });

    const monthRevenueSoFar = thisMonthOrders.reduce((sum, o) => sum + getNetRevenue(o), 0);
    const dailyPace = currentDay > 0 ? monthRevenueSoFar / currentDay : 0;
    const projectedTotalUSD = Math.round(dailyPace * totalDaysInMonth);

    return {
      monthRevenueSoFar,
      dailyPace,
      projectedTotalUSD,
      daysElapsed: currentDay,
      totalDays: totalDaysInMonth,
      remainingDays: totalDaysInMonth - currentDay
    };
  }, [finalizedOrders]);

  // CARD 4: Potencial de Faturamento do Estoque Disponível
  const stockPotential = useMemo(() => {
    // Somente unidades elegíveis para venda com status "Disponível"
    const availableDevices = devices.filter(d => d.status === 'Disponível');

    const totalPotentialUSD = availableDevices.reduce((sum, dev) => {
      const salePrice = parseFloat(dev.suggested_price_usd) || 0;
      return sum + salePrice;
    }, 0);

    return {
      totalPotentialUSD,
      availableUnitsCount: availableDevices.length
    };
  }, [devices]);

  // ==========================================
  // GRÁFICO DE FATURAMENTO AO LONGO DO TEMPO
  // ==========================================
  const chartData = useMemo(() => {
    // Agrupamento diário das ordens filtradas
    const daysMap = new Map();

    // Ordena ordens cronologicamente
    const sortedOrders = [...filteredOrders].sort((a, b) => {
      const da = new Date(a.finalized_at || a.created_at);
      const db = new Date(b.finalized_at || b.created_at);
      return da - db;
    });

    sortedOrders.forEach(order => {
      const d = new Date(order.finalized_at || order.created_at);
      const key = getLocalDateString(d);
      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const val = getNetRevenue(order);
      const units = order.allocated_devices?.length || 0;

      if (!daysMap.has(key)) {
        daysMap.set(key, { key, label, revenue: 0, units: 0, count: 0 });
      }
      const entry = daysMap.get(key);
      entry.revenue += val;
      entry.units += units;
      entry.count += 1;
    });

    const entries = Array.from(daysMap.values()).sort((a, b) => a.key.localeCompare(b.key));

    // Calcula acumulado
    let runningTotal = 0;
    return entries.map(item => {
      runningTotal += item.revenue;
      return {
        ...item,
        cumulativeRevenue: runningTotal
      };
    });
  }, [filteredOrders]);

  const maxChartRevenue = useMemo(() => {
    if (chartData.length === 0) return 1;
    if (chartViewMode === 'cumulative') {
      return Math.max(...chartData.map(d => d.cumulativeRevenue), 1);
    }
    return Math.max(...chartData.map(d => d.revenue), 1);
  }, [chartData, chartViewMode]);

  // Geometria da curva suave SVG (idêntica ao estilo do Dashboard)
  const svgChartGeometry = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return {
        pathArea: 'M 0 100 Q 80 85 150 70 T 300 45 T 420 20 T 500 10 L 500 120 L 0 120 Z',
        pathLine: 'M 0 100 Q 80 85 150 70 T 300 45 T 420 20 T 500 10',
        highlight: { x: 420, y: 20 },
        points: []
      };
    }

    const n = chartData.length;
    const values = chartData.map(d => chartViewMode === 'cumulative' ? d.cumulativeRevenue : d.revenue);
    const maxVal = Math.max(...values, 1);
    const minVal = Math.min(...values, 0);
    const range = maxVal - minVal || 1;

    // Mapeia cada ponto nos eixos (x: 0 a 500, y: 100 a 15)
    const pts = chartData.map((d, i) => {
      const x = n === 1 ? 250 : Math.round((i / (n - 1)) * 500);
      const val = chartViewMode === 'cumulative' ? d.cumulativeRevenue : d.revenue;
      const normalized = (val - minVal) / range;
      const y = Math.round(100 - normalized * 80);
      return { x, y, val, label: d.label };
    });

    if (pts.length === 1) {
      return {
        pathArea: `M 0,${pts[0].y} L 500,${pts[0].y} L 500,120 L 0,120 Z`,
        pathLine: `M 0,${pts[0].y} L 500,${pts[0].y}`,
        highlight: { x: 420, y: pts[0].y },
        points: pts
      };
    }

    // Spline cúbica suave
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? i : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 5;
      const cp1y = p1.y + (p2.y - p0.y) / 5;
      const cp2x = p2.x - (p3.x - p1.x) / 5;
      const cp2y = p2.y - (p3.y - p1.y) / 5;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const last = pts[pts.length - 1];
    const area = `${d} L ${last.x} 120 L ${pts[0].x} 120 Z`;

    return {
      pathArea: area,
      pathLine: d,
      highlight: { x: Math.min(460, Math.max(40, last.x)), y: last.y },
      points: pts
    };
  }, [chartData, chartViewMode]);

  // ==========================================
  // FATURAMENTO POR MODELO / PRODUTO
  // ==========================================
  const revenueByModel = useMemo(() => {
    const map = new Map();

    filteredOrders.forEach(order => {
      const orderUnits = order.allocated_devices?.length || 1;
      const avgRevenuePerUnit = getNetRevenue(order) / orderUnits;

      (order.allocated_devices || []).forEach(dev => {
        const key = `${dev.model} ${dev.storage}`;
        if (!map.has(key)) {
          map.set(key, {
            key,
            model: dev.model,
            storage: dev.storage,
            unitsSold: 0,
            revenueUSD: 0
          });
        }
        const entry = map.get(key);
        entry.unitsSold += 1;
        entry.revenueUSD += avgRevenuePerUnit;
      });
    });

    return Array.from(map.values()).sort((a, b) => b.revenueUSD - a.revenueUSD);
  }, [filteredOrders]);

  // ==========================================
  // FATURAMENTO POR LOJISTA
  // ==========================================
  const revenueByRetailer = useMemo(() => {
    const map = new Map();

    filteredOrders.forEach(order => {
      const rName = order.retailer_name || 'Lojista Não Identificado';
      const rId = order.retailer_id || rName;
      const val = getNetRevenue(order);
      const units = order.allocated_devices?.length || 0;

      if (!map.has(rId)) {
        map.set(rId, {
          id: rId,
          name: rName,
          ordersCount: 0,
          unitsSold: 0,
          revenueUSD: 0
        });
      }
      const entry = map.get(rId);
      entry.ordersCount += 1;
      entry.unitsSold += units;
      entry.revenueUSD += val;
    });

    return Array.from(map.values()).sort((a, b) => b.revenueUSD - a.revenueUSD);
  }, [filteredOrders]);

  // ==========================================
  // EXPORTAÇÃO EXCEL / CSV (100% FATURAMENTO)
  // ==========================================
  const handleExportRevenue = () => {
    const data = filteredOrders.map(o => {
      const val = getNetRevenue(o);
      const paid = parseFloat(o.paid_amount_usd) || 0;

      return {
        'Nº Pedido': o.order_number,
        'Lojista': o.retailer_name,
        'Qtd Peças': o.allocated_devices?.length || 0,
        'Faturamento Bruto (USD)': parseFloat(o.total_amount_usd) || 0,
        'Devolvido (USD)': parseFloat(o.returned_amount_usd) || 0,
        'Faturamento Líquido (USD)': val,
        'Valor Recebido (USD)': paid,
        'Saldo a Receber (USD)': parseFloat(o.balance_due_usd) || 0,
        'Status': o.status,
        'Data Finalização': formatDate(o.finalized_at || o.created_at, true)
      };
    });

    exportDataToFile(
      data, 
      `RiseMobile_Faturamento_${selectedPeriod}_${new Date().toISOString().split('T')[0]}`, 
      'xlsx'
    );
  };

  // Lista oficial de filtros rápidos
  const periodOptions = [
    { id: 'today', label: 'Hoje' },
    { id: 'yesterday', label: 'Ontem' },
    { id: 'this_week', label: 'Esta semana' },
    { id: 'this_month', label: 'Este mês' },
    { id: 'last_month', label: 'Mês anterior' },
    { id: 'last_7_days', label: 'Últimos 7 dias' },
    { id: 'last_20_days', label: 'Últimos 20 dias' },
    { id: 'last_30_days', label: 'Últimos 30 dias' },
    { id: 'last_3_months', label: 'Últimos 3 meses' },
    { id: 'last_6_months', label: 'Últimos 6 meses' },
    { id: 'this_year', label: 'Este ano' },
    { id: 'all', label: 'Todos' },
    { id: 'specific_date', label: 'Data Específica' },
    { id: 'custom', label: 'Personalizado' }
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header do Módulo */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <TrendingUp className="w-6 h-6 text-slate-800 dark:text-slate-200" />
            Faturamento
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
            Acompanhe o faturamento realizado e o potencial de vendas da operação.
          </p>
        </div>

        {/* Botão de Exportação */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportRevenue} icon={Download}>
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Barra de Filtros de Período */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center p-1 bg-white dark:bg-white/[0.05] dark:backdrop-blur-md border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs overflow-x-auto max-w-full">
          {periodOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelectedPeriod(opt.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedPeriod === opt.id
                  ? 'bg-[#111418] text-white dark:bg-white/20 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Seleção de Data Específica */}
        {selectedPeriod === 'specific_date' && (
          <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.04] dark:backdrop-blur-sm border border-slate-200/80 dark:border-white/10 flex flex-wrap items-center gap-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-300" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Selecionar Dia:</span>
            </div>
            <input
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
              className="bg-slate-50 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-white/10 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-500/30"
            />
            {specificDate && (
              <span className="text-xs text-slate-500 dark:text-slate-300">
                Visualizando faturamento exclusivo do dia {specificDate.split('-').reverse().join('/')}
              </span>
            )}
          </div>
        )}

        {/* Seleção de Período Personalizado */}
        {selectedPeriod === 'custom' && (
          <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.04] dark:backdrop-blur-sm border border-slate-200/80 dark:border-white/10 flex flex-wrap items-center gap-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">De:</span>
            </div>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-slate-50 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-white/10 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-500/30"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Até:</span>
            </div>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-slate-50 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-white/10 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-500/30"
            />
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* 4 CARDS PRINCIPAIS NO PADRÃO DO DASHBOARD */}
      {/* ========================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1 — FATURAMENTO DO PERÍODO */}
        <Card variant="default" padding="p-5 sm:p-6" className="flex flex-col justify-between rounded-none shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/[0.08] flex items-center justify-center border border-slate-200/60 dark:border-white/10 text-slate-900 dark:text-cyan-300 shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Faturamento do Período</h4>
                <p className="text-xs text-slate-500 dark:text-slate-300 font-medium">{periodOrdersCount} {periodOrdersCount === 1 ? 'venda finalizada' : 'vendas finalizadas'}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {formatUSD(periodRevenueUSD)}
              </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                {periodUnitsSold} {periodUnitsSold === 1 ? 'peça vendida' : 'peças vendidas'}
              </div>
            </div>
          </div>
        </Card>

        {/* CARD 2 — FATURAMENTO DE HOJE */}
        <Card variant="default" padding="p-5 sm:p-6" className="flex flex-col justify-between rounded-none shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/[0.08] flex items-center justify-center border border-slate-200/60 dark:border-white/10 text-slate-900 dark:text-cyan-300 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Faturamento de Hoje</h4>
                <p className="text-xs text-slate-500 dark:text-slate-300 font-medium">{todayUnitsSold} peças hoje</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {formatUSD(todayRevenueUSD)}
              </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                Ontem: {formatUSD(yesterdayRevenueUSD)}
              </div>
            </div>

            {todayDiffPercent !== null && (
              <div className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-emerald-300 border border-slate-200 dark:border-white/10 whitespace-nowrap">
                {todayDiffPercent >= 0 ? `+${todayDiffPercent.toFixed(1)}%` : `${todayDiffPercent.toFixed(1)}%`}
              </div>
            )}
          </div>
        </Card>

        {/* CARD 3 — PREVISÃO ATÉ O FIM DO MÊS */}
        <Card variant="default" padding="p-5 sm:p-6" className="flex flex-col justify-between rounded-none shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/[0.08] flex items-center justify-center border border-slate-200/60 dark:border-white/10 text-slate-900 dark:text-purple-300 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Previsão até Fim do Mês</h4>
                <p className="text-xs text-slate-500 dark:text-slate-300 font-medium">Ritmo: {formatUSD(monthlyProjection.dailyPace)}/dia</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {formatUSD(monthlyProjection.projectedTotalUSD)}
              </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                {monthlyProjection.remainingDays} dias restantes
              </div>
            </div>
          </div>
        </Card>

        {/* CARD 4 — POTENCIAL DO ESTOQUE */}
        <Card variant="default" padding="p-5 sm:p-6" className="flex flex-col justify-between rounded-none shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/[0.08] flex items-center justify-center border border-slate-200/60 dark:border-white/10 text-slate-900 dark:text-emerald-300 shrink-0">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Potencial do Estoque</h4>
                <p className="text-xs text-slate-500 dark:text-slate-300 font-medium">Se vender todo estoque disponível</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {formatUSD(stockPotential.totalPotentialUSD)}
              </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                {stockPotential.availableUnitsCount} aparelhos elegíveis
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ========================================== */}
      {/* GRÁFICO: SVG SMOOTH LINE CHART (PADRÃO DASHBOARD) */}
      {/* ========================================== */}
      <Card variant="default" padding="p-6 sm:p-7" className="rounded-none relative overflow-hidden shadow-xs">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Faturamento ao Longo do Tempo
              </span>
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
                {formatUSD(periodRevenueUSD)}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-900 dark:text-emerald-400" />
                <span className="text-slate-900 dark:text-emerald-400">{periodOrdersCount} {periodOrdersCount === 1 ? 'venda finalizada' : 'vendas finalizadas'}</span>
                <span className="text-slate-500 dark:text-slate-300 font-normal">• {periodUnitsSold} peças comercializadas</span>
              </div>
            </div>

            {/* Seletor de Modo de Visualização (Diário vs Acumulado) */}
            <div className="flex items-center bg-slate-100 dark:bg-white/[0.08] border border-transparent dark:border-white/10 p-1 rounded-full text-[11px] font-semibold text-slate-600 dark:text-slate-300 self-start sm:self-auto">
              <button
                onClick={() => setChartViewMode('daily')}
                className={`px-3 py-1 rounded-full transition-all ${
                  chartViewMode === 'daily'
                    ? 'bg-white dark:bg-white/20 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Faturamento por Dia
              </button>
              <button
                onClick={() => setChartViewMode('cumulative')}
                className={`px-3 py-1 rounded-full transition-all ${
                  chartViewMode === 'cumulative'
                    ? 'bg-white dark:bg-white/20 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Faturamento Acumulado
              </button>
            </div>
          </div>
        </div>

        {/* SVG Smooth Line Chart */}
        <div className="mt-8 relative h-44 w-full flex flex-col justify-end">
          <div className="relative w-full h-36">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="revenueChartGradientMono" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0F172A" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#0F172A" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="revenueChartGradientCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Fill Area - Light */}
              <path
                d={svgChartGeometry.pathArea}
                fill="url(#revenueChartGradientMono)"
                className="block dark:hidden"
              />
              {/* Fill Area - Dark */}
              <path
                d={svgChartGeometry.pathArea}
                fill="url(#revenueChartGradientCyan)"
                className="hidden dark:block"
              />
              {/* Stroke Line - Light */}
              <path
                d={svgChartGeometry.pathLine}
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-slate-900 block dark:hidden"
              />
              {/* Stroke Line - Dark (Cyan glow) */}
              <path
                d={svgChartGeometry.pathLine}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="hidden dark:block drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]"
              />
              {/* Highlight Pin / Dot */}
              <circle
                cx={svgChartGeometry.highlight.x}
                cy={svgChartGeometry.highlight.y}
                r="5"
                className="fill-slate-900 stroke-white block dark:hidden"
                strokeWidth="2.5"
              />
              <circle
                cx={svgChartGeometry.highlight.x}
                cy={svgChartGeometry.highlight.y}
                r="5.5"
                className="fill-white stroke-cyan-400 hidden dark:block drop-shadow-[0_0_10px_rgba(56,189,248,0.9)]"
                strokeWidth="2.5"
              />
            </svg>

            {/* Float Tooltip Badge on Chart */}
            <div 
              className="absolute bg-[#111418] text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 border border-slate-700 pointer-events-none transition-all duration-300"
              style={{
                left: `${Math.min(85, Math.max(10, (svgChartGeometry.highlight.x / 500) * 100))}%`,
                top: `${Math.max(0, (svgChartGeometry.highlight.y / 120) * 100 - 30)}%`,
                transform: 'translateX(-50%)'
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-300"></span>
              <span>{formatUSD(periodRevenueUSD)}</span>
            </div>
          </div>

          {/* Timeline Labels */}
          {chartData.length > 0 && (
            <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 overflow-x-hidden">
              {chartData.slice(0, 10).map((d) => (
                <span key={d.key}>{d.label}</span>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* ========================================== */}
      {/* ABAS DE ANÁLISE DETALHADA (DARK GRADIENT CONTAINER) */}
      {/* ========================================== */}
      <div className="p-6 sm:p-7 rounded-none bg-gradient-to-b from-[#111010] to-[#1E2024] text-white border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow / geometry */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 border border-white/5 rounded-full pointer-events-none" />
        <div className="absolute right-20 -bottom-8 w-40 h-40 border border-white/5 rounded-full pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center p-1 bg-white/10 border border-white/10 rounded-2xl flex-wrap">
              <button
                onClick={() => setActiveAnalysisTab('models')}
                className={`px-4 py-2 rounded-xl text-xs transition-all ${
                  activeAnalysisTab === 'models'
                    ? 'bg-white text-slate-900 font-extrabold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/5 font-semibold'
                }`}
              >
                Faturamento por Modelo ({revenueByModel.length})
              </button>
              <button
                onClick={() => setActiveAnalysisTab('retailers')}
                className={`px-4 py-2 rounded-xl text-xs transition-all ${
                  activeAnalysisTab === 'retailers'
                    ? 'bg-white text-slate-900 font-extrabold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/5 font-semibold'
                }`}
              >
                Faturamento por Lojista ({revenueByRetailer.length})
              </button>
              <button
                onClick={() => setActiveAnalysisTab('orders')}
                className={`px-4 py-2 rounded-xl text-xs transition-all ${
                  activeAnalysisTab === 'orders'
                    ? 'bg-white text-slate-900 font-extrabold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/5 font-semibold'
                }`}
              >
                Vendas Finalizadas ({filteredOrders.length})
              </button>
            </div>
          </div>

          {/* 1. FATURAMENTO POR MODELO */}
          {activeAnalysisTab === 'models' && (
            <div>
              {revenueByModel.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 border border-white/10 rounded-2xl bg-white/5">
                  Nenhum modelo vendido no período selecionado.
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4 first:pl-2">Modelo & Armazenamento</th>
                        <th className="py-3 px-4">Peças Vendidas</th>
                        <th className="py-3 px-4">Faturamento Total (USD)</th>
                        <th className="py-3 px-4 last:pr-2">Participação no Período</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-slate-200">
                      {revenueByModel.map((item) => {
                        const sharePercent = periodRevenueUSD > 0 ? (item.revenueUSD / periodRevenueUSD) * 100 : 0;
                        return (
                          <tr key={item.key} className="hover:bg-white/[0.05] transition-colors">
                            <td className="py-3.5 px-4 first:pl-2 font-bold text-white tracking-wide">
                              {item.model} <span className="text-xs text-slate-400 font-normal">({item.storage})</span>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-300">
                              {item.unitsSold} {item.unitsSold === 1 ? 'peça' : 'peças'}
                            </td>
                            <td className="py-3.5 px-4 font-extrabold text-white">
                              {formatUSD(item.revenueUSD)}
                            </td>
                            <td className="py-3.5 px-4 last:pr-2">
                              <div className="flex items-center gap-3">
                                <div className="w-28 h-2 rounded-full bg-white/10 overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full" style={{ width: `${Math.min(100, sharePercent)}%` }} />
                                </div>
                                <span className="text-xs font-bold text-slate-300">
                                  {sharePercent.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 2. FATURAMENTO POR LOJISTA */}
          {activeAnalysisTab === 'retailers' && (
            <div>
              {revenueByRetailer.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 border border-white/10 rounded-2xl bg-white/5">
                  Nenhum lojista com compras finalizadas no período.
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4 first:pl-2">Lojista</th>
                        <th className="py-3 px-4">Vendas Finalizadas</th>
                        <th className="py-3 px-4">Peças Compradas</th>
                        <th className="py-3 px-4">Faturamento Total (USD)</th>
                        <th className="py-3 px-4 last:pr-2">Participação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-slate-200">
                      {revenueByRetailer.map((ret) => {
                        const sharePercent = periodRevenueUSD > 0 ? (ret.revenueUSD / periodRevenueUSD) * 100 : 0;
                        return (
                          <tr key={ret.id} className="hover:bg-white/[0.05] transition-colors">
                            <td className="py-3.5 px-4 first:pl-2 font-bold text-white tracking-wide">
                              {ret.name}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-400">
                              {ret.ordersCount} {ret.ordersCount === 1 ? 'pedido' : 'pedidos'}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-300">
                              {ret.unitsSold} {ret.unitsSold === 1 ? 'peça' : 'peças'}
                            </td>
                            <td className="py-3.5 px-4 font-extrabold text-white">
                              {formatUSD(ret.revenueUSD)}
                            </td>
                            <td className="py-3.5 px-4 last:pr-2">
                              <div className="flex items-center gap-3">
                                <div className="w-28 h-2 rounded-full bg-white/10 overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-sky-400 to-blue-400 rounded-full" style={{ width: `${Math.min(100, sharePercent)}%` }} />
                                </div>
                                <span className="text-xs font-bold text-slate-300">
                                  {sharePercent.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. VENDAS FINALIZADAS NO PERÍODO */}
          {activeAnalysisTab === 'orders' && (
            <div>
              {filteredOrders.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 border border-white/10 rounded-2xl bg-white/5">
                  Nenhuma venda finalizada no período.
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4 first:pl-2">Pedido</th>
                        <th className="py-3 px-4">Lojista</th>
                        <th className="py-3 px-4">Qtd / Peças</th>
                        <th className="py-3 px-4">Total USD</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 last:pr-2">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-slate-200">
                      {filteredOrders.map((o) => {
                        const val = getNetRevenue(o);

                        return (
                          <tr key={o.id} className="hover:bg-white/[0.05] transition-colors">
                            <td className="py-3.5 px-4 first:pl-2 font-bold text-white tracking-wide">
                              {o.order_number}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-white">{o.retailer_name}</div>
                            </td>
                            <td className="py-3.5 px-4 text-xs font-semibold text-slate-300">
                              {o.allocated_devices?.length || 0} unidades
                            </td>
                            <td className="py-3.5 px-4 font-extrabold text-white">
                              {formatUSD(val)}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-bold bg-white/15 text-white border border-white/20">
                                {o.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 last:pr-2 text-xs text-slate-400 whitespace-nowrap">
                              {formatDate(o.finalized_at || o.created_at, true)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
