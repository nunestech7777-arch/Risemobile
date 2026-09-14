import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { GlobalSearchModal } from './components/layout/GlobalSearchModal';
import { LoginScreen } from './components/auth/LoginScreen';
import { RiseMobileLogo } from './components/common/RiseMobileLogo';

import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { StockManagement } from './components/stock/StockManagement';
import { RetailersModule } from './components/retailers/RetailersModule';
import { SalesModule } from './components/sales/SalesModule';
import { SeparationModule } from './components/separation/SeparationModule';
import { PaymentsModule } from './components/payments/PaymentsModule';
import { CommissionsModule } from './components/commissions/CommissionsModule';
import { ProfitModule } from './components/profit/ProfitModule';
import { ReportsModule } from './components/reports/ReportsModule';
import { SettingsModule } from './components/settings/SettingsModule';
import { ShaderBackground } from './components/ui/adisyon-shader';

import { DataService, AuthService } from './lib/supabaseClient';
import { fetchUsdToBrlRate } from './lib/exchangeRateService';


export function App() {
  // Authentication & Session States
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [navParams, setNavParams] = useState({});
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Theme Management (Light / Dark / System)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('risemobile_theme') || 'system';
  });

  // System Core Data States
  const [grades, setGrades] = useState([]);
  const [devices, setDevices] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [movements, setMovements] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [retailerReferrals, setRetailerReferrals] = useState([]);
  const [settings, setSettings] = useState({});
  const [exchangeRate, setExchangeRate] = useState(5.48);
  const [isRateLoading, setIsRateLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Live USD/BRL Exchange Rate (AwesomeAPI)
  const refreshExchangeRate = useCallback(async () => {
    setIsRateLoading(true);
    try {
      const rate = await fetchUsdToBrlRate();
      setExchangeRate(rate);
    } catch (err) {
      console.error('Erro ao atualizar cotação USD/BRL:', err);
    } finally {
      setIsRateLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshExchangeRate();
    const intervalId = setInterval(refreshExchangeRate, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [refreshExchangeRate]);

  // Apply Theme to DOM
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (currentTheme) => {
      if (currentTheme === 'dark') {
        root.classList.add('dark');
      } else if (currentTheme === 'light') {
        root.classList.remove('dark');
      } else {
        // System
        if (mediaQuery.matches) root.classList.add('dark');
        else root.classList.remove('dark');
      }
    };

    applyTheme(theme);
    localStorage.setItem('risemobile_theme', theme);

    const listener = () => {
      if (theme === 'system') applyTheme('system');
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [theme]);

  // Session Initialization & Supabase Auth Event Subscription
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const activeSession = await AuthService.getSession();
        if (isMounted) {
          setSession(activeSession);
          setUser(activeSession?.user || null);
        }
      } catch (err) {
        console.error('Session initialization error:', err);
      } finally {
        if (isMounted) {
          setIsAuthChecking(false);
        }
      }
    }

    initAuth();

    const unsubscribe = AuthService.onAuthStateChange((event, newSession) => {
      if (isMounted) {
        setSession(newSession);
        setUser(newSession?.user || null);
      }
    });

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Handle Successful Login
  const handleLoginSuccess = (authUser, authSession) => {
    setUser(authUser);
    setSession(authSession);
    setActiveTab('dashboard');
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await AuthService.signOut();
    } finally {
      setUser(null);
      setSession(null);
      setActiveTab('dashboard');
    }
  };

  // Load All System Data (Only when Authenticated)
  const loadAllData = useCallback(async () => {
    if (!session) return;
    try {
      const [
        loadedGrades, 
        loadedDevices, 
        loadedRetailers, 
        loadedOrders, 
        loadedInstallments, 
        loadedMovements,
        loadedAdjustments,
        loadedRetailerReferrals,
        loadedSettings
      ] = await Promise.all([
        DataService.getGrades(),
        DataService.getDevices(),
        DataService.getRetailers(),
        DataService.getOrders(),
        DataService.getInstallments(),
        DataService.getMovements(),
        DataService.getAdjustments(),
        DataService.getRetailerReferrals(),
        DataService.getSettings()
      ]);

      setGrades(loadedGrades);
      setDevices(loadedDevices);
      setRetailers(loadedRetailers);
      setOrders(loadedOrders);
      setInstallments(loadedInstallments);
      setMovements(loadedMovements);
      setAdjustments(loadedAdjustments);
      setRetailerReferrals(loadedRetailerReferrals);
      setSettings(loadedSettings);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      loadAllData();
    }
  }, [session, loadAllData]);

  // Navegação com parâmetros
  const handleNavigate = (tabId, params = {}) => {
    setActiveTab(tabId);
    setNavParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const handleSaveGrade = async (grade) => {
    await DataService.saveGrade(grade);
    await loadAllData();
  };

  const handleSaveRetailer = async (retailer) => {
    await DataService.saveRetailer(retailer);
    await loadAllData();
  };

  const handleSaveRetailerReferral = async (referral) => {
    await DataService.saveRetailerReferral(referral);
    await loadAllData();
  };

  const handleDeleteRetailerReferral = async (id) => {
    await DataService.deleteRetailerReferral(id);
    await loadAllData();
  };

  const handleReserveOrder = async (orderData, items) => {
    const res = await DataService.reserveOrder(orderData, items);
    await loadAllData();
    return res;
  };

  const handleCancelOrder = async (orderId, reason) => {
    await DataService.cancelOrder(orderId, reason);
    await loadAllData();
  };

  const handleMarkDeviceSeparated = async (orderId, deviceId) => {
    await DataService.markDeviceAsSeparated(orderId, deviceId);
    await loadAllData();
  };

  const handleFinalizeSale = async (orderId, paymentsList, installmentsList) => {
    await DataService.finalizeOrderSale(orderId, paymentsList, installmentsList);
    await loadAllData();
  };

  const handlePayInstallment = async (installmentId, details) => {
    await DataService.payInstallment(installmentId, details);
    await loadAllData();
  };

  const handleAdjustStock = async (deviceId, reason, notes) => {
    await DataService.adjustStock(deviceId, reason, notes);
    await loadAllData();
  };

  const handleResetDemoData = async () => {
    DataService.resetToDemoData();
    await loadAllData();
  };

  // Título da página atual
  const pageTitles = {
    dashboard: { title: 'Visão Geral', subtitle: 'Painel executivo de atacado de iPhones' },
    stock: { title: 'Estoque', subtitle: 'Visão consolidada e consulta por IMEI' },
    sales: { title: 'Vendas', subtitle: 'Seleção automática de modelos, reserva e finalização comercial' },
    orders: { title: 'Vendas', subtitle: 'Seleção automática de modelos, reserva e finalização comercial' },
    retailers: { title: 'Lojistas', subtitle: 'Gestão de parceiros comerciais e histórico' },
    separation: { title: 'Separação & Conferência', subtitle: 'Bipador físico de IMEIs para expedição' },
    payments: { title: 'Financeiro & Parcelas', subtitle: 'Contas a receber, baixas e pagamentos mistos' },
    commissions: { title: 'Comissões', subtitle: 'Comissão única oficial por indicação de lojista' },
    profit: { title: 'Faturamento', subtitle: 'Acompanhe o faturamento realizado e o potencial de vendas da operação' },
    reports: { title: 'Relatórios & Exportação', subtitle: 'Exportação em Excel (.xlsx) e CSV' },
    settings: { title: 'Configurações', subtitle: 'Cotação cambial, Supabase e parâmetros' },
  };

  // Alertas pendentes
  const pendingAlerts = [
    ...installments.filter(i => i.status === 'Vencido').map(i => ({
      title: `Parcela Vencida: ${i.order_number}`,
      description: `${i.retailer_name} — ${i.amount_usd} USD`
    })),
    ...devices.filter(d => d.battery_health < 80 && d.status === 'Disponível').map(d => ({
      title: `Bateria Baixa: ${d.model}`,
      description: `IMEI ${d.imei} com ${d.battery_health}% de saúde`
    }))
  ];

  const currentHeaderInfo = pageTitles[activeTab] || { title: 'RiseMobile', subtitle: '' };

  // 1. Initial Session Check (Splash Screen — Eliminates flash of private content)
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] dark:bg-[#030407] dark-ambient-canvas flex flex-col items-center justify-center relative overflow-hidden text-slate-900 dark:text-white transition-colors duration-300">
        <div className="hidden dark:block pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
          <ShaderBackground className="w-full h-full" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4 animate-pulse">
          <RiseMobileLogo isExpanded={true} size="xl" />
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/70 dark:bg-white/[0.05] backdrop-blur-md border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-sm mt-3">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Verificando autenticação segura...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State: Render Exclusively the Official Login Screen (No Sidebar, No Header, No Data leaks)
  if (!session) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // 3. Authenticated State: Full RiseMobile System
  return (
    <div className="min-h-screen bg-[#EEF2F6] dark:bg-[#030407] dark-ambient-canvas flex p-3 sm:p-4 gap-4 max-w-[1600px] mx-auto transition-colors duration-200 text-slate-900 dark:text-slate-100 relative">
      {/* 21st.dev Adisyon Waves Shader Atmosphere Layer (Dark Mode) */}
      <div className="hidden dark:block pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <ShaderBackground className="w-full h-full" />
      </div>

      {/* Desktop Vertical Sidebar */}
      <div className="hidden md:block shrink-0 relative z-40">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onNavigate={handleNavigate}
          pendingAlertsCount={pendingAlerts.length}
          onLogout={handleLogout}
        />
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative z-10 w-auto max-w-[90vw] h-full p-2 shadow-modal">
            <Sidebar
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              onNavigate={handleNavigate}
              isMobile
              onCloseMobile={() => setIsMobileMenuOpen(false)}
              pendingAlertsCount={pendingAlerts.length}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Top Header */}
        <Header
          title={currentHeaderInfo.title}
          subtitle={currentHeaderInfo.subtitle}
          theme={theme}
          onThemeChange={setTheme}
          onOpenSearch={() => setIsSearchOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          exchangeRate={exchangeRate}
          onRefreshRate={refreshExchangeRate}
          isRateLoading={isRateLoading}
          pendingAlerts={pendingAlerts}
          user={user}
          onLogout={handleLogout}
        />


        {/* Dynamic Screen Renderer */}
        <div className="flex-1">
          {activeTab === 'dashboard' && (
            <DashboardOverview
              devices={devices}
              orders={orders}
              retailers={retailers}
              installments={installments}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'stock' && (
            <StockManagement
              devices={devices}
              grades={grades}
              movements={movements}
              onNavigate={handleNavigate}
              onSaveGrade={handleSaveGrade}
            />
          )}

          {activeTab === 'retailers' && (
            <RetailersModule
              retailers={retailers}
              orders={orders}
              installments={installments}
              onSaveRetailer={handleSaveRetailer}
              onNavigate={handleNavigate}
            />
          )}

          {(activeTab === 'sales' || activeTab === 'orders') && (
            <SalesModule
              orders={orders}
              retailers={retailers}
              devices={devices}
              grades={grades}
              onReserveOrder={handleReserveOrder}
              onCancelOrder={handleCancelOrder}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'separation' && (
            <SeparationModule
              orders={orders}
              onMarkDeviceSeparated={handleMarkDeviceSeparated}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentsModule
              orders={orders}
              installments={installments}
              exchangeRate={exchangeRate}
              selectedOrderIdFromNav={navParams.orderId}
              onFinalizeSale={handleFinalizeSale}
              onPayInstallment={handlePayInstallment}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'commissions' && (
            <CommissionsModule
              orders={orders}
              retailers={retailers}
              retailerReferrals={retailerReferrals}
              onSaveReferral={handleSaveRetailerReferral}
              onDeleteReferral={handleDeleteRetailerReferral}
            />
          )}

          {activeTab === 'profit' && (
            <ProfitModule
              orders={orders}
              devices={devices}
              retailerReferrals={retailerReferrals}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsModule
              devices={devices}
              orders={orders}
              retailers={retailers}
              installments={installments}
              grades={grades}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsModule
              settings={settings}
              exchangeRate={exchangeRate}
              onUpdateExchangeRate={setExchangeRate}
              onSaveSettings={(st) => DataService.saveSettings(st)}
              onResetDemoData={handleResetDemoData}
            />
          )}
        </div>
      </main>

      {/* Global Search Modal (Cmd+K) */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        devices={devices}
        orders={orders}
        retailers={retailers}
        onNavigate={handleNavigate}
      />
    </div>
  );
}

export default App;
