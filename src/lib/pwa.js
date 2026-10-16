// RiseMobile: PWA (service worker, instalação e cor da barra do navegador).

const INSTALL_DISMISSED_KEY = 'risemobile_pwa_install_dismissed_at';
const DISMISS_DAYS = 14;

export const isStandalone = () =>
  (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) ||
  (typeof navigator !== 'undefined' && navigator.standalone === true);

// iPhone/iPad não têm o botão de instalar do Chrome: o usuário precisa usar "Adicionar à Tela de Início".
export const isIosSafari = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIos && isSafari;
};

export const wasInstallPromptDismissed = () => {
  try {
    const at = Number(localStorage.getItem(INSTALL_DISMISSED_KEY));
    return Boolean(at) && Date.now() - at < DISMISS_DAYS * 864e5;
  } catch {
    return false;
  }
};

export const rememberInstallPromptDismissed = () => {
  try { localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now())); } catch { /* sem armazenamento: só não lembra */ }
};

// Registra o service worker (somente em produção) e avisa quando há uma versão nova esperando.
// A troca só acontece quando o usuário aceita (applyUpdate), nunca no meio de uma venda.
export const registerServiceWorker = ({ onUpdateReady } = {}) => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !import.meta.env.PROD) return () => {};

  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  const onControllerChange = () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

  let intervalId;
  const start = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const announce = (worker) => onUpdateReady?.(() => worker.postMessage({ type: 'SKIP_WAITING' }));

      if (registration.waiting && navigator.serviceWorker.controller) announce(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) announce(worker);
        });
      });
      intervalId = setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    } catch (err) {
      console.warn('Service worker não registrado:', err);
    }
  };

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    clearInterval(intervalId);
  };
};

// Mantém a cor da barra do navegador/app igual ao tema em uso (claro/escuro escolhido no sistema).
const THEME_COLORS = { light: '#EEF2F6', dark: '#0B0E14' };

export const syncThemeColor = () => {
  if (typeof document === 'undefined') return () => {};
  const apply = () => {
    const isDark = document.documentElement.classList.contains('dark');
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', isDark ? THEME_COLORS.dark : THEME_COLORS.light));
  };
  apply();
  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};
