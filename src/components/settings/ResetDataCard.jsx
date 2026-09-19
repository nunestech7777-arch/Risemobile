import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { RESET_CONFIRMATION_TEXT } from '../../lib/supabaseClient';

export const ResetDataCard = ({ onResetData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [doneAt, setDoneAt] = useState(null);

  const canConfirm = confirmation.trim() === RESET_CONFIRMATION_TEXT && !isResetting;

  const close = () => {
    if (isResetting) return;
    setIsOpen(false);
    setConfirmation('');
    setError('');
  };

  const handleConfirm = async () => {
    setError('');
    setIsResetting(true);
    try {
      await onResetData(confirmation.trim());
      setDoneAt(new Date());
      setIsOpen(false);
      setConfirmation('');
    } catch (err) {
      setError(err.message || 'Não foi possível zerar a base de dados.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <Card className="p-6 border-rose-200 dark:border-rose-900/40 bg-rose-50/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4" /> Zerar Dados / Iniciar com Dados Reais
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
              Apaga todo o estoque, vendas, lojistas, pagamentos, parcelas, comissões e movimentações para iniciar a operação com dados 100% reais.
            </p>
            {doneAt && (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Base zerada às {doneAt.toLocaleTimeString('pt-BR')}. Pronta para cadastrar seus dados reais.
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-rose-600 border-rose-300 hover:bg-rose-50"
            type="button"
            onClick={() => setIsOpen(true)}
          >
            Zerar Base de Dados
          </Button>
        </div>
      </Card>

      <Modal
        isOpen={isOpen}
        onClose={close}
        title="Zerar toda a base de dados?"
        subtitle="Esta ação é irreversível."
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex gap-2.5 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 dark:text-rose-200 space-y-1.5">
              <p><strong>Será apagado:</strong> aparelhos e entradas de estoque, vendas e pedidos, lojistas, pagamentos, parcelas, comissões, indicações, devoluções, movimentações, ajustes e o histórico de auditoria.</p>
              <p><strong>Será mantido:</strong> logins de acesso, grades e configurações do sistema.</p>
            </div>
          </div>

          <Input
            id="reset-confirmation"
            label={`Digite ${RESET_CONFIRMATION_TEXT} para confirmar`}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={RESET_CONFIRMATION_TEXT}
            autoComplete="off"
            disabled={isResetting}
          />

          {error && (
            <div role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="md" type="button" onClick={close} disabled={isResetting}>
              Cancelar
            </Button>
            <Button variant="danger" size="md" type="button" onClick={handleConfirm} disabled={!canConfirm} loading={isResetting}>
              Zerar base de dados
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
