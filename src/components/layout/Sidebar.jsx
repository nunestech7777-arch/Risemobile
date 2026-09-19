import React, { useState } from 'react';
import { 
  LayoutGrid, 
  PackagePlus,
  Users, 
  ShoppingBag, 
  ScanLine, 
  Receipt, 
  TrendingUp, 
  Award,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft
} from 'lucide-react';

import { RiseMobileLogo } from '../common/RiseMobileLogo';
import { IPhoneIcon } from '../common/IPhoneIcon';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'stock', label: 'Estoque', icon: IPhoneIcon },
  { id: 'stock_entry', label: 'Entrada de Estoque', icon: PackagePlus },
  { id: 'sales', label: 'Vendas', icon: ShoppingBag },
  { id: 'retailers', label: 'Lojistas', icon: Users },
  { id: 'separation', label: 'Separação & Conferência', icon: ScanLine },
  { id: 'payments', label: 'Contas a Receber', icon: Receipt },
  { id: 'commissions', label: 'Comissões', icon: Award },
  { id: 'profit', label: 'Faturamento', icon: TrendingUp },
  { id: 'reports', label: 'Relatórios & Exportação', icon: BarChart3 },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

export const Sidebar = ({ activeTab, onSelectTab, isMobile = false, onCloseMobile, onLogout }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(prev => !prev);
  };

  const isWide = isMobile || isExpanded;

  return (
    <aside 
      className={`flex flex-col justify-between py-6 bg-gradient-to-b from-[#111010] to-[#393D42] dark:from-[#0D121D]/90 dark:via-[#0B0F19]/80 dark:to-[#080B11]/95 dark:backdrop-blur-2xl border border-white/10 dark:border-white/[0.08] text-white rounded-3xl shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] transition-all duration-300 ease-in-out relative z-40 ${
        isMobile 
          ? 'w-64 h-full px-4' 
          : isExpanded 
            ? 'w-64 px-4 h-[calc(100vh-2rem)] sticky top-4' 
            : 'w-20 px-3 h-[calc(100vh-2rem)] sticky top-4'
      }`}
    >
      {/* Top Section: Brand Logo & Navigation */}
      <div className="flex flex-col gap-6 w-full">
        {/* Brand Logo & Expand Toggle Header */}
        <div className={`flex items-center ${isWide ? 'justify-between px-1' : 'justify-center'} w-full`}>
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => {
              if (!isMobile) {
                toggleExpand();
              } else {
                onSelectTab('dashboard');
                if (onCloseMobile) onCloseMobile();
              }
            }}
            title={isExpanded ? "Recolher menu" : "Expandir menu"}
          >
            {/* Dynamic Brand Logo (Light: /logo.png, Dark: Glowing 3D Prism Emblem) */}
            <RiseMobileLogo isExpanded={isWide} size="md" />
          </div>

          {/* Desktop Toggle Arrow / Button */}
          {!isMobile && (
            <button
              onClick={toggleExpand}
              title={isExpanded ? "Recolher menu lateral" : "Expandir para ver o texto"}
              className={`p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors ${
                !isExpanded ? 'hidden' : 'flex'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Items List */}
        <nav className="flex flex-col gap-1.5 w-full">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.id === 'sales' && activeTab === 'orders');
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (isMobile && onCloseMobile) onCloseMobile();
                }}
                className={`relative group flex items-center h-12 rounded-2xl transition-all duration-200 hover:z-50 ${
                  isWide ? 'px-3.5 justify-start gap-3.5 w-full' : 'w-12 justify-center mx-auto'
                } ${
                  isActive
                    ? 'bg-white text-[#111418] dark:bg-white/[0.14] dark:text-white dark:border dark:border-white/20 dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] dark:backdrop-blur-md shadow-lg font-bold'
                    : 'text-slate-400 dark:text-slate-300 hover:text-white hover:bg-white/10 dark:hover:bg-white/[0.07]'
                }`}
              >
                {/* Icon */}
                <Icon className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />

                {/* Active Indicator dot / notch for collapsed state */}
                {isActive && !isWide && (
                  <span className="absolute -left-1 w-1.5 h-4 bg-[#EDE8F8] dark:bg-cyan-400 dark:shadow-[0_0_8px_rgba(56,189,248,0.8)] rounded-r-full" />
                )}

                {/* Text Label (Visible when expanded to the right) */}
                {isWide ? (
                  <span className="text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis animate-in fade-in duration-200">
                    {item.label}
                  </span>
                ) : (
                  /* Hover Tooltip when collapsed */
                  <div className="absolute left-[68px] px-3.5 py-2 bg-[#111418] dark:bg-[#0D121D] text-white text-xs font-bold rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 whitespace-nowrap z-50 border border-slate-700/80 dark:border-white/15 drop-shadow-2xl">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Logout */}
      <div className="flex flex-col gap-2 w-full pt-4 border-t border-white/10">
        <button
          onClick={() => {
            if (onLogout) {
              onLogout();
            } else if (window.confirm('Deseja recarregar o sistema RiseMobile?')) {
              window.location.reload();
            }
          }}
          title="Sair do Sistema"
          className={`flex items-center h-11 rounded-2xl text-slate-400 dark:text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer ${
            isWide ? 'px-3.5 justify-start gap-3.5 w-full' : 'w-12 justify-center mx-auto'
          }`}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {isWide && (
            <span className="text-xs font-semibold whitespace-nowrap">Sair</span>
          )}
        </button>
      </div>
    </aside>
  );
};



