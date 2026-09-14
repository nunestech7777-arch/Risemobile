import React from 'react';

export const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  icon: Icon
}) => {
  const sizes = {
    sm: 'text-[11px] px-2.5 py-0.5 font-bold',
    md: 'text-xs px-3 py-1 font-bold',
    lg: 'text-sm px-3.5 py-1.5 font-bold'
  };

  const variants = {
    default: 'bg-slate-100 text-slate-800 dark:bg-white/[0.08] dark:text-slate-200 border border-slate-200 dark:border-white/10',
    secondary: 'bg-slate-100 text-slate-900 dark:bg-white/[0.1] dark:text-white border border-slate-200 dark:border-white/15',
    neutral: 'bg-slate-100 text-slate-800 dark:bg-white/[0.06] dark:text-slate-300 border border-slate-200 dark:border-white/10',
    dark: 'bg-[#111010] text-white border border-white/15 dark:bg-white/10 dark:text-white dark:border-white/20',
    outline: 'bg-transparent text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-white/15',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    danger: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
    info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30',
    lavender: 'bg-slate-100 text-slate-900 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30',
    mint: 'bg-slate-100 text-slate-900 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    butter: 'bg-slate-100 text-slate-900 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    sky: 'bg-slate-100 text-slate-900 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md ${sizes[size]} ${variants[variant] || variants.default} ${className}`}>
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      {children}
    </span>
  );
};

