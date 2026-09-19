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

const isBlank = (value) => value === undefined || value === null || value.toString().trim() === '';

// IMEI/Serial é opcional: sem valor mostra o fallback ('—' por padrão), nunca "null"/"undefined".
export const formatImei = (imei, fallback = '—') => {
  if (isBlank(imei)) return fallback;
  const cleaned = imei.toString().replace(/\D/g, '');
  if (cleaned.length === 15) {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 8)} ${cleaned.slice(8, 14)} ${cleaned.slice(14)}`;
  }
  return imei.toString().trim();
};

export const formatImeiLabel = (imei) => (isBlank(imei) ? 'IMEI não informado' : `IMEI: ${formatImei(imei)}`);

export const formatColor = (color) => (isBlank(color) ? '—' : color.toString().trim());

export const formatBattery = (health) => {
  if (isBlank(health) || Number.isNaN(Number(health))) return '—';
  return `${Number(health)}%`;
};

export const getBatteryHealthBadge = (health) => {
  return { 
    label: formatBattery(health), 
    color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700' 
  };
};

// Indicador apenas informativo: nunca impede reserva, venda, ajuste ou movimentação.
export const getDeviceCompleteness = (device) => {
  const missing = [];
  if (isBlank(device?.imei)) missing.push('IMEI / Serial');
  if (isBlank(device?.color)) missing.push('Cor');
  if (isBlank(device?.battery_health)) missing.push('Bateria');
  return { complete: missing.length === 0, missing };
};

export const getStatusBadge = (status) => {
  return { 
    label: status || '—', 
    bg: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700' 
  };
};
