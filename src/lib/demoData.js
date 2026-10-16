// RISEMOBILE: Conta demo com dados 100% fictícios
// Tudo é gerado pelo próprio motor local do DataService (entradas de estoque, reservas,
// vendas, parcelas, devolução...), então os dados têm exatamente o formato do app.
// Nunca toca no Supabase: enquanto a conta demo está ativa, o cliente de dados usa só o
// armazenamento local do navegador (chaves "demo:").
import { DataService, demoStorage, setDemoMode, STORAGE_KEYS } from './supabaseClient.js';
import { INITIAL_GRADES, INITIAL_SETTINGS } from './mockData.js';

export const DEMO_EMAIL = 'demo@risemobile.com';
export const DEMO_PASSWORD = 'demo123';

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 78;

const GRADE = Object.fromEntries(INITIAL_GRADES.map((g) => [g.name, g.id]));

const RETAILERS = [
  { key: 'techcell', store_name: 'TechCell Eletrônicos', contact_name: 'Carla Mendes', city: 'São Paulo', state: 'SP', commission: 8 },
  { key: 'mundo', store_name: 'Mundo Apple Store', contact_name: 'Ricardo Alves', city: 'Belo Horizonte', state: 'MG', commission: 6 },
  { key: 'icenter', store_name: 'iCenter Goiânia', contact_name: 'Patrícia Souza', city: 'Goiânia', state: 'GO', commission: 8 },
  { key: 'riocell', store_name: 'Rio Cell Importados', contact_name: 'Bruno Carvalho', city: 'Rio de Janeiro', state: 'RJ', commission: 5 },
  { key: 'sul', store_name: 'Sul Mobile', contact_name: 'Fernando Klein', city: 'Curitiba', state: 'PR', commission: 0 },
  { key: 'nordeste', store_name: 'Nordeste Phones', contact_name: 'Aline Barros', city: 'Fortaleza', state: 'CE', commission: 0 }
];

const AGENTS = [
  { key: 'carlos', name: 'Carlos Demo', email: 'carlos.demo@example.com', phone: '(11) 90000-1001', is_active: true, retailers: ['techcell', 'icenter'] },
  { key: 'fernanda', name: 'Fernanda Demo', email: 'fernanda.demo@example.com', phone: '(31) 90000-1002', is_active: true, retailers: ['mundo', 'riocell'] },
  { key: 'marcos', name: 'Marcos Demo (inativo)', email: 'marcos.demo@example.com', phone: '(21) 90000-1003', is_active: false, retailers: [] }
];

// units: [cor, bateria]. IMEIs fictícios são gerados em sequência (990000000000001...).
const stockUnits = (list) => list.map(([color, battery_health]) => ({ color, battery_health }));

const BATCHES = [
  {
    day: -75, reference_code: 'LOTE-MIA-001', notes: 'Miami — lote demonstrativo',
    items: [
      { model: 'iPhone 13', storage: '128GB', grade: 'A++', cost: 330, price: 410, units: stockUnits([['Meia-noite', 94], ['Meia-noite', 92], ['Estelar', 91], ['Estelar', 90], ['Azul', 89], ['Azul', 88]]) },
      { model: 'iPhone 14', storage: '128GB', grade: 'AB+', cost: 395, price: 490, units: stockUnits([['Preto', 90], ['Preto', 88], ['Azul', 87], ['Roxo Profundo', 86], ['Roxo Profundo', 85]]) },
      { model: 'iPhone 14 Pro', storage: '256GB', grade: 'A++', cost: 640, price: 780, units: stockUnits([['Roxo Profundo', 93], ['Preto', 91], ['Dourado', 90], ['Prateado', 89]]) }
    ]
  },
  {
    day: -50, reference_code: 'LOTE-MIA-002', notes: 'Miami — lote demonstrativo',
    items: [
      { model: 'iPhone 15', storage: '128GB', grade: 'A++', cost: 540, price: 660, units: stockUnits([['Rosa', 97], ['Rosa', 95], ['Preto', 96], ['Preto', 94], ['Azul', 93], ['Verde', 92]]) },
      { model: 'iPhone 15 Pro', storage: '256GB', grade: 'A++', cost: 790, price: 940, units: stockUnits([['Titânio Natural', 98], ['Titânio Natural', 96], ['Titânio Preto', 95], ['Titânio Preto', 94], ['Titânio Branco', 93]]) },
      { model: 'iPhone 13', storage: '128GB', grade: 'B-', cost: 290, price: 365, units: stockUnits([['Preto', 84], ['Preto', 83], ['Branco', 82], ['Azul', 81]]) }
    ]
  },
  {
    day: -22, reference_code: 'LOTE-ORL-003', notes: 'Orlando — lote demonstrativo',
    items: [
      { model: 'iPhone 16', storage: '128GB', grade: 'A++', cost: 700, price: 850, units: stockUnits([['Preto', 99], ['Branco', 98], ['Rosa', 97], ['Verde', 96], ['Verde', 95]]) },
      { model: 'iPhone 16 Pro', storage: '256GB', grade: 'A++', cost: 930, price: 1100, units: stockUnits([['Titânio Deserto', 99], ['Titânio Deserto', 98], ['Titânio Preto', 97], ['Titânio Natural', 96]]) },
      { model: 'iPhone 17', storage: '256GB', grade: 'A++', cost: 960, price: 1120, units: stockUnits([['Amarelo', 100], ['Vermelho', 100], ['Preto', 99], ['Branco', 99]]) }
    ]
  },
  {
    day: -6, reference_code: 'LOTE-MIA-004', notes: 'Miami — reposição demonstrativa',
    items: [
      { model: 'iPhone 14', storage: '128GB', grade: 'AB+', cost: 400, price: 495, units: stockUnits([['Azul', 91], ['Preto', 90], ['Roxo Profundo', 89], ['Preto', 88]]) },
      { model: 'iPhone 16 Pro', storage: '256GB', grade: 'A++', cost: 935, price: 1105, units: stockUnits([['Titânio Preto', 98], ['Titânio Natural', 97], ['Titânio Deserto', 96]]) }
    ]
  }
];

const it = (model, storage, grade, quantity, unit_price_usd, color) => ({
  model, storage, grade_id: GRADE[grade], quantity, unit_price_usd, ...(color ? { color } : {})
});

// parcels: [{ in: dias após a venda, paid: boolean }] — divide o saldo (total - entrada) em partes iguais.
const SALES = [
  { day: -68, key: 'S1', retailer: 'techcell', items: [it('iPhone 13', '128GB', 'A++', 3, 415)], upfront: 'all', method: 'PIX' },
  { day: -64, key: 'S2', retailer: 'mundo', items: [it('iPhone 14', '128GB', 'AB+', 2, 495), it('iPhone 14 Pro', '256GB', 'A++', 1, 785)], upfront: 900, method: 'Dólar', parcels: [{ in: 30, paid: true }, { in: 60, paid: true }] },
  { day: -58, key: 'S3', retailer: 'icenter', items: [it('iPhone 14 Pro', '256GB', 'A++', 2, 785)], upfront: 'all', method: 'Transferência' },
  { day: -52, key: 'S4', retailer: 'riocell', items: [it('iPhone 13', '128GB', 'A++', 3, 410)], upfront: 400, method: 'PIX', parcels: [{ in: 15, paid: true }, { in: 30, paid: true }] },
  { day: -45, key: 'S5', retailer: 'sul', items: [it('iPhone 15', '128GB', 'A++', 1, 665, 'Rosa'), it('iPhone 15', '128GB', 'A++', 1, 665, 'Azul')], upfront: 'all', method: 'Cartão' },
  { day: -38, key: 'S6', retailer: 'techcell', items: [it('iPhone 15 Pro', '256GB', 'A++', 3, 945)], upfront: 1000, method: 'PIX', parcels: [{ in: 20, paid: true }, { in: 40, paid: true }, { in: 60, paid: false }] },
  { day: -30, key: 'S7', retailer: 'mundo', items: [it('iPhone 15 Pro', '256GB', 'A++', 2, 950), it('iPhone 13', '128GB', 'B-', 1, 370)], upfront: 1200, method: 'Dólar', parcels: [{ in: 20, paid: true }, { in: 45, paid: false }] },
  { day: -25, key: 'S8', retailer: 'nordeste', items: [it('iPhone 15', '128GB', 'A++', 1, 665, 'Verde'), it('iPhone 15', '128GB', 'A++', 1, 665, 'Preto')], upfront: 330, method: 'PIX', parcels: [{ in: 20, paid: false }, { in: 50, paid: false }] },
  { day: -15, key: 'S9', retailer: 'icenter', items: [it('iPhone 16', '128GB', 'A++', 2, 855), it('iPhone 16 Pro', '256GB', 'A++', 1, 1105, 'Titânio Natural')], upfront: 'all', method: 'PIX' },
  { day: -10, key: 'S10', retailer: 'riocell', items: [it('iPhone 16 Pro', '256GB', 'A++', 2, 1105, 'Titânio Deserto')], upfront: 700, method: 'Dólar', parcels: [{ in: 9, paid: true }, { in: 25, paid: false }, { in: 40, paid: false }] },
  { day: -5, key: 'S11', retailer: 'techcell', items: [it('iPhone 17', '256GB', 'A++', 1, 1125, 'Amarelo'), it('iPhone 17', '256GB', 'A++', 1, 1125, 'Vermelho')], upfront: 'all', method: 'Transferência' },
  { day: -2, key: 'S12', retailer: 'sul', items: [it('iPhone 14', '128GB', 'AB+', 2, 495)], upfront: 300, method: 'PIX', parcels: [{ in: 15, paid: false }, { in: 30, paid: false }] }
];

const round2 = (n) => Math.round(n * 100) / 100;

// Relógio falso: as datas de criação dos registros ficam espalhadas pelo histórico
// (o motor local carimba tudo com `new Date()`). Cada leitura avança 1 ms, o que
// também mantém únicos os ids gerados a partir de Date.now().
const withFakeClock = async (fn) => {
  const RealDate = Date;
  const base = RealDate.now();
  let now = base - HISTORY_DAYS * DAY_MS;

  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(now);
        now += 1;
      } else {
        super(...args);
      }
    }
    static now() {
      const value = now;
      now += 1;
      return value;
    }
  }

  const setDay = (dayOffset) => {
    const target = base + dayOffset * DAY_MS;
    if (target > now) now = target;
  };
  const isoDay = (dayOffset) => new RealDate(base + dayOffset * DAY_MS).toISOString().split('T')[0];

  globalThis.Date = FakeDate;
  try {
    return await fn({ setDay, isoDay });
  } finally {
    globalThis.Date = RealDate;
  }
};

// O motor local grava o status da parcela só na criação; recalcula em relação a hoje.
const refreshInstallmentStatuses = () => {
  const today = new Date().toISOString().split('T')[0];
  const installments = demoStorage.get(STORAGE_KEYS.INSTALLMENTS, []).map((inst) => {
    if (inst.status === 'Pago') return inst;
    const status = inst.due_date < today ? 'Vencido' : inst.due_date === today ? 'Vence hoje' : 'A vencer';
    return { ...inst, status };
  });
  demoStorage.set(STORAGE_KEYS.INSTALLMENTS, installments);
};

export const seedDemoData = async () => {
  setDemoMode(true);
  demoStorage.clear();

  const retailers = {};
  const agents = {};
  const orders = {};
  const events = [];
  let imeiCounter = 0;
  const on = (day, run) => events.push({ day, run });

  await withFakeClock(async ({ setDay, isoDay }) => {
    setDay(-HISTORY_DAYS);
    await DataService.saveSettings({ ...INITIAL_SETTINGS, company_name: 'Demo Importadora Ltda.', company_document: '00.000.000/0001-00' });

    // Comissionados e lojistas (com indicações)
    for (const a of AGENTS) {
      agents[a.key] = await DataService.saveCommissionAgent({
        name: a.name, email: a.email, phone: a.phone, is_active: a.is_active, password: 'demo123'
      });
    }
    for (const [i, r] of RETAILERS.entries()) {
      const n = String(i + 1).padStart(2, '0');
      retailers[r.key] = await DataService.saveRetailer({
        store_name: r.store_name,
        contact_name: r.contact_name,
        phone: `(11) 90000-00${n}`,
        whatsapp: `551190000${n}00`,
        document: `00.000.000/00${n}-00`,
        city: r.city,
        state: r.state,
        address: 'Endereço fictício, 100',
        notes: 'Cliente fictício da conta demo',
        commission_per_unit_usd: r.commission
      });
    }
    for (const a of AGENTS) {
      for (const retailerKey of a.retailers) {
        const r = RETAILERS.find((x) => x.key === retailerKey);
        await DataService.saveRetailerReferral({
          agent_id: agents[a.key].id,
          referrer_name: a.name,
          retailer_id: retailers[retailerKey].id,
          retailer_name: r.store_name,
          commission_per_unit_usd: r.commission,
          notes: 'Indicação fictícia'
        });
      }
    }

    // Linha do tempo: entradas de estoque, vendas, pagamentos de parcelas, devolução, ajuste e pedidos em aberto
    for (const batch of BATCHES) {
      on(batch.day, () => DataService.createStockEntryBatchMulti(
        { reference_code: batch.reference_code, notes: batch.notes },
        batch.items.map((item) => ({
          model: item.model,
          storage: item.storage,
          grade_id: GRADE[item.grade],
          unit_cost_usd: String(item.cost),
          suggested_price_usd: String(item.price),
          units: item.units.map((u) => ({
            ...u,
            imei: String(990000000000000 + (imeiCounter += 1)),
            cost_price_usd: String(item.cost),
            suggested_price_usd: String(item.price)
          }))
        })),
        'demo'
      ));
    }

    for (const sale of SALES) {
      on(sale.day, async () => {
        const order = await DataService.reserveOrder(
          { retailer_id: retailers[sale.retailer].id, notes: 'Pedido fictício da conta demo' },
          sale.items
        );
        orders[sale.key] = order;

        const total = sale.items.reduce((sum, i) => sum + i.quantity * i.unit_price_usd, 0);
        const upfront = sale.upfront === 'all' ? total : sale.upfront;
        const payments = [{ amount_usd: upfront, method: sale.method, exchange_rate: 5.48, notes: 'Pagamento fictício' }];

        const parcels = sale.parcels || [];
        const balance = total - upfront;
        const installments = parcels.map((p, idx) => {
          const share = idx === parcels.length - 1
            ? round2(balance - round2(balance / parcels.length) * (parcels.length - 1))
            : round2(balance / parcels.length);
          return { amount_usd: share, due_date: isoDay(sale.day + p.in) };
        });

        await DataService.finalizeOrderSale(order.id, payments, installments);

        // Parcelas quitadas pelo cliente na data do vencimento (nunca no futuro)
        parcels.forEach((p, idx) => {
          if (!p.paid) return;
          on(Math.min(sale.day + p.in, -1), async () => {
            const inst = (await DataService.getInstallments())
              .find((i) => i.order_id === order.id && i.installment_number === idx + 1);
            if (inst) await DataService.payInstallment(inst.id, { method: sale.method === 'Dólar' ? 'PIX' : sale.method });
          });
        });
      });
    }

    on(-24, async () => {
      const sold = orders.S7?.allocated_devices?.[0];
      if (sold) await DataService.registerSaleReturn(orders.S7.id, [sold.device_id], 'Defeito', 'Aparelho devolvido com falha no alto-falante (demo)', 'demo');
    });

    on(-20, async () => {
      const spare = (await DataService.getDevices()).find((d) => d.model === 'iPhone 13' && d.status === 'Disponível' && d.grade_id === GRADE['B-']);
      if (spare) await DataService.adjustStock(spare.id, 'Defeito de fábrica', 'Tela com manchas — retirado do estoque (demo)');
    });

    on(-12, async () => {
      const cancelled = await DataService.reserveOrder(
        { retailer_id: retailers.nordeste.id, notes: 'Pedido fictício da conta demo' },
        [it('iPhone 13', '128GB', 'B-', 2, 370)]
      );
      await DataService.cancelOrder(cancelled.id, 'Cliente desistiu da compra (demo)');
    });

    on(-1, async () => {
      const order = await DataService.reserveOrder(
        { retailer_id: retailers.icenter.id, notes: 'Pedido fictício da conta demo — aguardando separação' },
        [it('iPhone 17', '256GB', 'A++', 1, 1130, 'Preto'), it('iPhone 17', '256GB', 'A++', 1, 1130, 'Branco')]
      );
      await DataService.markDeviceAsSeparated(order.id, order.allocated_devices[0].device_id);
    });

    on(-0.1, () => DataService.reserveOrder(
      { retailer_id: retailers.mundo.id, notes: 'Pedido fictício da conta demo — recém reservado' },
      [it('iPhone 16 Pro', '256GB', 'A++', 1, 1105)]
    ));

    // Executa em ordem cronológica (estável para o mesmo dia)
    const ordered = events.map((e, index) => ({ ...e, index })).sort((a, b) => a.day - b.day || a.index - b.index);
    let cursor = 0;
    while (cursor < ordered.length) {
      const event = ordered[cursor];
      setDay(event.day);
      // Eventos criados durante a execução (pagamentos de parcelas) entram na fila em ordem
      const before = events.length;
      await event.run();
      if (events.length > before) {
        const added = events.slice(before).map((e, i) => ({ ...e, index: before + i }));
        ordered.push(...added);
        const rest = ordered.slice(cursor + 1).sort((a, b) => a.day - b.day || a.index - b.index);
        ordered.length = cursor + 1;
        ordered.push(...rest);
      }
      cursor += 1;
    }
  });

  refreshInstallmentStatuses();
  return { success: true };
};
