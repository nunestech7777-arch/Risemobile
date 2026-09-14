import React, { useState, useMemo } from 'react';
import { 
  Receipt, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Plus, 
  Trash2, 
  ArrowRight,
  TrendingUp,
  CreditCard,
  QrCode,
  Sparkles
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, Select, CurrencyInput } from '../ui/Input';
import { Table, TableRow, TableCell } from '../ui/Table';
import { Modal } from '../ui/Modal';
import { formatUSD, formatBRL, formatDate, getStatusBadge } from '../../lib/formatters';

export const PaymentsModule = ({
  orders = [],
  installments = [],
  exchangeRate = 5.48,
  selectedOrderIdFromNav = null,
  onFinalizeSale,
  onPayInstallment,
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState('receivables'); // receivables, finalizeSale
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, Vencido, Vence hoje, A vencer, Pago
  const [searchQuery, setSearchQuery] = useState('');

  // Pedidos que podem ser finalizados (Reservados ou Em Separação)
  const pendingFinalizeOrders = orders.filter(o => o.status === 'Reservado' || o.status === 'Em Separação');
  const [orderToFinalizeId, setOrderToFinalizeId] = useState(selectedOrderIdFromNav || pendingFinalizeOrders[0]?.id || '');

  const currentOrder = orders.find(o => o.id === orderToFinalizeId);

  // Estados do Formulário de Finalização de Venda
  const [paymentsList, setPaymentsList] = useState([
    { id: '1', amount_usd: '0.00', method: 'PIX', exchange_rate: exchangeRate, notes: '' }
  ]);
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [customInstallments, setCustomInstallments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializa valores ao selecionar pedido
  React.useEffect(() => {
    if (currentOrder) {
      setPaymentsList([
        { id: '1', amount_usd: String(currentOrder.total_amount_usd || 0), method: 'PIX', exchange_rate: exchangeRate, notes: '' }
      ]);
      setInstallmentsCount(0);
      setCustomInstallments([]);
    }
  }, [currentOrder?.id, exchangeRate]);

  // Se veio redirecionado com selectedOrderIdFromNav
  React.useEffect(() => {
    if (selectedOrderIdFromNav) {
      setOrderToFinalizeId(selectedOrderIdFromNav);
      setActiveTab('finalizeSale');
    }
  }, [selectedOrderIdFromNav]);

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

  // Cálculos do Assistente de Pagamento
  const totalPaidInFormUSD = paymentsList.reduce((sum, p) => sum + (parseFloat(p.amount_usd) || 0), 0);
  const remainingToFinanceUSD = Math.max(0, (currentOrder?.total_amount_usd || 0) - totalPaidInFormUSD);

  // Gerador de Parcelas Automático
  const handleGenerateInstallments = (count) => {
    const num = parseInt(count, 10);
    setInstallmentsCount(num);
    if (num <= 0 || remainingToFinanceUSD <= 0) {
      setCustomInstallments([]);
      return;
    }

    const valuePerInstallment = (remainingToFinanceUSD / num).toFixed(2);
    const newInst = [];
    const today = new Date();

    for (let i = 1; i <= num; i++) {
      const dueDate = new Date();
      dueDate.setDate(today.getDate() + (i * 15)); // intervalos de 15 dias

      newInst.push({
        id: `gen-${i}`,
        number: i,
        amount_usd: valuePerInstallment,
        due_date: dueDate.toISOString().split('T')[0]
      });
    }
    setCustomInstallments(newInst);
  };

  // Submissão da Finalização da Venda
  const handleFinalizeSaleSubmit = async (e) => {
    e.preventDefault();
    if (!currentOrder) {
      alert('Selecione um pedido.');
      return;
    }

    const validPayments = paymentsList.filter(p => (parseFloat(p.amount_usd) || 0) > 0);

    if (validPayments.length === 0 && customInstallments.length === 0) {
      alert('Informe ao menos um pagamento à vista ou gere as parcelas a prazo.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onFinalizeSale(currentOrder.id, validPayments, customInstallments);
      alert(`Venda do Pedido ${currentOrder.order_number} finalizada com sucesso! Estoque atualizado para Vendido.`);
      setActiveTab('receivables');
    } catch (err) {
      alert(`Erro na finalização: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

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
      {/* Top Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center p-1 bg-white dark:bg-[#0B101B]/80 dark:backdrop-blur-xl border border-slate-200 dark:border-white/12 rounded-full shadow-xs">
          <button
            onClick={() => setActiveTab('receivables')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'receivables'
                ? 'bg-[#111418] text-white dark:bg-white dark:text-slate-950 shadow-md'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white'
            }`}
          >
            Contas a Receber ({installments.filter(i => i.status !== 'Pago').length})
          </button>
          <button
            onClick={() => setActiveTab('finalizeSale')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'finalizeSale'
                ? 'bg-[#111418] text-white dark:bg-white dark:text-slate-950 shadow-md'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white'
            }`}
          >
            Finalizar Venda & Pagamentos ({pendingFinalizeOrders.length})
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-200">
          <span>Cotação Base: 1 USD = <strong className="text-slate-900 dark:text-white">{formatBRL(exchangeRate)}</strong></span>
        </div>
      </div>

      {/* ABA 1: CONTAS A RECEBER & PARCELAS */}
      {activeTab === 'receivables' && (
        <div className="space-y-6">
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
      )}

      {/* ABA 2: FINALIZAR VENDA & PAGAMENTOS */}
      {activeTab === 'finalizeSale' && (
        <div className="space-y-6">
          {!currentOrder ? (
            <Card className="p-12 text-center">
              <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Nenhum pedido pendente de finalização</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">Crie um pedido com reserva no módulo de Pedidos.</p>
              <Button variant="primary" size="sm" onClick={() => onNavigate('sales')}>
                Ir para Vendas
              </Button>
            </Card>
          ) : (
            <form onSubmit={handleFinalizeSaleSubmit} className="space-y-6">
              {/* Order Selection & Summary Card */}
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Finalização de Venda</h3>
                    <p className="text-xs text-slate-400">Lance pagamentos à vista, pagamentos mistos ou parcele o saldo restante</p>
                  </div>

                  <div className="w-full sm:w-80">
                    <Select
                      label="Pedido a Finalizar"
                      value={orderToFinalizeId}
                      onChange={(e) => setOrderToFinalizeId(e.target.value)}
                      options={pendingFinalizeOrders.map(o => ({ value: o.id, label: `${o.order_number} — ${o.retailer_name} (${formatUSD(o.total_amount_usd)})` }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-none bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 text-xs">
                  <div>
                    <span className="text-slate-400">Total do Pedido:</span>
                    <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{formatUSD(currentOrder.total_amount_usd)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Valor Pago à Vista:</span>
                    <p className="text-lg font-black text-emerald-600 mt-1">{formatUSD(totalPaidInFormUSD)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Saldo a Parcelar / Aberto:</span>
                    <p className={`text-lg font-black mt-1 ${remainingToFinanceUSD > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                      {formatUSD(remainingToFinanceUSD)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Aparelhos no Pedido:</span>
                    <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{currentOrder.allocated_devices?.length || 0} un.</p>
                  </div>
                </div>
              </Card>

              {/* Pagamentos à Vista / Entradas */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Pagamentos Imediatos / Entrada</h3>
                    <p className="text-xs text-slate-400">Suporte a pagamento misto (ex: parte em PIX e parte em Dólar)</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => setPaymentsList([...paymentsList, { id: `pay-${Date.now()}`, amount_usd: '0.00', method: 'Dólar', exchange_rate: exchangeRate, notes: '' }])}
                    icon={Plus}
                  >
                    Adicionar Forma de Pagamento
                  </Button>
                </div>

                <div className="space-y-3">
                  {paymentsList.map((payment, idx) => (
                    <div key={payment.id || idx} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 rounded-none bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 items-end">
                      <CurrencyInput
                        label="Valor (USD)"
                        value={payment.amount_usd}
                        onChange={(val) => {
                          const updated = [...paymentsList];
                          updated[idx].amount_usd = val;
                          setPaymentsList(updated);
                        }}
                        currency="USD"
                      />
                      <Select
                        label="Método de Pagamento"
                        value={payment.method}
                        onChange={(e) => {
                          const updated = [...paymentsList];
                          updated[idx].method = e.target.value;
                          setPaymentsList(updated);
                        }}
                        options={[
                          { value: 'PIX', label: 'PIX (Conversão BRL)' },
                          { value: 'Dólar', label: 'Dólar (USD Espécie / Wire)' },
                          { value: 'Cartão', label: 'Cartão de Crédito/Débito' },
                          { value: 'Transferência', label: 'Transferência Bancária' }
                        ]}
                      />
                      <Input
                        label="Observações / Comprovante"
                        value={payment.notes}
                        onChange={(e) => {
                          const updated = [...paymentsList];
                          updated[idx].notes = e.target.value;
                          setPaymentsList(updated);
                        }}
                        placeholder="Ex: TXID ou banco"
                      />
                      <div className="flex justify-end pb-1">
                        {paymentsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setPaymentsList(paymentsList.filter((_, i) => i !== idx))}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Parcelamento do Saldo Restante */}
              {remainingToFinanceUSD > 0 && (
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Parcelamento do Saldo ({formatUSD(remainingToFinanceUSD)})</h3>
                      <p className="text-xs text-slate-400">Gere o cronograma de vencimentos a prazo</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handleGenerateInstallments(n)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                            installmentsCount === n
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {n}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {customInstallments.length > 0 && (
                    <div className="space-y-2.5">
                      {customInstallments.map((inst, idx) => (
                        <div key={inst.id || idx} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-none bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 items-center text-xs">
                          <span className="font-bold">Parcela #{inst.number} de {customInstallments.length}</span>
                          <CurrencyInput
                            label="Valor Parcela (USD)"
                            value={inst.amount_usd}
                            onChange={(val) => {
                              const updated = [...customInstallments];
                              updated[idx].amount_usd = val;
                              setCustomInstallments(updated);
                            }}
                            currency="USD"
                          />
                          <Input
                            label="Data de Vencimento"
                            type="date"
                            value={inst.due_date}
                            onChange={(e) => {
                              const updated = [...customInstallments];
                              updated[idx].due_date = e.target.value;
                              setCustomInstallments(updated);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* Botão de Finalização */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" size="md" type="button" onClick={() => onNavigate('sales')}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  loading={isSubmitting}
                  icon={CheckCircle2}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Concluir Venda & Baixar Estoque
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
