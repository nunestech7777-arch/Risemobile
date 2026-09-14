import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Bell, 
  Sun, 
  Moon, 
  Monitor, 
  Menu, 
  ChevronDown,
  RefreshCw,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { formatBRL } from '../../lib/formatters';

export const Header = ({ 
  title = 'Visão Geral', 
  subtitle,
  theme, 
  onThemeChange, 
  onOpenSearch, 
  onToggleMobileMenu,
  exchangeRate = 5.48,
  onRefreshRate,
  isRateLoading = false,
  pendingAlerts = [],
  user = null,
  onLogout
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const notifMenuRef = useRef(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userName = user?.user_metadata?.name || (user?.email ? user.email.split('@')[0] : 'Admin');
  const userEmail = user?.email || 'admin@risemobile.com';
  const userInitials = user?.user_metadata?.avatar_initials || (userName ? userName.slice(0, 2).toUpperCase() : 'RM');

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 px-1 mb-6 relative z-10">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2.5 rounded-2xl bg-white dark:bg-white/[0.05] dark:backdrop-blur-md border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 shadow-xs"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white drop-shadow-xs">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-300 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Actions Bar */}
      <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
        {/* USD / BRL Rate Pill Chip */}
        <div
          onClick={isRateLoading ? undefined : onRefreshRate}
          title={isRateLoading ? 'Atualizando cotação...' : 'Cotação USD / BRL em tempo real (Clique para atualizar)'}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-white/[0.05] dark:backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-xs text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-white/20 dark:hover:bg-white/[0.08] transition-all ${isRateLoading ? 'cursor-wait opacity-70' : 'cursor-pointer'}`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>1 USD = {formatBRL(exchangeRate)}</span>
          <RefreshCw className={`w-3 h-3 text-slate-400 dark:text-slate-300 transition-transform ${isRateLoading ? 'animate-spin' : 'hover:rotate-180'}`} />
        </div>

        {/* Search Pill Button */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white dark:bg-white/[0.05] dark:backdrop-blur-md border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 dark:hover:bg-white/[0.08] shadow-xs transition-all text-xs font-medium"
        >
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-300" />
          <span className="hidden sm:inline">Buscar por IMEI, Pedido...</span>
          <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-white/[0.08] rounded font-mono text-slate-400 dark:text-slate-300 border border-transparent dark:border-white/10">
            ⌘K
          </kbd>
        </button>

        {/* Notifications Bell */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2.5 rounded-full bg-white dark:bg-white/[0.05] dark:backdrop-blur-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white dark:hover:bg-white/[0.08] dark:hover:border-white/20 shadow-xs transition-all relative"
            aria-label="Notificações"
          >
            <Bell className="w-4 h-4" />
            {pendingAlerts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900"></span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#0D121D]/95 dark:backdrop-blur-2xl border border-slate-200 dark:border-white/15 rounded-3xl shadow-modal dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50 p-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Notificações & Alertas</h4>
                <Badge variant="mint" size="sm">{pendingAlerts.length} ativos</Badge>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/10 max-h-64 overflow-y-auto mt-2 custom-scrollbar">
                {pendingAlerts.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-300">
                    Nenhum alerta pendente no momento.
                  </div>
                ) : (
                  pendingAlerts.map((alert, i) => (
                    <div key={i} className="py-2.5 flex items-start gap-2.5 text-left">
                      <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{alert.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-300">{alert.description}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle (Light, Dark, System) */}
        <div className="flex items-center p-1 bg-white dark:bg-white/[0.05] dark:backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-full shadow-xs">
          <button
            onClick={() => onThemeChange('light')}
            className={`p-1.5 rounded-full transition-colors ${
              theme === 'light' ? 'bg-[#EDE8F8] text-[#6845B2] font-bold' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
            title="Modo Claro"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onThemeChange('dark')}
            className={`p-1.5 rounded-full transition-colors ${
              theme === 'dark' ? 'bg-white/15 text-cyan-300 font-bold shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Modo Escuro"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onThemeChange('system')}
            className={`p-1.5 rounded-full transition-colors ${
              theme === 'system' ? 'bg-slate-200 dark:bg-white/15 text-slate-900 dark:text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Acompanhar Sistema"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* User Profile Pill Container */}
        <div className="relative" ref={userMenuRef}>
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 pl-1.5 pr-3.5 py-1 rounded-full bg-white dark:bg-white/[0.05] dark:backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-xs cursor-pointer hover:border-slate-300 dark:hover:border-white/20 dark:hover:bg-white/[0.08] transition-all"
            aria-expanded={showUserMenu}
          >
            {/* Avatar circle with initials */}
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-300 via-rose-300 to-purple-400 flex items-center justify-center text-xs font-black text-slate-900 shadow-inner">
              {userInitials}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <span className="max-w-[110px] truncate">{userName}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>
          </button>

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#0D121D]/95 dark:backdrop-blur-2xl border border-slate-200 dark:border-white/15 rounded-3xl shadow-modal dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50 p-3 animate-fade-in text-left">
              {/* Profile Header */}
              <div className="px-3 py-2.5 border-b border-slate-100 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-300 to-purple-400 flex items-center justify-center text-xs font-black text-slate-900 shadow-inner">
                    {userInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {userName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {userEmail}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Sessão Supabase Ativa</span>
                </div>
              </div>

              {/* Menu Actions */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair do Sistema</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

