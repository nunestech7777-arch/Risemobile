import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

export const Card = ({
  children,
  className = '',
  variant = 'default', // default, lavender, mint, butter, sky, darkCallout, flat
  padding = 'p-6',
  ...props
}) => {
  const variants = {
    default: 'bg-white dark:bg-[#0B1220]/90 dark:backdrop-blur-xl border border-slate-200/80 dark:border-white/12 shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-slate-900 dark:text-slate-100',
    flat: 'bg-slate-50 dark:bg-[#0D1424]/85 dark:backdrop-blur-sm border border-slate-200/80 dark:border-white/[0.08] text-slate-900 dark:text-slate-100',
    glass: 'bg-white dark:bg-[#0B1220]/92 dark:backdrop-blur-2xl border border-slate-200/80 dark:border-white/15 shadow-sm dark:shadow-[0_12px_40px_rgba(0,0,0,0.55)] text-slate-900 dark:text-slate-100',
    lavender: 'bg-white dark:bg-[#0B1220]/90 dark:backdrop-blur-xl border border-slate-200/80 dark:border-white/12 shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-slate-900 dark:text-slate-100',
    mint: 'bg-white dark:bg-[#0B1220]/90 dark:backdrop-blur-xl border border-slate-200/80 dark:border-white/12 shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-slate-900 dark:text-slate-100',
    butter: 'bg-white dark:bg-[#0B1220]/90 dark:backdrop-blur-xl border border-slate-200/80 dark:border-white/12 shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-slate-900 dark:text-slate-100',
    sky: 'bg-white dark:bg-[#0B1220]/90 dark:backdrop-blur-xl border border-slate-200/80 dark:border-white/12 shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-slate-900 dark:text-slate-100',
    darkCallout: 'card-callout-dark shadow-sm'
  };

  const cardClasses = twMerge(
    clsx(
      'rounded-none',
      variants[variant] || variants.default,
      padding,
      'transition-all duration-200',
      className
    )
  );

  return (
    <div
      className={cardClasses}
      {...props}
    >
      {children}
    </div>
  );
};
