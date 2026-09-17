import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Tag,
  Clock,
  ArrowRight,
  Package,
  ShoppingBag,
  RotateCcw
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Table, TableRow, TableCell } from '../ui/Table';
import { formatDate, formatImei } from '../../lib/formatters';

export const AdjustmentsModule = ({
  devices = [],
  movements = [],
  onNavigate
}) => {
  const [filterType, setFilterType] = useState('all'); // all, Venda, Reserva, Entrada, Cancelamento
  const [searchQuery, setSearchQuery] = useState('');

  // Map devices by id and imei for enriched lookup
  const devicesMap = useMemo(() => {
    const map = new Map();
    devices.forEach(d => {
      if (d.id) map.set(d.id, d);
      if (d.imei) map.set(d.imei, d);
    });
    return map;
  }, [devices]);

  // Filtered movements list
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      // Type filter
      if (filterType !== 'all' && m.movement_type !== filterType) {
        return false;
      }
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const dev = devicesMap.get(m.device_id) || devicesMap.get(m.imei);
        const modelStr = dev ? `${dev.model} ${dev.storage} ${dev.color}`.toLowerCase() : '';
        const imeiStr = (m.imei || '').toLowerCase();
        const reasonStr = (m.reason || m.notes || '').toLowerCase();
        const typeStr = (m.movement_type || '').toLowerCase();

        return imeiStr.includes(q) || reasonStr.includes(q) || typeStr.includes(q) || modelStr.includes(q);
      }
      return true;
    });
  }, [movements, filterType, searchQuery, devicesMap]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: movements.length,
      entradas: movements.filter(m => m.movement_type === 'Entrada').length,
      reservas: movements.filter(m => m.movement_type === 'Reserva').length,
      vendas: movements.filter(m => m.movement_type === 'Venda').length,
      cancelamentos: movements.filter(m => m.movement_type === 'Cancelamento').length
    };
  }, [movements]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            Histórico de Movimentações
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            Trilha perpétua de auditoria e rastreabilidade de entradas externas, reservas e vendas
          </p>
        </div>

        {/* Metric Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#141923] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Total: <strong className="text-slate-900 dark:text-white">{stats.total}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            Entradas: <strong>{stats.entradas}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-xs font-semibold text-amber-700 dark:text-amber-300">
            Reservas: <strong>{stats.reservas}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-xs font-semibold text-blue-700 dark:text-blue-300">
            Vendas: <strong>{stats.vendas}</strong>
          </span>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center p-1 bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-full shadow-xs overflow-x-auto">
          {[
            { id: 'all', label: `Todos (${movements.length})` },
            { id: 'Entrada', label: `Entradas (${stats.entradas})` },
            { id: 'Reserva', label: `Reservas (${stats.reservas})` },
            { id: 'Venda', label: `Vendas (${stats.vendas})` },
            { id: 'Cancelamento', label: `Cancelamentos (${stats.cancelamentos})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                filterType === tab.id
                  ? 'bg-[#111418] text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Input
          placeholder="Buscar por IMEI, modelo ou detalhes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-72"
        />
      </div>

      {/* Table of Movements */}
      <Card className="p-4 sm:p-6">
        {filteredMovements.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-300">
            Nenhuma movimentação encontrada para os filtros selecionados.
          </div>
        ) : (
          <Table headers={['Tipo de Movimento', 'Aparelho / IMEI', 'Transição de Status', 'Detalhes / Justificativa', 'Data & Hora']}>
            {filteredMovements.map((m) => {
              const dev = devicesMap.get(m.device_id) || devicesMap.get(m.imei);
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                      m.movement_type === 'Venda' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' :
                      m.movement_type === 'Reserva' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' :
                      m.movement_type === 'Entrada' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                      m.movement_type === 'Cancelamento' ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' :
                      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {m.movement_type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div>
                      {dev && (
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {dev.model} {dev.storage} <span className="text-slate-500 dark:text-slate-300 font-normal">({dev.color})</span>
                        </div>
                      )}
                      <div className="font-mono text-xs text-slate-500 dark:text-slate-300">
                        {formatImei(m.imei)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {m.previous_status ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-slate-500 dark:text-slate-300">{m.previous_status}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-300" />
                        <span className="font-bold text-slate-800 dark:text-slate-200">{m.new_status}</span>
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{m.new_status}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 dark:text-slate-300 max-w-sm">
                    {m.reason || m.notes || '—'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                    {formatDate(m.created_at, true)}
                  </TableCell>
                </TableRow>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
};
