import React, { useState } from 'react';
import { 
  BarChart3, 
  FileSpreadsheet, 
  Download, 
  TrendingUp, 
  PackageOpen, 
  Users, 
  Receipt, 
  Clock, 
  Filter,
  Layers
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Table, TableRow, TableCell } from '../ui/Table';
import { formatUSD, formatBRL, formatDate, formatImei, formatColor, formatBattery } from '../../lib/formatters';
import { exportDataToFile } from '../../lib/excelUtils';

export const ReportsModule = ({
  devices = [],
  orders = [],
  retailers = [],
  installments = [],
  grades = []
}) => {
  const [reportType, setReportType] = useState('sales'); // sales, stock, idleStock, financial, commissions

  // Dados de Vendas
  const completedOrders = orders.filter(o => o.status === 'Finalizado');

  // Estoque Parado (Aparelhos disponíveis há mais tempo)
  const availableDevices = devices.filter(d => d.status === 'Disponível');
  const idleStock = [...availableDevices].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // Exportador de cada tipo
  const handleExportCurrentReport = (format = 'xlsx') => {
    let data = [];
    let filename = `RiseMobile_Relatorio_${reportType}`;

    if (reportType === 'sales') {
      data = completedOrders.map(o => ({
        'Pedido': o.order_number,
        'Lojista': o.retailer_name,
        'Aparelhos': `${o.allocated_devices?.length || 0} un.`,
        'Faturamento (USD)': o.total_amount_usd,
        'Comissão (USD)': typeof o.total_commission_usd === 'number' ? o.total_commission_usd : 0,
        'Data': formatDate(o.finalized_at || o.created_at)
      }));
    } else if (reportType === 'stock' || reportType === 'idleStock') {
      data = (reportType === 'idleStock' ? idleStock : availableDevices).map(d => {
        const g = grades.find(item => item.id === d.grade_id);
        return {
          'Modelo': d.model,
          'Armazenamento': d.storage,
          'Grade': g?.name || 'A++',
          'Cor': d.color || '',
          'Bateria (%)': d.battery_health ?? '',
          'IMEI': d.imei || '',
          'Custo (USD)': d.cost_price_usd,
          'Preço Sugerido (USD)': d.suggested_price_usd,
          'Status': d.status,
          'Cadastrado em': d.created_at
        };
      });
    } else if (reportType === 'financial') {
      data = installments.map(i => ({
        'Pedido': i.order_number,
        'Lojista': i.retailer_name,
        'Parcela': i.installment_number,
        'Valor (USD)': i.amount_usd,
        'Vencimento': i.due_date,
        'Status': i.status
      }));
    } else if (reportType === 'commissions') {
      data = completedOrders.map(o => ({
        'Pedido': o.order_number,
        'Lojista': o.retailer_name,
        'Unidades': o.allocated_devices?.length || 0,
        'Comissão Total (USD)': o.total_commission_usd,
        'Data': o.finalized_at || o.created_at
      }));
    }

    exportDataToFile(data, `${filename}_${new Date().toISOString().split('T')[0]}`, format);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header & Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Relatórios & Central de Exportação</h2>
          <p className="text-xs text-slate-400">Geração de relatórios analíticos em Microsoft Excel (.xlsx) e CSV</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExportCurrentReport('csv')} icon={Download}>
            CSV
          </Button>
          <Button variant="primary" size="sm" onClick={() => handleExportCurrentReport('xlsx')} icon={FileSpreadsheet}>
            Exportar Excel (.xlsx)
          </Button>
        </div>
      </div>

      {/* Report Selector Pills */}
      <div className="flex items-center p-1 bg-white dark:bg-white/[0.05] dark:backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-full shadow-xs overflow-x-auto">
        {[
          { id: 'sales', label: 'Vendas & Faturamento', icon: TrendingUp },
          { id: 'stock', label: 'Estoque Consolidado', icon: PackageOpen },
          { id: 'idleStock', label: 'Estoque Parado (Giro Lento)', icon: Clock },
          { id: 'financial', label: 'Financeiro & Recebíveis', icon: Receipt },
          { id: 'commissions', label: 'Extrato de Comissões', icon: Users }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                reportType === tab.id
                  ? 'bg-[#111418] text-white dark:bg-white dark:text-slate-950 shadow-md'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Report View */}
      <Card className="p-6">
        {reportType === 'sales' && (
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Relatório de Vendas Concluídas</h3>
            <Table headers={['Pedido', 'Lojista', 'Aparelhos', 'Faturamento USD', 'Comissão USD', 'Data']}>
              {completedOrders.map(o => {
                const commissionVal = typeof o.total_commission_usd === 'number' ? o.total_commission_usd : 0;
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-extrabold text-slate-900 dark:text-white">{o.order_number}</TableCell>
                    <TableCell className="font-semibold">{o.retailer_name}</TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-300 font-medium">{o.allocated_devices?.length || 0} un.</TableCell>
                    <TableCell className="font-extrabold text-slate-900 dark:text-white">{formatUSD(o.total_amount_usd)}</TableCell>
                    <TableCell className="font-bold text-sky-600 dark:text-sky-400">
                      {commissionVal > 0 ? formatUSD(commissionVal) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">{formatDate(o.finalized_at || o.created_at)}</TableCell>
                  </TableRow>
                );
              })}
            </Table>
          </div>
        )}

        {reportType === 'idleStock' && (
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Aparelhos em Estoque Mais Antigos (Giro Lento)</h3>
            <Table headers={['Modelo', 'Capacidade', 'Cor', 'Bateria', 'IMEI', 'Custo USD', 'Dias em Estoque']}>
              {idleStock.slice(0, 10).map(d => {
                const daysInStock = Math.floor((new Date() - new Date(d.created_at)) / (1000 * 60 * 60 * 24));
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-extrabold">{d.model}</TableCell>
                    <TableCell>{d.storage}</TableCell>
                    <TableCell>{formatColor(d.color)}</TableCell>
                    <TableCell>{formatBattery(d.battery_health)}</TableCell>
                    <TableCell className="font-mono text-xs">{formatImei(d.imei)}</TableCell>
                    <TableCell className="font-semibold">{formatUSD(d.cost_price_usd)}</TableCell>
                    <TableCell>
                      <Badge variant="butter" size="sm">{daysInStock} dias</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </Table>
          </div>
        )}

        {reportType === 'financial' && (
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Relatório de Recebíveis & Vencimentos</h3>
            <Table headers={['Pedido', 'Lojista', 'Parcela', 'Valor USD', 'Vencimento', 'Status']}>
              {installments.map(i => (
                <TableRow key={i.id}>
                  <TableCell className="font-extrabold">{i.order_number}</TableCell>
                  <TableCell>{i.retailer_name}</TableCell>
                  <TableCell>#{i.installment_number}</TableCell>
                  <TableCell className="font-extrabold">{formatUSD(i.amount_usd)}</TableCell>
                  <TableCell>{formatDate(i.due_date)}</TableCell>
                  <TableCell>
                    <Badge size="sm">{i.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </div>
        )}

        {reportType === 'commissions' && (
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Relatório de Comissões por Venda</h3>
            <Table headers={['Pedido', 'Lojista', 'Unidades Negociadas', 'Comissão Devida USD', 'Data']}>
              {completedOrders.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-extrabold">{o.order_number}</TableCell>
                  <TableCell>{o.retailer_name}</TableCell>
                  <TableCell>{o.allocated_devices?.length || 0} un.</TableCell>
                  <TableCell className="font-extrabold text-sky-600">{formatUSD(o.total_commission_usd)}</TableCell>
                  <TableCell className="text-xs text-slate-400">{formatDate(o.finalized_at || o.created_at)}</TableCell>
                </TableRow>
              ))}
            </Table>
          </div>
        )}

        {reportType === 'stock' && (
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Inventário Geral Disponível</h3>
            <Table headers={['Modelo', 'Capacidade', 'Cor', 'Bateria', 'IMEI', 'Custo USD', 'Preço Sugerido USD']}>
              {availableDevices.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-extrabold">{d.model}</TableCell>
                  <TableCell>{d.storage}</TableCell>
                  <TableCell>{formatColor(d.color)}</TableCell>
                  <TableCell>{formatBattery(d.battery_health)}</TableCell>
                  <TableCell className="font-mono text-xs">{formatImei(d.imei)}</TableCell>
                  <TableCell className="font-semibold">{formatUSD(d.cost_price_usd)}</TableCell>
                  <TableCell className="font-extrabold text-emerald-600">{formatUSD(d.suggested_price_usd)}</TableCell>
                </TableRow>
              ))}
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
};
