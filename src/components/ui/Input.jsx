import React, { useEffect, useRef, useState } from 'react';

export const Input = ({
  label,
  error,
  icon: Icon,
  className = '',
  id,
  helperText,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 text-slate-400 dark:text-slate-400 pointer-events-none">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          id={inputId}
          className={`w-full bg-slate-50 dark:bg-[#111827]/90 dark:backdrop-blur-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 border text-sm rounded-xl px-4 py-2.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-500/40 focus:border-transparent ${
            Icon ? 'pl-10' : ''
          } ${
            error 
              ? 'border-rose-300 dark:border-rose-500/60 focus:ring-rose-500 bg-rose-50/20 dark:bg-rose-500/10' 
              : 'border-slate-200 dark:border-white/15 hover:border-slate-300 dark:hover:border-white/30'
          } ${className}`}
          {...props}
        />
      </div>
      {error ? (
        <span className="text-xs text-rose-500 dark:text-rose-400 font-medium">{error}</span>
      ) : helperText ? (
        <span className="text-xs text-slate-500 dark:text-slate-300">{helperText}</span>
      ) : null}
    </div>
  );
};

// Valor monetário em R$: o número digitado é exatamente o gravado (sem cotação).
// O texto digitado só é reescrito quando o valor muda por fora.
const amountText = (val) => (val === null || val === undefined ? '' : String(val));

const useBrlAmount = (value, onChange) => {
  const [text, setText] = useState(() => amountText(value));
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(amountText(value));
    }
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    setText(raw);
    lastEmitted.current = raw;
    onChange?.(raw);
  };

  return [text, handleChange];
};

// Campo compacto (células de tabela): mesmo comportamento, sem rótulo nem ícone
export const BrlAmountInput = ({ value, onChange, ...props }) => {
  const [text, handleChange] = useBrlAmount(value, onChange);
  return <input type="number" step="0.01" min="0" {...props} value={text} onChange={handleChange} />;
};

export const CurrencyInput = ({
  label,
  value,
  onChange,
  currency, // eslint-disable-line no-unused-vars -- a entrada é sempre em R$
  error,
  className = '',
  id,
  ...props
}) => {
  const [text, handleChange] = useBrlAmount(value, onChange);

  return (
    <Input
      label={label}
      id={id}
      type="number"
      step="0.01"
      min="0"
      value={text}
      onChange={handleChange}
      error={error}
      placeholder="0.00"
      className={className}
      icon={() => (
        <span className="text-xs font-bold text-slate-500 dark:text-slate-300">R$</span>
      )}
      {...props}
    />
  );
};

export const Select = ({
  label,
  options = [],
  error,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={`w-full bg-slate-50 dark:bg-[#111827]/90 text-slate-900 dark:text-slate-100 border text-sm rounded-xl px-4 py-2.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-500/40 focus:border-transparent ${
          error 
            ? 'border-rose-300 dark:border-rose-500/60 focus:ring-rose-500' 
            : 'border-slate-200 dark:border-white/15 hover:border-slate-300 dark:hover:border-white/30'
        } ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white dark:bg-[#0D121D] text-slate-900 dark:text-slate-100">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-rose-500 dark:text-rose-400 font-medium">{error}</span>}
    </div>
  );
};
