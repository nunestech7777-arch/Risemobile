// RISEMOBILE: Formatters and Calculations

export const formatUSD = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatBRL = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatCurrency = (val, currency = 'USD') => {
  return currency === 'BRL' ? formatBRL(val) : formatUSD(val);
};

export const formatDate = (dateString, includeTime = false) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  
  if (includeTime) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

export const formatPercent = (val) => {
  const num = Number(val) || 0;
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};

export const formatImei = (imei) => {
  if (!imei) return '—';
  const cleaned = imei.toString().replace(/\D/g, '');
  if (cleaned.length === 15) {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 8)} ${cleaned.slice(8, 14)} ${cleaned.slice(14)}`;
  }
  return imei;
};

export const getBatteryHealthBadge = (health) => {
  const val = Number(health) || 0;
  return { 
    label: `${val}%`, 
    color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700' 
  };
};

export const getStatusBadge = (status) => {
  return { 
    label: status || '—', 
    bg: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700' 
  };
};
