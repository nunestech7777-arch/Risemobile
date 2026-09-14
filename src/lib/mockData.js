// RISEMOBILE: Initial Demo Dataset

export const INITIAL_GRADES = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'A++', description: 'Impecável, sem marcas, bateria 88%+', badge_color: 'mint', is_active: true },
  { id: '22222222-2222-2222-2222-222222222222', name: 'AB+', description: 'Excelente estado, micro-detalhes mínimos, bateria 85%+', badge_color: 'lavender', is_active: true },
  { id: '33333333-3333-3333-3333-333333333333', name: 'B-', description: 'Sinais leves de uso estético, 100% funcional', badge_color: 'butter', is_active: true }
];

export const INITIAL_RETAILERS = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    store_name: 'iStore Prime SP',
    contact_name: 'Rodrigo Mendes',
    phone: '+55 11 98888-1111',
    whatsapp: '5511988881111',
    document: '28.910.456/0001-89',
    city: 'São Paulo',
    state: 'SP',
    address: 'Rua Santa Ifigênia, 450 - Sala 12',
    notes: 'Cliente VIP - Alto volume semanal',
    created_at: '2026-08-01T10:00:00Z'
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    store_name: 'Tech Apple Express RJ',
    contact_name: 'Fernanda Lima',
    phone: '+55 21 97777-2222',
    whatsapp: '5521977772222',
    document: '34.821.109/0001-44',
    city: 'Rio de Janeiro',
    state: 'RJ',
    address: 'Av. das Américas, 3500 - Barra',
    notes: 'Pagamentos sempre via PIX ou 50% em 15 dias',
    created_at: '2026-08-05T14:30:00Z'
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    store_name: 'Mega Imports Curitiba',
    contact_name: 'Carlos Eduardo',
    phone: '+55 41 99999-3333',
    whatsapp: '5541999993333',
    document: '19.554.321/0001-12',
    city: 'Curitiba',
    state: 'PR',
    address: 'Rua XV de Novembro, 1200',
    notes: 'Comprador frequente de lotes B- e AB+',
    created_at: '2026-08-10T11:15:00Z'
  }
];

export const INITIAL_RETAILER_REFERRALS = [
  {
    id: 'ref-1',
    referrer_name: 'Pedro',
    retailer_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    retailer_name: 'iStore Prime SP',
    commission_per_unit_usd: 1.00,
    status: 'Ativo',
    notes: 'Indicação parceiro SP',
    created_at: '2026-08-01T10:00:00Z'
  },
  {
    id: 'ref-2',
    referrer_name: 'João',
    retailer_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    retailer_name: 'Tech Apple Express RJ',
    commission_per_unit_usd: 2.00,
    status: 'Ativo',
    notes: 'Indicação filial RJ',
    created_at: '2026-08-05T14:30:00Z'
  },
  {
    id: 'ref-3',
    referrer_name: 'Lucas',
    retailer_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    retailer_name: 'Mega Imports Curitiba',
    commission_per_unit_usd: 0.50,
    status: 'Ativo',
    notes: 'Indicação Curitiba atacado',
    created_at: '2026-08-10T11:15:00Z'
  }
];

export const INITIAL_DEVICES = [
  // iPhone 13 128GB A++ (Carlos Imports)
  { id: 'dev-101', supplier_name: 'Carlos Imports', external_id: 'ext-sys-101', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-01T09:00:00Z', sync_status: 'synced', model: 'iPhone 13', storage: '128GB', grade_id: '11111111-1111-1111-1111-111111111111', color: 'Meia-noite', battery_health: 96, imei: '354890123456781', cost_price_usd: 360.00, suggested_price_usd: 440.00, status: 'Disponível', created_at: '2026-09-01T09:00:00Z' },
  { id: 'dev-102', supplier_name: 'Carlos Imports', external_id: 'ext-sys-102', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-01T09:00:00Z', sync_status: 'synced', model: 'iPhone 13', storage: '128GB', grade_id: '11111111-1111-1111-1111-111111111111', color: 'Estelar', battery_health: 92, imei: '354890123456782', cost_price_usd: 360.00, suggested_price_usd: 440.00, status: 'Disponível', created_at: '2026-09-01T09:00:00Z' },
  { id: 'dev-103', supplier_name: 'Carlos Imports', external_id: 'ext-sys-103', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-01T09:00:00Z', sync_status: 'synced', model: 'iPhone 13', storage: '128GB', grade_id: '11111111-1111-1111-1111-111111111111', color: 'Azul', battery_health: 89, imei: '354890123456783', cost_price_usd: 360.00, suggested_price_usd: 440.00, status: 'Disponível', created_at: '2026-09-01T09:00:00Z' },
  { id: 'dev-104', supplier_name: 'Carlos Imports', external_id: 'ext-sys-104', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-01T09:00:00Z', sync_status: 'synced', model: 'iPhone 13', storage: '128GB', grade_id: '11111111-1111-1111-1111-111111111111', color: 'Rosa', battery_health: 94, imei: '354890123456784', cost_price_usd: 360.00, suggested_price_usd: 440.00, status: 'Disponível', created_at: '2026-09-01T09:00:00Z' },
  { id: 'dev-105', supplier_name: 'Carlos Imports', external_id: 'ext-sys-105', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-01T09:00:00Z', sync_status: 'synced', model: 'iPhone 13', storage: '128GB', grade_id: '11111111-1111-1111-1111-111111111111', color: 'Verde', battery_health: 91, imei: '354890123456785', cost_price_usd: 360.00, suggested_price_usd: 440.00, status: 'Disponível', created_at: '2026-09-01T09:00:00Z' },

  // iPhone 13 128GB AB+ (Miami Phones)
  { id: 'dev-106', supplier_name: 'Miami Phones', external_id: 'ext-sys-106', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-01T09:00:00Z', sync_status: 'synced', model: 'iPhone 13', storage: '128GB', grade_id: '22222222-2222-2222-2222-222222222222', color: 'Meia-noite', battery_health: 87, imei: '354890123456786', cost_price_usd: 330.00, suggested_price_usd: 410.00, status: 'Disponível', created_at: '2026-09-01T09:00:00Z' },
  { id: 'dev-107', supplier_name: 'Miami Phones', external_id: 'ext-sys-107', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-01T09:00:00Z', sync_status: 'synced', model: 'iPhone 13', storage: '128GB', grade_id: '22222222-2222-2222-2222-222222222222', color: 'Estelar', battery_health: 86, imei: '354890123456787', cost_price_usd: 330.00, suggested_price_usd: 410.00, status: 'Disponível', created_at: '2026-09-01T09:00:00Z' },

  // iPhone 14 128GB A++ (Miami Phones)
  { id: 'dev-108', supplier_name: 'Miami Phones', external_id: 'ext-sys-108', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-02T10:00:00Z', sync_status: 'synced', model: 'iPhone 14', storage: '128GB', grade_id: '11111111-1111-1111-1111-111111111111', color: 'Roxo', battery_health: 98, imei: '354890123456788', cost_price_usd: 460.00, suggested_price_usd: 560.00, status: 'Disponível', created_at: '2026-09-02T10:00:00Z' },
  { id: 'dev-109', supplier_name: 'Miami Phones', external_id: 'ext-sys-109', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-02T10:00:00Z', sync_status: 'synced', model: 'iPhone 14', storage: '128GB', grade_id: '11111111-1111-1111-1111-111111111111', color: 'Azul', battery_health: 95, imei: '354890123456789', cost_price_usd: 460.00, suggested_price_usd: 560.00, status: 'Disponível', created_at: '2026-09-02T10:00:00Z' },
  { id: 'dev-110', supplier_name: 'Miami Phones', external_id: 'ext-sys-110', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-02T10:00:00Z', sync_status: 'synced', model: 'iPhone 14', storage: '128GB', grade_id: '11111111-1111-1111-1111-111111111111', color: 'Estelar', battery_health: 91, imei: '354890123456790', cost_price_usd: 460.00, suggested_price_usd: 560.00, status: 'Disponível', created_at: '2026-09-02T10:00:00Z' },

  // iPhone 14 Pro 256GB A++ (ABC Mobile)
  { id: 'dev-111', supplier_name: 'ABC Mobile', external_id: 'ext-sys-111', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-03T11:00:00Z', sync_status: 'synced', model: 'iPhone 14 Pro', storage: '256GB', grade_id: '11111111-1111-1111-1111-111111111111', color: 'Roxo-profundo', battery_health: 93, imei: '354890123456791', cost_price_usd: 650.00, suggested_price_usd: 780.00, status: 'Disponível', created_at: '2026-09-03T11:00:00Z' },
  { id: 'dev-112', supplier_name: 'ABC Mobile', external_id: 'ext-sys-112', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-03T11:00:00Z', sync_status: 'synced', model: 'iPhone 14 Pro', storage: '256GB', grade_id: '11111111-1111-1111-1111-111111111111', color: 'Preto-espacial', battery_health: 90, imei: '354890123456792', cost_price_usd: 650.00, suggested_price_usd: 780.00, status: 'Disponível', created_at: '2026-09-03T11:00:00Z' },

  // iPhone 15 Pro 128GB A++ (Carlos Imports)
  { id: 'dev-113', supplier_name: 'Carlos Imports', external_id: 'ext-sys-113', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-04T12:00:00Z', sync_status: 'synced', model: 'iPhone 15 Pro', storage: '128GB', grade_id: '11111111-1111-1111-1111-111111111111', color: 'Titânio Natural', battery_health: 99, imei: '354890123456793', cost_price_usd: 780.00, suggested_price_usd: 920.00, status: 'Disponível', created_at: '2026-09-04T12:00:00Z' },
  { id: 'dev-114', supplier_name: 'Carlos Imports', external_id: 'ext-sys-114', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-04T12:00:00Z', sync_status: 'synced', model: 'iPhone 15 Pro', storage: '128GB', grade_id: '11111111-1111-1111-1111-111111111111', color: 'Titânio Azul', battery_health: 97, imei: '354890123456794', cost_price_usd: 780.00, suggested_price_usd: 920.00, status: 'Disponível', created_at: '2026-09-04T12:00:00Z' },
  { id: 'dev-115', supplier_name: 'Carlos Imports', external_id: 'ext-sys-115', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-04T12:00:00Z', sync_status: 'synced', model: 'iPhone 15 Pro', storage: '128GB', grade_id: '11111111-1111-1111-1111-111111111111', color: 'Titânio Preto', battery_health: 95, imei: '354890123456795', cost_price_usd: 780.00, suggested_price_usd: 920.00, status: 'Disponível', created_at: '2026-09-04T12:00:00Z' },

  // iPhone 15 Pro Max 256GB A++ (Carlos Imports)
  { id: 'dev-116', supplier_name: 'Carlos Imports', external_id: 'ext-sys-116', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-05T14:00:00Z', sync_status: 'synced', model: 'iPhone 15 Pro Max', storage: '256GB', grade_id: '11111111-1111-1111-1111-111111111111', color: 'Titânio Natural', battery_health: 100, imei: '354890123456796', cost_price_usd: 920.00, suggested_price_usd: 1090.00, status: 'Disponível', created_at: '2026-09-05T14:00:00Z' },
  { id: 'dev-117', supplier_name: 'Carlos Imports', external_id: 'ext-sys-117', external_source: 'EXTERNAL_SYSTEM', last_synced_at: '2026-09-05T14:00:00Z', sync_status: 'synced', model: 'iPhone 15 Pro Max', storage: '256GB', grade_id: '11111111-1111-1111-1111-111111111111', color: 'Titânio Branco', battery_health: 98, imei: '354890123456797', cost_price_usd: 920.00, suggested_price_usd: 1090.00, status: 'Disponível', created_at: '2026-09-05T14:00:00Z' }
];

export const INITIAL_ORDERS = [
  {
    id: 'ord-001',
    order_number: 'PED-2026-001',
    retailer_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    retailer_name: 'iStore Prime SP',
    status: 'Finalizado',
    total_amount_usd: 1320.00,
    paid_amount_usd: 1320.00,
    balance_due_usd: 0.00,
    total_commission_usd: 45.00,
    total_profit_usd: 240.00,
    created_at: '2026-09-08T15:30:00Z',
    finalized_at: '2026-09-08T16:00:00Z',
    items: [
      { id: 'item-1', model: 'iPhone 13', storage: '128GB', grade_name: 'A++', quantity: 3, unit_price_usd: 440.00, total_price_usd: 1320.00 }
    ],
    allocated_devices: [
      { device_id: 'dev-mock-sold-1', model: 'iPhone 13', storage: '128GB', imei: '354890123456001', color: 'Meia-noite', battery_health: 93, cost_price_usd: 360.00 },
      { device_id: 'dev-mock-sold-2', model: 'iPhone 13', storage: '128GB', imei: '354890123456002', color: 'Estelar', battery_health: 91, cost_price_usd: 360.00 },
      { device_id: 'dev-mock-sold-3', model: 'iPhone 13', storage: '128GB', imei: '354890123456003', color: 'Azul', battery_health: 90, cost_price_usd: 360.00 }
    ]
  },
  {
    id: 'ord-002',
    order_number: 'PED-2026-002',
    retailer_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    retailer_name: 'Tech Apple Express RJ',
    status: 'Finalizado',
    total_amount_usd: 2180.00,
    paid_amount_usd: 1090.00,
    balance_due_usd: 1090.00,
    total_commission_usd: 40.00,
    total_profit_usd: 340.00,
    created_at: '2026-09-10T10:00:00Z',
    finalized_at: '2026-09-10T11:00:00Z',
    items: [
      { id: 'item-2', model: 'iPhone 15 Pro Max', storage: '256GB', grade_name: 'A++', quantity: 2, unit_price_usd: 1090.00, total_price_usd: 2180.00 }
    ],
    allocated_devices: [
      { device_id: 'dev-mock-sold-4', model: 'iPhone 15 Pro Max', storage: '256GB', imei: '354890123456004', color: 'Titânio Natural', battery_health: 99, cost_price_usd: 920.00 },
      { device_id: 'dev-mock-sold-5', model: 'iPhone 15 Pro Max', storage: '256GB', imei: '354890123456005', color: 'Titânio Preto', battery_health: 98, cost_price_usd: 920.00 }
    ]
  }
];

export const INITIAL_INSTALLMENTS = [
  {
    id: 'inst-001',
    order_id: 'ord-002',
    order_number: 'PED-2026-002',
    retailer_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    retailer_name: 'Tech Apple Express RJ',
    installment_number: 1,
    amount_usd: 545.00,
    due_date: '2026-09-25',
    status: 'A vencer',
    created_at: '2026-09-10T11:00:00Z'
  },
  {
    id: 'inst-002',
    order_id: 'ord-002',
    order_number: 'PED-2026-002',
    retailer_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    retailer_name: 'Tech Apple Express RJ',
    installment_number: 2,
    amount_usd: 545.00,
    due_date: '2026-10-10',
    status: 'A vencer',
    created_at: '2026-09-10T11:00:00Z'
  }
];

export const INITIAL_MOVEMENTS = [
  { id: 'mov-1', device_id: 'dev-101', imei: '354890123456781', movement_type: 'Entrada', previous_status: null, new_status: 'Disponível', reason: 'Entrada inicial de lote', created_at: '2026-09-01T09:00:00Z' },
  { id: 'mov-2', device_id: 'dev-102', imei: '354890123456782', movement_type: 'Entrada', previous_status: null, new_status: 'Disponível', reason: 'Entrada inicial de lote', created_at: '2026-09-01T09:00:00Z' },
  { id: 'mov-3', device_id: 'dev-103', imei: '354890123456783', movement_type: 'Entrada', previous_status: null, new_status: 'Disponível', reason: 'Entrada inicial de lote', created_at: '2026-09-01T09:00:00Z' },
  { id: 'mov-4', device_id: 'dev-mock-sold-1', imei: '354890123456001', movement_type: 'Venda', previous_status: 'Reservado', new_status: 'Vendido', reason: 'Venda Pedido PED-2026-001', created_at: '2026-09-08T16:00:00Z' }
];

export const INITIAL_SETTINGS = {
  app_name: 'RiseMobile',
  base_currency: 'USD',
  usd_to_brl_rate: 5.48,
  auto_update_rate: true,
  company_name: 'RiseMobile Wholesale Ltd.',
  company_document: '12.345.678/0001-90'
};
