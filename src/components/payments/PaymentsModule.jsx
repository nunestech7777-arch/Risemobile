import React, { useState, useMemo } from 'react';
import {
  CheckCircle2
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Table, TableRow, TableCell } from '../ui/Table';
import { formatUSD, formatBRL, formatDate, getStatusBadge } from '../../lib/formatters';

export const PaymentsModule = ({
  installments = [],
  exchangeRate = 5.48,
  onPayInstallment
}) => {
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, Vencido, Vence hoje, A vencer, Pago
  const [searchQuery, setSearchQuery] = useState('');

  // Totais de Contas a Receber
  const totalReceivablesUSD = installments.filter(i => i.status !== 'Pago').reduce((sum, i) => sum + (i.amount_usd || 0), 0);
  const totalOverdueUSD = installments.filter(i => i.status === 'Vencido').reduce((sum, i) => sum + (i.amount_usd || 0), 0);
  const totalPaidUSD = installments.filter(i => i.status === 'Pago').reduce((sum, i) => sum + (i.amount_usd || 0), 0);

  // Filtro de Parcelas
  const filteredInstallments = useMemo(() => {
    return installments.filter(i => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || (i.order_number && i.order_number.toLowerCase().includes(q)) || (i.retailer_name && i.retailer_name.toLowerCase().includes(q));
      const matchStatus = statusFilter === 'ALL' || i.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [installments, searchQuery, statusFilter]);

  // Registrar Baixa de Parcela
  const handlePayInstallmentClick = async (inst) => {
    if (window.confirm(`Confirmar recebimento da Parcela #${inst.installment_number} no valor de ${formatUSD(inst.amount_usd)}?`)) {
      try {
        await onPayInstallment(inst.id, { method: 'PIX' });
        alert('Parcela baixada com sucesso!');
      } catch (err) {
        alert(`Erro ao baixar parcela: ${err.message}`);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Contas a Receber
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            Saldos em aberto, parcelas e baixas de recebimento de vendas já finalizadas
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-200">
          <span>Cotação Base: 1 USD = <strong className="text-slate-900 dark:text-white">{formatBRL(exchangeRate)}</strong></span>
        </div>
      </div>

      {/* Top Stat Cards — High-Contrast Frosted Surfaces */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0B1220]/85 dark:backdrop-blur-xl border border-slate-200 dark:border-white/12 text-slate-900 dark:text-white flex flex-col justify-between shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Saldo Total a Receber</span>
          <div className="text-2xl sm:text-3xl font-extrabold mt-2 text-slate-900 dark:text-white">{formatUSD(totalReceivablesUSD)}</div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">Equivalente a {formatBRL(totalReceivablesUSD * exchangeRate)}</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#1A0C14]/85 dark:backdrop-blur-xl border border-rose-200 dark:border-rose-500/30 text-rose-900 dark:text-rose-200 flex flex-col justify-between shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-300">Parcelas Vencidas (Em Atraso)</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-2">{formatUSD(totalOverdueUSD)}</div>
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-300 mt-1">{installments.filter(i => i.status === 'Vencido').length} parcelas expiradas</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#081812]/85 dark:backdrop-blur-xl border border-emerald-200 dark:border-emerald-500/30 text-slate-900 dark:text-emerald-200 flex flex-col justify-between shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Total Já Liquidado</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">{formatUSD(totalPaidUSD)}</div>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mt-1">{installments.filter(i => i.status === 'Pago').length} parcelas pagas</span>
        </div>
      </div>

      {/* Filter Bar & Table */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-100 dark:bg-white/[0.06] rounded-full border border-transparent dark:border-white/10">
            {['ALL', 'Vencido', 'Vence hoje', 'A vencer', 'Pago'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                {st === 'ALL' ? 'Todas as Parcelas' : st}
              </button>
            ))}
          </div>

          <Input
            placeholder="Buscar por pedido ou lojista..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64"
          />
        </div>

        {filteredInstallments.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Nenhuma parcela encontrada para o filtro selecionado.
          </div>
        ) : (
          <Table headers={['Pedido', 'Lojista', 'Parcela', 'Vencimento', 'Valor USD', 'Valor BRL', 'Status', 'Ações']}>
            {filteredInstallments.map((inst) => {
              const statusStyle = getStatusBadge(inst.status);
              return (
                <TableRow key={inst.id}>
                  <TableCell className="font-extrabold text-slate-900 dark:text-white">
                    {inst.order_number}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-800 dark:text-slate-200">
                    {inst.retailer_name}
                  </TableCell>
                  <TableCell className="font-bold text-xs text-slate-500">
                    #{inst.installment_number}
                  </TableCell>
                  <TableCell className="text-xs font-semibold">
                    {formatDate(inst.due_date)}
                  </TableCell>
                  <TableCell className="font-extrabold text-slate-900 dark:text-white">
                    {formatUSD(inst.amount_usd)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {formatBRL(inst.amount_usd * exchangeRate)}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusStyle.bg}`}>
                      {inst.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {inst.status !== 'Pago' ? (
                      <Button
                        variant="pastelMint"
                        size="sm"
                        onClick={() => handlePayInstallmentClick(inst)}
                        icon={CheckCircle2}
                      >
                        Dar Baixa
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Liquidado
                      </span>
                    )}
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
