import React from 'react';
import { Drawer } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatDate, formatUSD, formatImeiLabel, formatColor, getStatusBadge, getBatteryHealthBadge } from '../../lib/formatters';
import { Clock, ShieldAlert, CheckCircle, ArrowRight, ArrowDownLeft, Tag, Layers } from 'lucide-react';

export const DeviceHistoryDrawer = ({
  isOpen,
  onClose,
  device,
  movements = [],
  grades = [],
  onOpenAdjustment
}) => {
  if (!device) return null;

  const gradeObj = grades.find(g => g.id === device.grade_id);
  const statusInfo = getStatusBadge(device.status);
  const batteryInfo = getBatteryHealthBadge(device.battery_health);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`${device.model} ${device.storage}`}
      subtitle={formatImeiLabel(device.imei)}
      width="max-w-lg"
    >
      <div className="space-y-6">
        {/* Device Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] dark:backdrop-blur-sm border border-slate-200 dark:border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusInfo.bg}`}>
              {device.status}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${batteryInfo.color}`}>
              {batteryInfo.label === '—' ? 'Bateria não informada' : `Bateria ${batteryInfo.label}`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div>
              <span className="text-slate-400">Grade:</span>
              <p className="font-bold text-slate-800 dark:text-slate-100">{gradeObj?.name || 'A++'}</p>
            </div>
            <div>
              <span className="text-slate-400">Cor:</span>
              <p className="font-bold text-slate-800 dark:text-slate-100">{formatColor(device.color)}</p>
            </div>
            <div>
              <span className="text-slate-400">Preço de Custo (USD):</span>
              <p className="font-bold text-slate-800 dark:text-slate-100">{device.cost_price_usd ? formatUSD(device.cost_price_usd) : '—'}</p>
            </div>
            <div>
              <span className="text-slate-400">Preço Sugerido (USD):</span>
              <p className="font-bold text-emerald-600 dark:text-emerald-400 font-bold">{device.suggested_price_usd ? formatUSD(device.suggested_price_usd) : '—'}</p>
            </div>
          </div>
        </div>

        {/* Timeline of Perpetual Movements */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Histórico de Movimentações ({movements.length})
          </h4>

          {movements.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-white/[0.04] rounded-2xl border border-transparent dark:border-white/10">
              Nenhum movimentação registrada para esta unidade.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-white/10">
              {movements.map((m, idx) => (
                <div key={m.id || idx} className="relative group">
                  {/* Dot */}
                  <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-slate-900 dark:bg-cyan-400 ring-4 ring-white dark:ring-[#0D121D] shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                  
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-white/[0.04] dark:backdrop-blur-sm border border-slate-100 dark:border-white/10 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {m.movement_type}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-300">
                        {formatDate(m.created_at, true)}
                      </span>
                    </div>
                    {m.previous_status && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        Status: <span className="line-through text-slate-400">{m.previous_status}</span> → <span className="font-semibold text-slate-900 dark:text-slate-100">{m.new_status}</span>
                      </p>
                    )}
                    {m.reason && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 bg-slate-50 dark:bg-white/[0.06] p-2 rounded-xl border border-transparent dark:border-white/10">
                        {m.reason}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};
