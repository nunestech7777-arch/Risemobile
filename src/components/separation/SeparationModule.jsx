import React, { useState, useRef } from 'react';
import {
  ScanLine,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Check
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, Select } from '../ui/Input';
import { FinalizeSaleModal } from '../sales/FinalizeSaleModal';
import { formatImei, getBatteryHealthBadge } from '../../lib/formatters';

export const SeparationModule = ({
  orders = [],
  exchangeRate = 5.48,
  onMarkDeviceSeparated,
  onFinalizeSale,
  onNavigate
}) => {
  // Apenas pedidos reservados ou em separação
  const activeOrders = orders.filter(o => o.status === 'Reservado' || o.status === 'Em Separação');

  const [selectedOrderId, setSelectedOrderId] = useState(activeOrders[0]?.id || '');
  const [scannedImei, setScannedImei] = useState('');
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }
  const [orderToFinalize, setOrderToFinalize] = useState(null);
  const scanInputRef = useRef(null);

  const currentOrder = orders.find(o => o.id === selectedOrderId);
  const allocatedDevices = currentOrder?.allocated_devices || [];
  const separatedCount = allocatedDevices.filter(d => d.separated).length;
  const isAllSeparated = allocatedDevices.length > 0 && separatedCount === allocatedDevices.length;

  const handleScanSubmit = (e) => {
    e.preventDefault();
    const cleanImei = scannedImei.replace(/\D/g, '').trim();

    if (!cleanImei) return;

    // Procura o aparelho no pedido atual
    const matchingDevice = allocatedDevices.find(d => 
      d.imei.toString().replace(/\D/g, '').trim() === cleanImei
    );

    if (!matchingDevice) {
      setFeedback({
        type: 'error',
        message: `IMEI ${cleanImei} não pertence a este pedido!`
      });
      setScannedImei('');
      return;
    }

    if (matchingDevice.separated) {
      setFeedback({
        type: 'error',
        message: `IMEI ${cleanImei} já foi conferido anteriormente.`
      });
      setScannedImei('');
      return;
    }

    // Marca como separado
    onMarkDeviceSeparated(currentOrder.id, matchingDevice.device_id || matchingDevice.imei);
    setFeedback({
      type: 'success',
      message: `Conferido com sucesso: ${matchingDevice.model} ${matchingDevice.storage} (${formatImei(matchingDevice.imei)})`
    });
    setScannedImei('');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Separação & Conferência de Carga</h2>
          <p className="text-xs text-slate-400">Bipe os IMEIs físicos para validar os aparelhos antes da entrega ou envio</p>
        </div>

        {/* Order Selector */}
        <div className="w-full sm:w-80">
          <Select
            label="Selecione o Pedido em Aberto"
            value={selectedOrderId}
            onChange={(e) => {
              setSelectedOrderId(e.target.value);
              setFeedback(null);
            }}
            options={activeOrders.length === 0 
              ? [{ value: '', label: 'Nenhum pedido aguardando conferência' }]
              : activeOrders.map(o => ({ value: o.id, label: `${o.order_number} — ${o.retailer_name} (${o.allocated_devices?.length || 0} un.)` }))
            }
          />
        </div>
      </div>

      {!currentOrder ? (
        <Card className="p-12 text-center">
          <ScanLine className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Nenhum pedido selecionado</h3>
          <p className="text-xs text-slate-400 mt-1 mb-4">Crie um pedido com reserva de estoque para iniciar a conferência.</p>
          <Button variant="primary" size="sm" onClick={() => onNavigate('sales')}>
            Ver Vendas
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Bipador / Barcode Scanner Card */}
          <div className="lg:col-span-5 space-y-5">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <ScanLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Bipador de IMEI</h3>
                  <p className="text-xs text-slate-400">Pressione Enter após bipar o código</p>
                </div>
              </div>

              <form onSubmit={handleScanSubmit} className="space-y-4">
                <Input
                  ref={scanInputRef}
                  autoFocus
                  label="Escanear / Digitar IMEI"
                  placeholder="Bipe o código de barras ou digite..."
                  value={scannedImei}
                  onChange={(e) => setScannedImei(e.target.value)}
                  icon={ScanLine}
                  className="font-mono font-bold text-base"
                />

                <Button variant="primary" size="md" className="w-full" type="submit">
                  Confirmar Bipe
                </Button>
              </form>

              {/* Feedback Alert */}
              {feedback && (
                <div className={`mt-4 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}>
                  {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{feedback.message}</span>
                </div>
              )}
            </Card>

            {/* Progress Card */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Progresso da Separação</span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {separatedCount} / {allocatedDevices.length} un.
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${allocatedDevices.length ? (separatedCount / allocatedDevices.length) * 100 : 0}%` }}
                />
              </div>

              {isAllSeparated && (
                <div className="mt-5 p-4 rounded-2xl bg-[#E3F5EB] dark:bg-[#193928] text-slate-900 dark:text-white space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Todos os aparelhos foram conferidos!</span>
                  </div>
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full bg-[#111418] text-white dark:bg-white dark:text-slate-900 font-bold"
                    onClick={() => setOrderToFinalize(currentOrder)}
                    icon={ArrowRight}
                    iconPosition="right"
                  >
                    Finalizar Venda
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Checklist of devices to separate */}
          <div className="lg:col-span-7">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Checklist de Aparelhos do Pedido</h3>
                  <p className="text-xs text-slate-400">{currentOrder.retailer_name} • {allocatedDevices.length} itens</p>
                </div>
                <Badge variant={isAllSeparated ? 'mint' : 'butter'} size="sm">
                  {isAllSeparated ? 'Pronto para Finalizar' : 'Em Conferência'}
                </Badge>
              </div>

              <div className="space-y-2.5">
                {allocatedDevices.map((dev, idx) => {
                  const isDone = dev.separated;
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                        isDone 
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' 
                          : 'bg-white dark:bg-[#1A212E] border-slate-100 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          isDone 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'
                        }`}>
                          {isDone ? <Check className="w-4 h-4" /> : idx + 1}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {dev.model} {dev.storage}
                          </div>
                          <div className="font-mono text-xs text-slate-500 dark:text-slate-300">
                            IMEI: {formatImei(dev.imei)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBatteryHealthBadge(dev.battery_health).color}`}>
                          {dev.battery_health}% bat
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-300">{dev.color}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* MODAL DE FINALIZAÇÃO DE VENDA (pagamento + parcelamento em uma única etapa) */}
      <FinalizeSaleModal
        isOpen={Boolean(orderToFinalize)}
        order={orderToFinalize}
        exchangeRate={exchangeRate}
        onClose={() => setOrderToFinalize(null)}
        onFinalizeSale={onFinalizeSale}
      />
    </div>
  );
};
