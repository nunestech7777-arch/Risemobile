import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, WifiOff, X, Share } from 'lucide-react';
import {
  isIosSafari,
  isStandalone,
  registerServiceWorker,
  rememberInstallPromptDismissed,
  syncThemeColor,
  wasInstallPromptDismissed
} from '../../lib/pwa';

const cardClass =
  'pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0D121D] text-slate-900 dark:text-slate-100 shadow-modal dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)]';

export const PwaPrompts = () => {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [applyUpdate, setApplyUpdate] = useState(null);
  const [installEvent, setInstallEvent] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => syncThemeColor(), []);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => registerServiceWorker({ onUpdateReady: (apply) => setApplyUpdate(() => apply) }), []);

  useEffect(() => {
    if (isStandalone() || wasInstallPromptDismissed()) return undefined;
    if (isIosSafari()) setShowIosHint(true);

    const onBeforeInstall = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismissInstall = () => {
    rememberInstallPromptDismissed();
    setInstallEvent(null);
    setShowIosHint(false);
  };

  const install = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    try { await installEvent.userChoice; } catch { /* ignorado */ }
    setInstallEvent(null);
  };

  return (
    <>
      {!isOnline && (
        <div
          role="status"
          className="fixed top-0 inset-x-0 z-[70] flex items-center justify-center gap-2 bg-amber-500 text-slate-950 text-xs font-bold px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))]"
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          Sem conexão com a internet. Vendas e cadastros só funcionam quando ela voltar.
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {applyUpdate && (
          <div role="alert" className={`${cardClass} flex items-center gap-3 p-3`}>
            <RefreshCw className="w-5 h-5 shrink-0 text-blue-600 dark:text-cyan-400" />
            <p className="flex-1 text-sm font-semibold">Nova versão do RiseMobile disponível.</p>
            <button
              type="button"
              onClick={() => applyUpdate()}
              className="min-h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold"
            >
              Atualizar
            </button>
          </div>
        )}

        {installEvent && (
          <div role="dialog" aria-label="Instalar aplicativo" className={`${cardClass} flex items-center gap-3 p-3`}>
            <img src="/icon-192.png" alt="" className="w-11 h-11 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">Instalar o RiseMobile</p>
              <p className="text-xs text-slate-500 dark:text-slate-300">Abra pela tela inicial, como um app.</p>
            </div>
            <button
              type="button"
              onClick={install}
              className="min-h-10 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Instalar
            </button>
            <button type="button" onClick={dismissInstall} aria-label="Agora não" className="min-h-10 min-w-10 grid place-items-center rounded-xl text-slate-500 dark:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {showIosHint && !installEvent && (
          <div role="dialog" aria-label="Instalar aplicativo no iPhone" className={`${cardClass} flex items-center gap-3 p-3`}>
            <img src="/icon-192.png" alt="" className="w-11 h-11 rounded-xl shrink-0" />
            <p className="flex-1 text-xs text-slate-700 dark:text-slate-200">
              <span className="font-bold text-sm block">Instalar o RiseMobile</span>
              Toque em <Share className="inline w-3.5 h-3.5 -mt-0.5" /> <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.
            </p>
            <button type="button" onClick={dismissInstall} className="min-h-10 px-3 rounded-xl bg-slate-100 dark:bg-white/10 text-sm font-bold">
              Entendi
            </button>
          </div>
        )}
      </div>
    </>
  );
};
