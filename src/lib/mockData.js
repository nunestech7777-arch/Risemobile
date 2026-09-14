// RISEMOBILE: Initial Dataset (Limpo para Produção)

export const INITIAL_GRADES = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'A++', description: 'Impecável, sem marcas, bateria 88%+', badge_color: 'mint', is_active: true },
  { id: '22222222-2222-2222-2222-222222222222', name: 'AB+', description: 'Excelente estado, micro-detalhes mínimos, bateria 85%+', badge_color: 'lavender', is_active: true },
  { id: '33333333-3333-3333-3333-333333333333', name: 'B-', description: 'Sinais leves de uso estético, 100% funcional', badge_color: 'butter', is_active: true }
];

// Base limpa e zerada para entrada de dados reais
export const INITIAL_RETAILERS = [];

export const INITIAL_RETAILER_REFERRALS = [];

export const INITIAL_DEVICES = [];

export const INITIAL_ORDERS = [];

export const INITIAL_INSTALLMENTS = [];

export const INITIAL_MOVEMENTS = [];

export const INITIAL_SETTINGS = {
  app_name: 'RiseMobile',
  base_currency: 'USD',
  usd_to_brl_rate: 5.48,
  auto_update_rate: true,
  company_name: 'RiseMobile Wholesale Ltd.',
  company_document: ''
};
