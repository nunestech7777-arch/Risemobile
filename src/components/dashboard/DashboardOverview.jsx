import React, { useState } from 'react';
import {
  Plus,
  ChevronRight,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { MetricCard } from '../ui/MetricCard';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Table, TableRow, TableCell } from '../ui/Table';
import { formatUSD, formatBRL, formatDate, formatImei, getStatusBadge } from '../../lib/formatters';

export const DashboardOverview = ({ 
  devices = [], 
  orders = [], 
  retailers = [], 
  installments = [],
  onNavigate 
}) => {
  const [timeFilter, setTimeFilter] = useState('7D');

  // Cálculos de métricas do sistema
  const availableDevices = devices.filter(d => d.status === 'Disponível');
  const reservedDevices = devices.filter(d => d.status === 'Reservado');
  const soldDevices = devices.filter(d => d.status === 'Vendido');

  const totalStockValueUSD = availableDevices.reduce((sum, d) => sum + (d.cost_price_usd || 0), 0);
  const totalSuggestedValueUSD = availableDevices.reduce((sum, d) => sum + (d.suggested_price_usd || 0), 0);

  const completedOrders = orders.filter(o => o.status === 'Finalizado' || o.status === 'Parcialmente Devolvida' || o.status === 'Totalmente Devolvida');
  // total_amount_usd / total_commission_usd são o bruto histórico; subtrai o que foi devolvido
  // para refletir o faturamento e a comissão realmente efetivos (líquidos de devolução).
  const totalRevenueUSD = completedOrders.reduce((sum, o) => sum + ((o.total_amount_usd || 0) - (o.returned_amount_usd || 0)), 0);
  const totalProfitUSD = completedOrders.reduce((sum, o) => sum + (o.total_profit_usd || 0), 0);
  const totalCommissionsUSD = completedOrders.reduce((sum, o) => sum + ((o.total_commission_usd || 0) - (o.returned_commission_usd || 0)), 0);
  
  const totalReceivablesUSD = installments.filter(i => i.status !== 'Pago').reduce((sum, i) => sum + (i.amount_usd || 0), 0);
  const overdueInstallments = installments.filter(i => i.status === 'Vencido');
  const profitMarginPct = totalRevenueUSD > 0 ? (totalProfitUSD / totalRevenueUSD) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Row: Hero Portfolio Card (Left) & Pastel Asset Cards (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Main Portfolio Card with Line Chart (Pure White in Light, Glass in Dark) */}
        <Card variant="default" padding="p-6 sm:p-7" className="lg:col-span-6 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Faturamento & Vendas</span>
                <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
                  {formatUSD(totalRevenueUSD)}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span className="text-slate-500 dark:text-slate-300 font-normal">Lucro: {formatUSD(totalProfitUSD)}</span>
                </div>
              </div>

              {/* Seletor de Período em Português (24H, 7D, 30D, 1A, Tudo) */}
              <div className="flex items-center bg-slate-100 dark:bg-white/[0.08] p-1 rounded-full text-[11px] font-semibold text-slate-600 dark:text-slate-300 border border-transparent dark:border-white/10">
                {[
                  { id: '24H', label: '24H' },
                  { id: '7D', label: '7D' },
                  { id: '30D', label: '30D' },
                  { id: '1A', label: '1A' },
                  { id: 'ALL', label: 'Tudo' }
                ].map((tf) => (
                  <button
                    key={tf.id}
                    onClick={() => setTimeFilter(tf.id)}
                    className={`px-2.5 py-1 rounded-full transition-all ${
                      timeFilter === tf.id 
                        ? 'bg-white dark:bg-white/20 text-slate-900 dark:text-white shadow-xs font-bold' 
                        : 'hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SVG Smooth Line Chart with Ambient Cyan/Blue Glow in Dark Mode */}
          <div className="mt-8 relative h-36 w-full flex items-end">
            <svg viewBox="0 0 500 120" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="chartGradientMono" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0F172A" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#0F172A" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="chartGradientDark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Light Mode Area Fill */}
              <path
                d="M 0 100 Q 80 85 150 70 T 300 45 T 420 20 T 500 10 L 500 120 L 0 120 Z"
                fill="url(#chartGradientMono)"
                className="block dark:hidden"
              />
              {/* Dark Mode Area Fill */}
              <path
                d="M 0 100 Q 80 85 150 70 T 300 45 T 420 20 T 500 10 L 500 120 L 0 120 Z"
                fill="url(#chartGradientDark)"
                className="hidden dark:block"
              />

              {/* Stroke Line - Light Mode */}
              <path
                d="M 0 100 Q 80 85 150 70 T 300 45 T 420 20 T 500 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="text-slate-900 block dark:hidden"
              />
              {/* Stroke Line - Dark Mode (Silver/White Metallic Glow) */}
              <path
                d="M 0 100 Q 80 85 150 70 T 300 45 T 420 20 T 500 10"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="hidden dark:block drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]"
              />

              {/* Highlight Pin / Dot */}
              <circle cx="420" cy="20" r="5" className="fill-slate-900 stroke-white block dark:hidden" strokeWidth="2.5" />
              <circle cx="420" cy="20" r="5.5" className="fill-white stroke-slate-800 hidden dark:block drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]" strokeWidth="2.5" />
            </svg>

            {/* Float Tooltip Badge on Chart */}
            <div className="absolute right-12 top-2 bg-[#111418] dark:bg-[#0D121D]/90 dark:backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 border border-slate-700 dark:border-white/20 dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
              <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-200 animate-pulse"></span>
              <span>{formatUSD(totalRevenueUSD)}</span>
            </div>
          </div>
        </Card>

        {/* Right: Pure White Metric Cards Stack */}
        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Estoque Disponível */}
          <MetricCard
            variant="default"
            title="Estoque Disponível"
            subtitle={`${availableDevices.length} peças prontas`}
            value={`${availableDevices.length} un.`}
            secondaryValue={`Custo: ${formatUSD(totalStockValueUSD)}`}
            badgeText={`${reservedDevices.length} reservadas`}
            badgeType="neutral"
            onOptionsClick={() => onNavigate('stock')}
          />

          {/* Card 2: Lucro Real */}
          <MetricCard
            variant="default"
            title="Lucro Líquido"
            subtitle="Margem de atacado"
            value={formatUSD(totalProfitUSD)}
            secondaryValue={`Margem média: ${profitMarginPct.toFixed(1)}%`}
            badgeType="neutral"
            onOptionsClick={() => onNavigate('commissions')}
          />

          {/* Card 3: Contas a Receber */}
          <MetricCard
            variant="default"
            title="Contas a Receber"
            subtitle={`${installments.filter(i => i.status !== 'Pago').length} parcelas abertas`}
            value={formatUSD(totalReceivablesUSD)}
            secondaryValue={overdueInstallments.length > 0 ? `${overdueInstallments.length} em atraso` : 'Em dia'}
            badgeText={overdueInstallments.length > 0 ? 'Atenção' : 'Regular'}
            badgeType="neutral"
            onOptionsClick={() => onNavigate('payments')}
          />

          {/* Card 4: Comissões Lojistas */}
          <MetricCard
            variant="default"
            title="Comissões Devidas"
            subtitle="Por unidade negociada"
            value={formatUSD(totalCommissionsUSD)}
            secondaryValue={`${retailers.length} lojistas ativos`}
            badgeText="Configurada"
            badgeType="neutral"
            onOptionsClick={() => onNavigate('retailers')}
          />
        </div>
      </div>

      {/* Middle Row: Expanded Recent Orders & Reservations Section with Glass/Gradient Finish */}
      <div className="bg-gradient-to-br from-[#111010] via-[#1a1b1e] to-[#393D42] dark:from-[#101622]/80 dark:via-[#0D121D]/70 dark:to-[#080B11]/85 dark:backdrop-blur-xl border border-white/10 text-white rounded-2xl p-6 shadow-xl dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)] relative overflow-hidden">
        {/* Subtle background glow / geometry */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 border border-white/5 rounded-full pointer-events-none" />
        <div className="absolute right-20 -bottom-8 w-40 h-40 border border-white/5 rounded-full pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-white animate-pulse" />
                <h3 className="text-lg font-extrabold text-white tracking-tight">Vendas Recentes & Reservas</h3>
              </div>
              <p className="text-xs text-slate-300">Acompanhamento em tempo real do fluxo comercial e vendas por lojista</p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button 
                onClick={() => onNavigate('sales')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-[#111010] bg-white hover:bg-slate-100 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500 dark:shadow-[0_0_15px_rgba(37,99,235,0.4)] rounded-xl shadow-md transition-all"
              >
                <Plus className="w-4 h-4 text-[#111010] dark:text-white" />
                <span>Nova Venda</span>
              </button>
              <button 
                onClick={() => onNavigate('sales')}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 dark:hover:bg-white/[0.08] rounded-xl transition-all"
              >
                <span>Ver todas</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm border border-white/10 rounded-xl bg-white/5">
              Nenhum pedido recente registrado.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4 first:pl-2">Pedido</th>
                    <th className="py-3 px-4">Lojista</th>
                    <th className="py-3 px-4">Qtd / Modelos</th>
                    <th className="py-3 px-4">Total USD</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 last:pr-2">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-slate-200">
                  {orders.slice(0, 6).map((order) => {
                    const totalItems = order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || order.items?.length || 0;
                    const isFinalized = order.status === 'Finalizado';
                    const isPending = order.status === 'Pendente';
                    
                    const badgeClass = isFinalized 
                      ? 'bg-white/15 dark:bg-emerald-500/20 text-white dark:text-emerald-300 border-white/20 dark:border-emerald-500/30'
                      : isPending 
                        ? 'bg-amber-400/20 text-amber-200 border-amber-400/30'
                        : 'bg-white/10 text-slate-200 border-white/15';

                    return (
                      <tr 
                        key={order.id} 
                        onClick={() => onNavigate('sales')}
                        className="group hover:bg-white/[0.07] dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 first:pl-2 font-bold text-white tracking-wide">
                          {order.order_number}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white group-hover:text-slate-100">{order.retailer_name}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-xs font-medium text-slate-200">
                            {totalItems} {totalItems === 1 ? 'unidade' : 'unidades'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {order.items?.length || 0} {order.items?.length === 1 ? 'modelo' : 'modelos'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-white text-base">
                          {formatUSD(order.total_amount_usd)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-none text-xs font-semibold border ${badgeClass}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 last:pr-2 text-xs text-slate-400">
                          {formatDate(order.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Model Breakdown and Available Inventory Preview */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Distribuição do Estoque por Modelo</h3>
            <p className="text-xs text-slate-500 dark:text-slate-300">Visão consolidada em tempo real</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onNavigate('stock')}>
            Gerenciar Estoque Completo
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {['iPhone 13', 'iPhone 14', 'iPhone 14 Pro', 'iPhone 15 Pro', 'iPhone 15 Pro Max', 'iPhone 16 Pro'].map((model) => {
            const count = availableDevices.filter(d => d.model === model).length;
            return (
              <div 
                key={model} 
                className="p-4 rounded-none bg-slate-50 dark:bg-white/[0.04] dark:backdrop-blur-sm border border-slate-100 dark:border-white/10 flex flex-col justify-between cursor-pointer hover:border-slate-300 dark:hover:border-white/25 dark:hover:bg-white/[0.08] transition-all"
                onClick={() => onNavigate('stock')}
              >
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">{model}</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                  {count} <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">un.</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
