import React, { useState, useEffect } from 'react';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Select, CurrencyInput } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { formatUSD } from '../../lib/formatters';

// Modal única de finalização de venda: coleta pagamento/parcelamento e confirma
// a venda no mesmo fluxo, sem redirecionar para uma tela separada.
export const FinalizeSaleModal = ({
  isOpen,
  order,
  exchangeRate = 5.48,
  onClose,
  onFinalizeSale
}) => {
  const [paymentsList, setPaymentsList] = useState([
    { id: '1', amount_usd: '0.00', method: 'PIX', exchange_rate: exchangeRate, notes: '' }
  ]);
  const [installmentsCount, setInstallmentsCount] = useState(0);
  const [customInstallments, setCustomInstallments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Reinicia o formulário sempre que um novo pedido é aberto para finalização
  useEffect(() => {
    if (order) {
      setPaymentsList([
        { id: '1', amount_usd: String(order.total_amount_usd || 0), method: 'PIX', exchange_rate: exchangeRate, notes: '' }
      ]);
      setInstallmentsCount(0);
      setCustomInstallments([]);
      setSubmitError('');
    }
  }, [order?.id, exchangeRate]);

  const totalPaidInFormUSD = paymentsList.reduce((sum, p) => sum + (parseFloat(p.amount_usd) || 0), 0);
  const remainingToFinanceUSD = Math.max(0, (order?.total_amount_usd || 0) - totalPaidInFormUSD);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!order) return;

    const validPayments = paymentsList.filter(p => (parseFloat(p.amount_usd) || 0) > 0);

    if (validPayments.length === 0 && customInstallments.length === 0) {
      setSubmitError('Informe ao menos um pagamento à vista ou gere as parcelas a prazo.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onFinalizeSale(order.id, validPayments, customInstallments);
      onClose();
    } catch (err) {
      setSubmitError(`Erro na finalização: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Finalizar Venda"
      subtitle={`Pedido ${order.order_number} — ${order.retailer_name}`}
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Resumo do Pedido */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 text-xs">
          <div>
            <span className="text-slate-400">Total do Pedido:</span>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{formatUSD(order.total_amount_usd)}</p>
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
            <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{order.allocated_devices?.length || 0} un.</p>
          </div>
        </div>

        {/* Pagamentos à Vista / Entradas */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Pagamentos Imediatos / Entrada</h4>
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
              <div key={payment.id || idx} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 items-end">
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
        </div>

        {/* Parcelamento do Saldo Restante */}
        {remainingToFinanceUSD > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Parcelamento do Saldo ({formatUSD(remainingToFinanceUSD)})</h4>
                <p className="text-xs text-slate-400">Gere o cronograma de vencimentos a prazo. O saldo restante vai para Contas a Receber.</p>
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
                  <div key={inst.id || idx} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 items-center text-xs">
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
          </div>
        )}

        {submitError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
            {submitError}
          </div>
        )}

        {/* Ações */}
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button variant="outline" size="md" type="button" onClick={onClose}>
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
            {isSubmitting ? 'Finalizando...' : 'Finalizar Venda'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default FinalizeSaleModal;
