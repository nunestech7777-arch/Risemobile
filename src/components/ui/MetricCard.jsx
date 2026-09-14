import React from 'react';
import { MoreVertical } from 'lucide-react';
import { Card } from './Card';

/**
 * MetricCard Component — Minimalist, Typography-driven & Professional
 * Structured strictly with typography, spacing and visual hierarchy (No decorative icons/emojis).
 */
export const MetricCard = ({
  title,
  subtitle,
  value,
  secondaryValue,
  badgeText,
  badgeType = 'neutral', // positive, neutral, negative
  variant = 'default',
  onOptionsClick,
  className = ''
}) => {
  return (
    <Card 
      variant={variant} 
      padding="p-5 sm:p-5.5" 
      className={`relative flex flex-col justify-between transition-all duration-200 hover:border-slate-300 dark:hover:border-white/20 ${className}`}
    >
      {/* Top Header: Title & Microcopy (Left) | Action Menu (Right) */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 text-left">
          <h4 className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            {title}
          </h4>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-300 font-medium">
              {subtitle}
            </p>
          )}
        </div>

        {onOptionsClick && (
          <button 
            onClick={onOptionsClick}
            aria-label={`Opções de ${title}`}
            className="p-1 -mr-1 -mt-0.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Metric & Contextual Secondary Info */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="text-left">
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {value}
          </div>
          {secondaryValue && (
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
              {secondaryValue}
            </div>
          )}
        </div>

        {badgeText && (
          <div className="shrink-0 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-white/[0.1] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/15">
            {badgeText}
          </div>
        )}
      </div>
    </Card>
  );
};

export default MetricCard;
