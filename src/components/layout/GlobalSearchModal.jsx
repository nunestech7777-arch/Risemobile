import React, { useState, useEffect } from 'react';
import { Search, ShoppingBag, Users, ArrowRight, X } from 'lucide-react';
import { IPhoneIcon } from '../common/IPhoneIcon';
import { formatUSD, formatImei, getStatusBadge } from '../../lib/formatters';

export const GlobalSearchModal = ({ 
  isOpen, 
  onClose, 
  devices = [], 
  orders = [], 
  retailers = [],
  onNavigate 
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(true); // toggle
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  // Filtros de resultados
  const filteredDevices = q
    ? devices.filter(d => 
        d.imei.toLowerCase().includes(q) || 
        d.model.toLowerCase().includes(q) || 
        d.storage.toLowerCase().includes(q) ||
        d.color.toLowerCase().includes(q)
      ).slice(0, 5)
    : [];

  const filteredOrders = q
    ? orders.filter(o => 
        o.order_number.toLowerCase().includes(q) || 
        o.retailer_name.toLowerCase().includes(q)
      ).slice(0, 4)
    : [];

  const filteredRetailers = q
    ? retailers.filter(r => 
        (r.store_name && r.store_name.toLowerCase().includes(q)) || 
        (r.contact_name && r.contact_name.toLowerCase().includes(q)) ||
        (r.city && r.city.toLowerCase().includes(q))
      ).slice(0, 4)
    : [];

  const hasResults = filteredDevices.length > 0 || filteredOrders.length > 0 || filteredRetailers.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0D121D]/95 dark:backdrop-blur-2xl border border-slate-200 dark:border-white/15 rounded-3xl shadow-modal dark:shadow-[0_25px_60px_rgba(0,0,0,0.7)] overflow-hidden z-10 flex flex-col">
        {/* Search Input Bar */}
        <div className="flex items-center px-5 py-4 border-b border-slate-100 dark:border-white/10 gap-3">
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-300 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite IMEI, modelo, número do pedido ou lojista..."
            className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 outline-none text-base font-medium"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-1 text-[11px] bg-slate-100 dark:bg-white/[0.08] dark:border dark:border-white/10 rounded font-mono text-slate-500 dark:text-slate-300">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {!query ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-300">
              Digite um termo para pesquisar em todo o catálogo, pedidos e lojistas.
            </div>
          ) : !hasResults ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-300">
              Nenhum resultado encontrado para "{query}".
            </div>
          ) : (
            <>
              {/* Aparelhos / IMEIs */}
              {filteredDevices.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 px-3 mb-2 flex items-center gap-1.5">
                    <IPhoneIcon className="w-3.5 h-3.5" /> Aparelhos ({filteredDevices.length})
                  </h4>
                  <div className="space-y-1">
                    {filteredDevices.map((d) => (
                      <div
                        key={d.id}
                        onClick={() => {
                          onNavigate('stock', { deviceId: d.id, imei: d.imei });
                          onClose();
                        }}
                        className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/[0.06] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.08] flex items-center justify-center">
                            <IPhoneIcon className="w-4 h-4 text-slate-600 dark:text-cyan-300 stroke-[1.8]" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {d.model} {d.storage} — <span className="font-mono text-xs text-indigo-600 dark:text-cyan-400">{formatImei(d.imei)}</span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-300">
                              Cor: {d.color} • Bateria: {d.battery_health}% • Status: {d.status}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatUSD(d.suggested_price_usd)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vendas */}
              {filteredOrders.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 px-3 mb-2 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5" /> Vendas ({filteredOrders.length})
                  </h4>
                  <div className="space-y-1">
                    {filteredOrders.map((o) => (
                      <div
                        key={o.id}
                        onClick={() => {
                          onNavigate('sales', { orderId: o.id });
                          onClose();
                        }}
                        className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/[0.06] cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {o.order_number} — <span className="font-normal text-slate-600 dark:text-slate-300">{o.retailer_name}</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-300">
                            Status: {o.status} • {o.items?.length || 0} modelos
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatUSD(o.total_amount_usd)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lojistas */}
              {filteredRetailers.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 px-3 mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Lojistas ({filteredRetailers.length})
                  </h4>
                  <div className="space-y-1">
                    {filteredRetailers.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => {
                          onNavigate('retailers', { retailerId: r.id });
                          onClose();
                        }}
                        className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/[0.06] cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {r.store_name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-300">
                            {[
                              r.contact_name,
                              [r.city, r.state].filter(Boolean).join('/'),
                              r.whatsapp ? `WhatsApp: ${r.whatsapp}` : null
                            ].filter(Boolean).join(' • ') || 'Sem contatos adicionais'}
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-300" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
