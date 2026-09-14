import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

export const Button = ({
  children,
  variant = 'primary', // primary, secondary, pastel, danger, dark, ghost, outline, white
  size = 'md',        // sm, md, lg, icon
  className = '',
  disabled = false,
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold tracking-tight transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed dark:disabled:text-slate-400 active:scale-[0.98] select-none';

  const sizes = {
    sm: 'text-xs px-3 py-1.5 rounded-md gap-1.5',
    md: 'text-sm px-4 py-2 rounded-lg gap-2',
    lg: 'text-base px-5 py-2.5 rounded-lg gap-2.5',
    icon: 'p-2 rounded-lg'
  };

  const variants = {
    primary: 'bg-[#111418] text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 dark:text-white dark:shadow-[0_0_20px_rgba(37,99,235,0.4)] shadow-sm focus:ring-slate-900 dark:focus:ring-blue-400',
    white: 'bg-white text-[#111418] hover:bg-slate-100 shadow-md focus:ring-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:border dark:border-white/10 dark:hover:bg-white/15 focus:ring-slate-400',
    dark: 'bg-[#111418] text-white hover:bg-black dark:bg-[#121824] dark:border dark:border-white/15 dark:text-white dark:hover:bg-[#182030] focus:ring-slate-800',
    pastelLavender: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-white/[0.08] dark:text-white dark:border dark:border-white/10',
    pastelMint: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-white/[0.08] dark:text-white dark:border dark:border-white/10',
    pastelButter: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-white/[0.08] dark:text-white dark:border dark:border-white/10',
    pastelSky: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-white/[0.08] dark:text-white dark:border dark:border-white/10',
    danger: 'bg-slate-900 text-white hover:bg-black dark:bg-rose-600/90 dark:text-white dark:hover:bg-rose-500 focus:ring-rose-500 shadow-sm',
    ghost: 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-200 dark:hover:text-white dark:hover:bg-white/[0.08]',
    outline: 'border border-slate-200 dark:border-white/20 bg-white/60 dark:bg-white/[0.06] dark:backdrop-blur-md text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/[0.12] dark:hover:border-white/30 focus:ring-slate-400'
  };

  const buttonClasses = twMerge(
    clsx(
      baseStyles,
      sizes[size],
      variants[variant] || variants.primary,
      className
    )
  );

  return (
    <button
      className={buttonClasses}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className="w-4 h-4 shrink-0 stroke-[2.2]" />}
          <span>{children}</span>
          {Icon && iconPosition === 'right' && <Icon className="w-4 h-4 shrink-0 stroke-[2.2]" />}
        </>
      )}
    </button>
  );
};

