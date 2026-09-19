// RISEMOBILE: seleção automática de aparelhos na venda, com cor opcional por item.
// Item sem cor = "Qualquer cor". A regra definitiva no Supabase vive em rpc_reserve_devices_for_order
// (migration 020); estas funções mantêm a tela e o motor local idênticos a ela.

export const colorKey = (color) => String(color ?? '').trim().toLowerCase();

const matchesConfig = (device, item) =>
  device.status === 'Disponível' &&
  device.model === item.model &&
  device.storage === item.storage &&
  (!item.grade_id || device.grade_id === item.grade_id);

const byBatteryDesc = (a, b) => (b.battery_health || 0) - (a.battery_health || 0);

// Cores em estoque (Disponível) para modelo + armazenamento + grade, com a quantidade de cada uma.
export const getAvailableColors = (devices, { model, storage, grade_id }) => {
  const groups = new Map();
  for (const d of devices) {
    if (!matchesConfig(d, { model, storage, grade_id })) continue;
    const key = colorKey(d.color);
    if (!key) continue;
    const group = groups.get(key) || { color: String(d.color).trim(), count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.color.localeCompare(b.color, 'pt-BR'));
};

// Quantas unidades ainda podem ser adicionadas à venda para esta configuração/cor,
// considerando o que já está no carrinho. Itens com cor escolhida são atendidos primeiro;
// "Qualquer cor" fica com o que sobrar.
export const getRemainingForItem = (devices, saleItems, candidate) => {
  const sameConfig = (it) =>
    it.model === candidate.model && it.storage === candidate.storage &&
    (!candidate.grade_id || !it.grade_id || it.grade_id === candidate.grade_id);

  const stock = devices.filter(d => matchesConfig(d, candidate));
  const totalStock = stock.length;
  const wanted = colorKey(candidate.color);

  let specificInSale = 0;
  let anyInSale = 0;
  let sameColorInSale = 0;
  for (const it of saleItems.filter(sameConfig)) {
    const qty = parseInt(it.quantity, 10) || 0;
    if (colorKey(it.color)) {
      specificInSale += qty;
      if (colorKey(it.color) === wanted) sameColorInSale += qty;
    } else {
      anyInSale += qty;
    }
  }

  const freeOverall = totalStock - specificInSale - anyInSale;
  if (!wanted) return Math.max(0, freeOverall);

  const colorStock = stock.filter(d => colorKey(d.color) === wanted).length;
  return Math.max(0, Math.min(colorStock - sameColorInSale, freeOverall));
};

// Escolhe os aparelhos de cada item. Devolve, alinhado a `items`, a lista escolhida e as faltas.
// Itens com cor são atendidos antes dos "Qualquer cor" para que estes não consumam a cor pedida.
export const allocateDevicesForItems = (devices, items) => {
  const used = new Set();
  const allocations = items.map(() => []);
  const shortages = [];

  const order = items.map((_, i) => i).sort((a, b) => {
    const aAny = colorKey(items[a].color) === '' ? 1 : 0;
    const bAny = colorKey(items[b].color) === '' ? 1 : 0;
    return aAny - bAny || a - b;
  });

  for (const i of order) {
    const item = items[i];
    const qty = parseInt(item.quantity, 10) || 0;
    const wanted = colorKey(item.color);
    const chosen = devices
      .filter(d => matchesConfig(d, item) && !used.has(d.id) && (!wanted || colorKey(d.color) === wanted))
      .sort(byBatteryDesc)
      .slice(0, qty);
    chosen.forEach(d => used.add(d.id));
    allocations[i] = chosen;
    if (chosen.length < qty) shortages.push({ index: i, requested: qty, available: chosen.length });
  }

  return { allocations, shortages };
};

// Texto do item: "iPhone 13 Pro Max 128GB Branco".
export const describeItem = (item) =>
  [item.model, item.storage, colorKey(item.color) ? String(item.color).trim() : null].filter(Boolean).join(' ');

// Linha do pedido que corresponde a um aparelho (preço unitário na devolução): prefere a linha da
// mesma cor, depois a linha sem cor, depois qualquer linha da mesma configuração.
export const findOrderItemForDevice = (items = [], device) => {
  const candidates = items.filter(it =>
    it.model === device.model && it.storage === device.storage && (!it.grade_id || it.grade_id === device.grade_id)
  );
  const key = colorKey(device.color);
  return (
    (key && candidates.find(it => colorKey(it.color) === key)) ||
    candidates.find(it => !colorKey(it.color)) ||
    candidates[0] ||
    null
  );
};

// Confere se o que o servidor devolveu respeita as cores pedidas (protege contra a função
// antiga do banco, sem a migration 020, que ignoraria a cor). Retorna a descrição do 1º problema.
export const findColorMismatch = (items, allocatedDevices = []) => {
  const wantedByKey = new Map();
  for (const it of items) {
    const key = colorKey(it.color);
    if (!key) continue;
    const id = `${it.model}|${it.storage}|${key}`;
    wantedByKey.set(id, { item: it, qty: (wantedByKey.get(id)?.qty || 0) + (parseInt(it.quantity, 10) || 0) });
  }
  for (const [id, { item, qty }] of wantedByKey) {
    const [model, storage, key] = id.split('|');
    const got = allocatedDevices.filter(d => d.model === model && d.storage === storage && colorKey(d.color) === key).length;
    if (got < qty) return describeItem(item);
  }
  return null;
};
