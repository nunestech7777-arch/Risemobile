import React, { useState, useEffect, useMemo } from 'react';
import { Undo2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { formatUSD, formatImeiLabel } from '../../lib/formatters';

const RETURN_REASONS = [
  { value: 'Troca solicitada', label: 'Troca solicitada pelo lojista' },
  { value: 'Defeito', label: 'Defeito' },
  { value: 'Erro de modelo', label: 'Erro de modelo' },
  { value: 'Erro de grade', label: 'Erro de grade' },
  { value: 'Erro de cor', label: 'Erro de cor' },
  { value: 'Divergência', label: 'Divergência' },
  { value: 'Outro', label: 'Outro' }
];

// Registra a devolução de um ou mais aparelhos de uma venda já finalizada.
// Não é cancelamento: a venda permanece, apenas os aparelhos selecionados
// voltam ao estoque e o faturamento/comissão são ajustados.
export const RegisterReturnModal = ({
  isOpen,
  order,
  onClose,
  onRegisterReturn
}) => {
  const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
  const [reason, setReason] = useState(RETURN_REASONS[0].value);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (order) {
      setSelectedDeviceIds([]);
      setReason(RETURN_REASONS[0].value);
      setNotes('');
      setError('');
    }
  }, [order?.id]);

  const totalOriginalUnits = (order?.allocated_devices?.length || 0) + (order?.returned_devices?.length || 0);
  const commissionPerUnit = totalOriginalUnits > 0 ? (order?.total_commission_usd || 0) / totalOriginalUnits : 0;

  const getDevicePrice = (dev) => {
    const matchingItem = (order?.items || []).find(it =>
      it.model === dev.model && it.storage === dev.storage && (!it.grade_id || it.grade_id === dev.grade_id)
    );
    if (matchingItem) return parseFloat(matchingItem.unit_price_usd) || 0;
    return totalOriginalUnits > 0 ? (order?.total_amount_usd || 0) / totalOriginalUnits : 0;
  };

  const selectedDevices = useMemo(() => {
    return (order?.allocated_devices || []).filter(d => selectedDeviceIds.includes(d.device_id));
  }, [order, selectedDeviceIds]);

  const impactRevenueUSD = useMemo(() => selectedDevices.reduce((sum, d) => sum + getDevicePrice(d), 0), [selectedDevices, order]);
  const impactCommissionUSD = selectedDevices.length * commissionPerUnit;

  const toggleDevice = (deviceId) => {
    setSelectedDeviceIds(prev =>
      prev.includes(deviceId) ? prev.filter(id => id !== deviceId) : [...prev, deviceId]
    );
    setError('');
  };

  const handleConfirm = async () => {
    if (selectedDeviceIds.length === 0) {
      setError('Selecione ao menos um aparelho para devolução.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await onRegisterReturn(order.id, selectedDeviceIds, reason, notes);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Devolução"
      subtitle={`Pedido ${order.order_number} — ${order.retailer_name}`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Seleção de Aparelhos */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Selecione o(s) Aparelho(s) a Devolver
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {(order.allocated_devices || []).map((dev) => {
              const checked = selectedDeviceIds.includes(dev.device_id);
              return (
                <label
                  key={dev.device_id}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    checked
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDevice(dev.device_id)}
                    className="w-4 h-4 rounded accent-amber-600"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {dev.model} <span className="text-xs text-slate-400 font-normal">({dev.storage})</span>
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {formatImeiLabel(dev.imei)}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {formatUSD(getDevicePrice(dev))}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Motivo e Observações */}
        <div className="grid grid-cols-1 gap-4">
          <Select
            label="Motivo da Devolução"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            options={RETURN_REASONS}
          />
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              Observações
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Cliente solicitou troca por outro aparelho da mesma configuração."
              className="w-full p-3 text-xs rounded-2xl bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>
        </div>

        {/* Resumo do Impacto */}
        {selectedDeviceIds.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4" />
              Você está devolvendo {selectedDeviceIds.length} {selectedDeviceIds.length === 1 ? 'aparelho' : 'aparelhos'}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Impacto no Faturamento:</span>
                <div className="font-bold text-rose-600 dark:text-rose-400">-{formatUSD(impactRevenueUSD)}</div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Impacto na Comissão:</span>
                <div className="font-bold text-rose-600 dark:text-rose-400">-{formatUSD(impactCommissionUSD)}</div>
              </div>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              O(s) aparelho(s) retornará(ão) ao estoque como Disponível. Essa ação afeta estoque, faturamento, comissão e financeiro da venda.
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button variant="outline" size="md" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            type="button"
            onClick={handleConfirm}
            loading={isSubmitting}
            disabled={selectedDeviceIds.length === 0}
            icon={Undo2}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
          >
            {isSubmitting ? 'Registrando...' : 'Confirmar Devolução'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default RegisterReturnModal;
