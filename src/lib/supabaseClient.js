// RISEMOBILE: Supabase Client & Centralized Data Access Layer
import { createClient } from '@supabase/supabase-js';
import { 
  INITIAL_GRADES, 
  INITIAL_RETAILERS, 
  INITIAL_DEVICES, 
  INITIAL_ORDERS, 
  INITIAL_INSTALLMENTS, 
  INITIAL_MOVEMENTS,
  INITIAL_SETTINGS,
  INITIAL_RETAILER_REFERRALS
} from './mockData.js';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

export const isLiveSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.includes('supabase.co'));

export const supabase = isLiveSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Local Storage Keys
export const STORAGE_KEYS = {
  GRADES: 'risemobile_grades',
  RETAILERS: 'risemobile_retailers',
  DEVICES: 'risemobile_devices',
  ORDERS: 'risemobile_orders',
  INSTALLMENTS: 'risemobile_installments',
  MOVEMENTS: 'risemobile_movements',
  SETTINGS: 'risemobile_settings',
  AUDIT_LOGS: 'risemobile_audit_logs',
  ADJUSTMENTS: 'risemobile_adjustments',
  RETAILER_REFERRALS: 'risemobile_retailer_referrals',
  STOCK_ENTRIES: 'risemobile_stock_entries',
  COMMISSION_AGENTS: 'risemobile_commission_agents'
};

const memoryStorage = {};

const getStored = (key, fallback) => {
  try {
    if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    }
    return memoryStorage[key] !== undefined ? memoryStorage[key] : fallback;
  } catch {
    return fallback;
  }
};

const setStored = (key, val) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(val));
    }
    memoryStorage[key] = val;
  } catch (err) {
    console.error('Storage error:', err);
  }
};

const CLEAN_VERSION_KEY = 'risemobile_clean_v1_active';

// Initialize default storage if empty or migrate from legacy mock data
export const initStorageIfNeeded = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const isClean = localStorage.getItem(CLEAN_VERSION_KEY) === 'true';
      if (!isClean) {
        // Limpa dados fictícios legados para inicialização 100% limpa com dados reais
        localStorage.removeItem(STORAGE_KEYS.RETAILERS);
        localStorage.removeItem(STORAGE_KEYS.DEVICES);
        localStorage.removeItem(STORAGE_KEYS.ORDERS);
        localStorage.removeItem(STORAGE_KEYS.INSTALLMENTS);
        localStorage.removeItem(STORAGE_KEYS.MOVEMENTS);
        localStorage.removeItem(STORAGE_KEYS.ADJUSTMENTS);
        localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
        localStorage.removeItem(STORAGE_KEYS.RETAILER_REFERRALS);
        localStorage.setItem(CLEAN_VERSION_KEY, 'true');
      }

      if (!localStorage.getItem(STORAGE_KEYS.GRADES)) setStored(STORAGE_KEYS.GRADES, INITIAL_GRADES);
      if (!localStorage.getItem(STORAGE_KEYS.RETAILERS)) setStored(STORAGE_KEYS.RETAILERS, INITIAL_RETAILERS);
      if (!localStorage.getItem(STORAGE_KEYS.DEVICES)) setStored(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
      if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) setStored(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
      if (!localStorage.getItem(STORAGE_KEYS.INSTALLMENTS)) setStored(STORAGE_KEYS.INSTALLMENTS, INITIAL_INSTALLMENTS);
      if (!localStorage.getItem(STORAGE_KEYS.MOVEMENTS)) setStored(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
      if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) setStored(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
      if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) setStored(STORAGE_KEYS.AUDIT_LOGS, []);
      if (!localStorage.getItem(STORAGE_KEYS.ADJUSTMENTS)) setStored(STORAGE_KEYS.ADJUSTMENTS, []);
      if (!localStorage.getItem(STORAGE_KEYS.RETAILER_REFERRALS)) setStored(STORAGE_KEYS.RETAILER_REFERRALS, INITIAL_RETAILER_REFERRALS);
    } else {
      memoryStorage[STORAGE_KEYS.GRADES] = INITIAL_GRADES;
      memoryStorage[STORAGE_KEYS.RETAILERS] = INITIAL_RETAILERS;
      memoryStorage[STORAGE_KEYS.DEVICES] = INITIAL_DEVICES;
      memoryStorage[STORAGE_KEYS.ORDERS] = INITIAL_ORDERS;
      memoryStorage[STORAGE_KEYS.INSTALLMENTS] = INITIAL_INSTALLMENTS;
      memoryStorage[STORAGE_KEYS.MOVEMENTS] = INITIAL_MOVEMENTS;
      memoryStorage[STORAGE_KEYS.SETTINGS] = INITIAL_SETTINGS;
      memoryStorage[STORAGE_KEYS.AUDIT_LOGS] = [];
      memoryStorage[STORAGE_KEYS.ADJUSTMENTS] = [];
      memoryStorage[STORAGE_KEYS.RETAILER_REFERRALS] = INITIAL_RETAILER_REFERRALS;
    }
  } catch (e) {
    console.error('Init storage warning:', e);
  }
};

initStorageIfNeeded();

/* =========================================================================
   REPOSITÓRIO & CAMADA DE SERVIÇOS (SUPABASE + LOCAL STORAGE RPC ENGINE)
   ========================================================================= */

// Normaliza um pedido vindo do Supabase (joins) para o formato usado pelo frontend.
// allocated_devices representa somente aparelhos ATIVOS na venda (exclui devolvidos),
// para que toda a lógica existente de faturamento/comissão baseada em
// allocated_devices.length continue correta automaticamente após uma devolução.
const normalizeOrderFromSupabase = (o) => {
  const allocations = o.order_device_allocations || [];
  const toDeviceShape = (a) => ({
    device_id: a.device_id,
    imei: a.devices?.imei,
    model: a.devices?.model,
    storage: a.devices?.storage,
    grade_id: a.devices?.grade_id,
    color: a.devices?.color,
    battery_health: a.devices?.battery_health,
    cost_price_usd: a.devices?.cost_price_usd,
    separated: a.status === 'Separado' || a.status === 'Vendido'
  });

  return {
    ...o,
    retailer_name: o.retailer_name || o.retailers?.store_name || 'Lojista',
    items: o.order_items || [],
    allocated_devices: allocations.filter(a => a.status !== 'Devolvido').map(toDeviceShape),
    returned_devices: allocations.filter(a => a.status === 'Devolvido').map(toDeviceShape),
    returns: (o.sale_returns || []).map(r => ({
      id: r.id,
      reason: r.reason,
      notes: r.notes,
      created_at: r.created_at,
      created_by: r.created_by,
      total_amount_usd: r.total_amount_usd,
      total_commission_usd: r.total_commission_usd,
      items: (r.sale_return_items || []).map(ri => ({
        device_id: ri.device_id,
        imei: ri.imei,
        model: ri.model,
        storage: ri.storage,
        original_sale_price_usd: ri.original_sale_price_usd
      }))
    }))
  };
};

export const DataService = {
  // Grades
  async getGrades() {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('grades').select('*').order('name');
      if (!error && data) return data;
    }
    return getStored(STORAGE_KEYS.GRADES, INITIAL_GRADES);
  },

  async saveGrade(grade) {
    const payload = { ...grade };
    if (!payload.id || payload.id.trim() === '') {
      delete payload.id;
    }
    if (isLiveSupabaseConfigured) {
      const query = payload.id 
        ? supabase.from('grades').upsert(payload).select()
        : supabase.from('grades').insert(payload).select();
      const { data, error } = await query;
      if (error) {
        console.error('Erro ao salvar grade:', error);
        throw new Error(`Erro ao salvar grade: ${error.message}`);
      }
      if (data && data[0]) return data[0];
    }
    const grades = getStored(STORAGE_KEYS.GRADES, INITIAL_GRADES);
    let updated;
    if (payload.id) {
      updated = grades.map(g => g.id === payload.id ? { ...g, ...payload } : g);
    } else {
      const newGrade = { ...payload, id: `grade-${Date.now()}`, is_active: true };
      updated = [...grades, newGrade];
    }
    setStored(STORAGE_KEYS.GRADES, updated);
    return payload.id ? payload : updated[updated.length - 1];
  },

  // Devices / Estoque
  async getDevices() {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('devices').select('*, grades(name, badge_color)').order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    return getStored(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
  },

  // Entradas de Estoque (Lotes)
  async getStockEntries() {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('stock_entries').select('*, grades(name)').order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    return getStored(STORAGE_KEYS.STOCK_ENTRIES, []);
  },

  // Entrada Manual em Lote com Transação Atômica e Rastreabilidade
  async createStockEntryBatch(batchConfig, unitsList, userResponsavel = 'admin') {
    if (!unitsList || unitsList.length === 0) {
      throw new Error('Nenhuma unidade informada para a entrada.');
    }

    const expectedQty = parseInt(batchConfig.quantity, 10);
    if (unitsList.length !== expectedQty) {
      throw new Error(`Quantidade de unidades (${unitsList.length}) diverge do total do lote (${expectedQty}).`);
    }

    // 1. Validação estrita de duplicidade de IMEIs dentro do próprio lote
    const seenImeisInBatch = new Set();
    for (const unit of unitsList) {
      const imei = (unit.imei || '').trim();
      if (!imei) {
        throw new Error('Todas as unidades devem possuir um IMEI ou Serial preenchido.');
      }
      if (seenImeisInBatch.has(imei)) {
        throw new Error(`IMEI duplicado encontrado no mesmo lote de entrada: ${imei}`);
      }
      seenImeisInBatch.add(imei);
    }

    // 2. Se estiver usando Supabase ao vivo, tenta executar via RPC ou via tabelas diretamente
    if (isLiveSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('rpc_create_stock_entry_batch', {
          p_reference_code: batchConfig.reference_code,
          p_model: batchConfig.model,
          p_storage: batchConfig.storage,
          p_grade_id: batchConfig.grade_id,
          p_quantity: expectedQty,
          p_unit_cost_usd: parseFloat(batchConfig.unit_cost_usd) || 0,
          p_suggested_price_usd: parseFloat(batchConfig.suggested_price_usd) || 0,
          p_notes: batchConfig.notes || '',
          p_created_by: userResponsavel,
          p_source: 'manual',
          p_units: unitsList
        });

        if (!error && data) {
          return data;
        }

        // Se o erro não for função ausente, lança o erro da RPC
        const isFnMissing = error && (
          error.message?.includes('Could not find the function') ||
          error.code === '42883' ||
          error.code === 'PGRST202'
        );

        if (!isFnMissing) {
          throw new Error(error.message);
        }
      } catch (rpcErr) {
        if (!rpcErr.message?.includes('Could not find the function') && !rpcErr.message?.includes('schema cache')) {
          throw rpcErr;
        }
      }

      // Fallback para Supabase Direto (Tabelas stock_entries, devices, stock_movements)
      // Valida duplicidade contra o banco Supabase
      const { data: existingInDb } = await supabase
        .from('devices')
        .select('imei')
        .in('imei', unitsList.map(u => u.imei.trim()));

      if (existingInDb && existingInDb.length > 0) {
        throw new Error(`O IMEI ${existingInDb[0].imei} já está cadastrado no sistema.`);
      }

      let totalCost = 0;
      unitsList.forEach(u => {
        totalCost += (parseFloat(u.cost_price_usd !== undefined ? u.cost_price_usd : batchConfig.unit_cost_usd) || 0);
      });

      // Inserir registro do lote em stock_entries
      let entryId = null;
      try {
        const { data: entryData } = await supabase.from('stock_entries').insert({
          reference_code: batchConfig.reference_code,
          model: batchConfig.model,
          storage: batchConfig.storage,
          grade_id: batchConfig.grade_id,
          quantity: expectedQty,
          total_cost_usd: totalCost,
          unit_cost_usd: parseFloat(batchConfig.unit_cost_usd) || 0,
          suggested_price_usd: parseFloat(batchConfig.suggested_price_usd) || 0,
          notes: batchConfig.notes || '',
          created_by: userResponsavel,
          source: 'manual'
        }).select();

        entryId = entryData?.[0]?.id || null;
      } catch (entryErr) {
        console.warn('Inserção em stock_entries ignorada:', entryErr);
      }

      // Inserir aparelhos em devices
      const devicesToInsert = unitsList.map(u => ({
        model: batchConfig.model,
        storage: batchConfig.storage,
        grade_id: batchConfig.grade_id,
        color: u.color || 'Padrão',
        battery_health: parseInt(u.battery_health, 10) || 100,
        imei: u.imei.trim(),
        cost_price_usd: parseFloat(u.cost_price_usd !== undefined ? u.cost_price_usd : batchConfig.unit_cost_usd) || 0,
        suggested_price_usd: parseFloat(u.suggested_price_usd !== undefined ? u.suggested_price_usd : batchConfig.suggested_price_usd) || 0,
        status: 'Disponível',
        stock_entry_id: entryId,
        source: 'manual'
      }));

      const { data: insertedDevices, error: devErr } = await supabase.from('devices').insert(devicesToInsert).select();
      if (devErr) throw new Error(`Erro ao cadastrar aparelhos: ${devErr.message}`);

      // Inserir histórico em stock_movements
      if (insertedDevices && insertedDevices.length > 0) {
        const movementsToInsert = insertedDevices.map(d => ({
          device_id: d.id,
          movement_type: 'Entrada',
          previous_status: null,
          new_status: 'Disponível',
          reason: `Entrada de Estoque (Lote: ${batchConfig.reference_code})`,
          notes: `Entrada registrada por ${userResponsavel}`
        }));
        await supabase.from('stock_movements').insert(movementsToInsert);
      }

      return {
        success: true,
        reference_code: batchConfig.reference_code,
        count: insertedDevices?.length || expectedQty,
        devices_count: insertedDevices?.length || expectedQty,
        total_cost_usd: totalCost
      };
    }

    // Engine Local RPC Transacional Atômica (Fallback Offline / LocalStorage)
    const existingDevices = getStored(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
    const existingImeis = new Set(existingDevices.map(d => (d.imei || '').trim()));

    // 2. Validação estrita contra a base já cadastrada
    for (const unit of unitsList) {
      const imei = (unit.imei || '').trim();
      if (existingImeis.has(imei)) {
        throw new Error(`O IMEI ${imei} já está cadastrado no sistema.`);
      }
    }

    const entryId = `entry-${Date.now()}`;
    const timestamp = new Date().toISOString();
    let totalCost = 0;

    const newDevices = [];
    const newMovements = [];

    for (let i = 0; i < unitsList.length; i++) {
      const u = unitsList[i];
      const cost = parseFloat(u.cost_price_usd !== undefined ? u.cost_price_usd : batchConfig.unit_cost_usd) || 0;
      const price = parseFloat(u.suggested_price_usd !== undefined ? u.suggested_price_usd : batchConfig.suggested_price_usd) || (cost * 1.25);
      totalCost += cost;

      const deviceId = `dev-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`;
      const newDev = {
        id: deviceId,
        model: batchConfig.model,
        storage: batchConfig.storage,
        grade_id: batchConfig.grade_id,
        color: u.color || 'Padrão',
        battery_health: parseInt(u.battery_health, 10) || 100,
        imei: u.imei.trim(),
        cost_price_usd: cost,
        suggested_price_usd: price,
        status: 'Disponível',
        stock_entry_id: entryId,
        source: 'manual',
        created_at: timestamp,
        updated_at: timestamp
      };

      newDevices.push(newDev);

      newMovements.push({
        id: `mov-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
        device_id: deviceId,
        imei: newDev.imei,
        movement_type: 'Entrada',
        previous_status: null,
        new_status: 'Disponível',
        reason: `Entrada de Estoque (Lote: ${batchConfig.reference_code})`,
        notes: `Entrada registrada por ${userResponsavel}`,
        created_at: timestamp
      });
    }

    const newEntry = {
      id: entryId,
      reference_code: batchConfig.reference_code,
      model: batchConfig.model,
      storage: batchConfig.storage,
      grade_id: batchConfig.grade_id,
      quantity: expectedQty,
      total_cost_usd: totalCost,
      unit_cost_usd: parseFloat(batchConfig.unit_cost_usd) || 0,
      suggested_price_usd: parseFloat(batchConfig.suggested_price_usd) || 0,
      notes: batchConfig.notes || '',
      created_by: userResponsavel,
      source: 'manual',
      created_at: timestamp
    };

    // Gravação Atômica
    const stockEntries = getStored(STORAGE_KEYS.STOCK_ENTRIES, []);
    setStored(STORAGE_KEYS.STOCK_ENTRIES, [newEntry, ...stockEntries]);
    setStored(STORAGE_KEYS.DEVICES, [...newDevices, ...existingDevices]);

    const movements = getStored(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    setStored(STORAGE_KEYS.MOVEMENTS, [...newMovements, ...movements]);

    return {
      success: true,
      stock_entry: newEntry,
      count: newDevices.length,
      devices_count: newDevices.length,
      total_cost_usd: totalCost
    };
  },

  // Entrada de Lote com Múltiplos Itens/Modelos: 1 lote -> N itens -> N devices
  // header: { reference_code, notes }
  // items: [{ model, storage, grade_id, unit_cost_usd, suggested_price_usd, units: [{imei, color, battery_health, cost_price_usd, suggested_price_usd}] }]
  async createStockEntryBatchMulti(header, items, userResponsavel = 'admin') {
    if (!items || items.length === 0) {
      throw new Error('O lote precisa conter ao menos um item/configuração.');
    }

    // 1. Validação estrita de duplicidade de IMEIs entre TODOS os itens do lote
    const seenImeisInBatch = new Set();
    for (const item of items) {
      if (!item.units || item.units.length === 0) {
        throw new Error(`O item ${item.model} ${item.storage} não possui unidades.`);
      }
      for (const unit of item.units) {
        const imei = (unit.imei || '').trim();
        if (!imei) {
          throw new Error('Todas as unidades devem possuir um IMEI ou Serial preenchido.');
        }
        if (seenImeisInBatch.has(imei)) {
          throw new Error(`IMEI duplicado entre itens/configurações do mesmo lote: ${imei}`);
        }
        seenImeisInBatch.add(imei);
      }
    }

    if (isLiveSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('rpc_create_stock_entry_batch_multi', {
          p_reference_code: header.reference_code,
          p_notes: header.notes || '',
          p_created_by: userResponsavel,
          p_source: 'manual',
          p_items: items
        });
        if (!error && data) return data;

        const isFnMissing = error && (
          error.message?.includes('Could not find the function') ||
          error.code === '42883' ||
          error.code === 'PGRST202'
        );
        if (!isFnMissing) {
          throw new Error(error.message);
        }
      } catch (rpcErr) {
        if (!rpcErr.message?.includes('Could not find the function') && !rpcErr.message?.includes('schema cache')) {
          throw rpcErr;
        }
      }

      // Fluxo Direto Supabase (fallback caso a RPC ainda não tenha sido aplicada)
      const allImeis = items.flatMap(it => it.units.map(u => u.imei.trim()));
      const { data: existingInDb } = await supabase.from('devices').select('imei').in('imei', allImeis);
      if (existingInDb && existingInDb.length > 0) {
        throw new Error(`O IMEI ${existingInDb[0].imei} já está cadastrado no sistema.`);
      }

      let grandTotalCost = 0;
      let grandTotalQty = 0;

      const { data: entryData, error: entryErr } = await supabase.from('stock_entries').insert({
        reference_code: header.reference_code,
        quantity: 1,
        total_cost_usd: 0,
        notes: header.notes || '',
        created_by: userResponsavel,
        source: 'manual'
      }).select().single();
      if (entryErr) throw new Error(`Erro ao criar lote: ${entryErr.message}`);
      const stockEntryId = entryData.id;

      const itemsResult = [];

      for (const item of items) {
        const unitCost = parseFloat(item.unit_cost_usd) || 0;
        const suggestedPrice = parseFloat(item.suggested_price_usd) || 0;

        const { data: itemData, error: itemErr } = await supabase.from('stock_entry_items').insert({
          stock_entry_id: stockEntryId,
          model: item.model,
          storage: item.storage,
          grade_id: item.grade_id,
          quantity: item.units.length,
          unit_cost_usd: unitCost,
          suggested_price_usd: suggestedPrice,
          total_cost_usd: 0
        }).select().single();
        if (itemErr) throw new Error(`Erro ao criar item do lote (${item.model} ${item.storage}): ${itemErr.message}`);
        const itemId = itemData.id;

        const devicesToInsert = item.units.map(u => ({
          model: item.model,
          storage: item.storage,
          grade_id: item.grade_id,
          color: u.color || 'Padrão',
          battery_health: parseInt(u.battery_health, 10) || 100,
          imei: u.imei.trim(),
          cost_price_usd: parseFloat(u.cost_price_usd !== undefined ? u.cost_price_usd : unitCost) || 0,
          suggested_price_usd: parseFloat(u.suggested_price_usd !== undefined ? u.suggested_price_usd : suggestedPrice) || 0,
          status: 'Disponível',
          stock_entry_id: stockEntryId,
          stock_entry_item_id: itemId,
          source: 'manual'
        }));

        const { data: insertedDevices, error: devErr } = await supabase.from('devices').insert(devicesToInsert).select();
        if (devErr) throw new Error(`Erro ao cadastrar aparelhos de ${item.model} ${item.storage}: ${devErr.message}`);

        const itemTotalCost = (insertedDevices || []).reduce((s, d) => s + (parseFloat(d.cost_price_usd) || 0), 0);
        await supabase.from('stock_entry_items').update({ total_cost_usd: itemTotalCost }).eq('id', itemId);

        if (insertedDevices && insertedDevices.length > 0) {
          const movementsToInsert = insertedDevices.map(d => ({
            device_id: d.id,
            movement_type: 'Entrada',
            previous_status: null,
            new_status: 'Disponível',
            reason: `Entrada de Estoque (Lote: ${header.reference_code} — ${item.model} ${item.storage})`,
            notes: `Entrada registrada por ${userResponsavel}`
          }));
          await supabase.from('stock_movements').insert(movementsToInsert);
        }

        grandTotalCost += itemTotalCost;
        grandTotalQty += insertedDevices?.length || 0;
        itemsResult.push({
          item_id: itemId,
          model: item.model,
          storage: item.storage,
          grade_id: item.grade_id,
          quantity: insertedDevices?.length || 0,
          total_cost_usd: itemTotalCost,
          devices: insertedDevices || []
        });
      }

      await supabase.from('stock_entries').update({ quantity: grandTotalQty, total_cost_usd: grandTotalCost }).eq('id', stockEntryId);

      return {
        success: true,
        stock_entry_id: stockEntryId,
        reference_code: header.reference_code,
        total_items: items.length,
        total_quantity: grandTotalQty,
        total_cost_usd: grandTotalCost,
        items: itemsResult
      };
    }

    // Engine Local RPC Transacional Atômica (Fallback Offline / LocalStorage)
    const existingDevices = getStored(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
    const existingImeis = new Set(existingDevices.map(d => (d.imei || '').trim()));

    for (const imei of seenImeisInBatch) {
      if (existingImeis.has(imei)) {
        throw new Error(`O IMEI ${imei} já está cadastrado no sistema.`);
      }
    }

    const stockEntryId = `entry-${Date.now()}`;
    const timestamp = new Date().toISOString();
    let grandTotalCost = 0;
    let grandTotalQty = 0;

    const newDevices = [];
    const newMovements = [];
    const itemsResult = [];

    for (const item of items) {
      const itemId = `entry-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const unitCost = parseFloat(item.unit_cost_usd) || 0;
      const suggestedPrice = parseFloat(item.suggested_price_usd) || 0;
      let itemTotalCost = 0;
      const itemDevices = [];

      for (let i = 0; i < item.units.length; i++) {
        const u = item.units[i];
        const cost = parseFloat(u.cost_price_usd !== undefined ? u.cost_price_usd : unitCost) || 0;
        const price = parseFloat(u.suggested_price_usd !== undefined ? u.suggested_price_usd : suggestedPrice) || (cost * 1.25);
        itemTotalCost += cost;

        const deviceId = `dev-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`;
        const newDev = {
          id: deviceId,
          model: item.model,
          storage: item.storage,
          grade_id: item.grade_id,
          color: u.color || 'Padrão',
          battery_health: parseInt(u.battery_health, 10) || 100,
          imei: u.imei.trim(),
          cost_price_usd: cost,
          suggested_price_usd: price,
          status: 'Disponível',
          stock_entry_id: stockEntryId,
          stock_entry_item_id: itemId,
          source: 'manual',
          created_at: timestamp,
          updated_at: timestamp
        };

        newDevices.push(newDev);
        itemDevices.push(newDev);
        newMovements.push({
          id: `mov-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
          device_id: deviceId,
          imei: newDev.imei,
          movement_type: 'Entrada',
          previous_status: null,
          new_status: 'Disponível',
          reason: `Entrada de Estoque (Lote: ${header.reference_code} — ${item.model} ${item.storage})`,
          notes: `Entrada registrada por ${userResponsavel}`,
          created_at: timestamp
        });
      }

      grandTotalCost += itemTotalCost;
      grandTotalQty += item.units.length;
      itemsResult.push({
        item_id: itemId,
        model: item.model,
        storage: item.storage,
        grade_id: item.grade_id,
        quantity: item.units.length,
        unit_cost_usd: unitCost,
        suggested_price_usd: suggestedPrice,
        total_cost_usd: itemTotalCost,
        devices: itemDevices
      });
    }

    const newEntry = {
      id: stockEntryId,
      reference_code: header.reference_code,
      quantity: grandTotalQty,
      total_cost_usd: grandTotalCost,
      notes: header.notes || '',
      created_by: userResponsavel,
      source: 'manual',
      created_at: timestamp,
      items: itemsResult
    };

    const stockEntries = getStored(STORAGE_KEYS.STOCK_ENTRIES, []);
    setStored(STORAGE_KEYS.STOCK_ENTRIES, [newEntry, ...stockEntries]);
    setStored(STORAGE_KEYS.DEVICES, [...newDevices, ...existingDevices]);

    const movements = getStored(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    setStored(STORAGE_KEYS.MOVEMENTS, [...newMovements, ...movements]);

    return {
      success: true,
      stock_entry_id: stockEntryId,
      reference_code: header.reference_code,
      total_items: items.length,
      total_quantity: grandTotalQty,
      total_cost_usd: grandTotalCost,
      items: itemsResult
    };
  },

  // Importação de Aparelhos via Planilha Excel/CSV
  async importDevicesBatch(devicesList, userResponsavel = 'admin', customBatchCode = null) {
    if (!devicesList || devicesList.length === 0) {
      throw new Error('Nenhum aparelho para importar.');
    }

    const seenImeisInBatch = new Set();
    for (const unit of devicesList) {
      const imei = (unit.imei || '').trim();
      if (!imei) {
        throw new Error('Todas as linhas devem possuir um IMEI ou Serial válido.');
      }
      if (seenImeisInBatch.has(imei)) {
        throw new Error(`IMEI duplicado encontrado no arquivo de importação: ${imei}`);
      }
      seenImeisInBatch.add(imei);
    }

    const batchCode = customBatchCode || `IMP-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    let totalCost = 0;
    devicesList.forEach(u => {
      totalCost += (parseFloat(u.cost_price_usd) || 0);
    });

    if (isLiveSupabaseConfigured) {
      // Valida duplicidade contra o banco Supabase
      const { data: existingInDb } = await supabase
        .from('devices')
        .select('imei')
        .in('imei', devicesList.map(u => u.imei.trim()));

      if (existingInDb && existingInDb.length > 0) {
        throw new Error(`O IMEI ${existingInDb[0].imei} já está cadastrado no sistema.`);
      }

      let entryId = null;
      try {
        const { data: entryData } = await supabase.from('stock_entries').insert({
          reference_code: batchCode,
          model: 'Múltiplos Modelos',
          storage: 'Variado',
          grade_id: null,
          quantity: devicesList.length,
          total_cost_usd: totalCost,
          unit_cost_usd: totalCost / (devicesList.length || 1),
          suggested_price_usd: 0,
          notes: `Importação via planilha Excel/CSV (${devicesList.length} aparelhos)`,
          created_by: userResponsavel,
          source: 'import'
        }).select();

        entryId = entryData?.[0]?.id || null;
      } catch (entryErr) {
        console.warn('Inserção em stock_entries ignorada:', entryErr);
      }

      const devicesToInsert = devicesList.map(u => ({
        model: u.model || 'iPhone 13',
        storage: u.storage || '128GB',
        grade_id: u.grade_id || '11111111-1111-1111-1111-111111111111',
        color: u.color || 'Padrão',
        battery_health: parseInt(u.battery_health, 10) || 100,
        imei: u.imei.trim(),
        cost_price_usd: parseFloat(u.cost_price_usd) || 0,
        suggested_price_usd: parseFloat(u.suggested_price_usd) || 0,
        status: 'Disponível',
        stock_entry_id: entryId,
        source: 'import'
      }));

      const { data: insertedDevices, error: devErr } = await supabase.from('devices').insert(devicesToInsert).select();
      if (devErr) throw new Error(`Erro ao importar aparelhos: ${devErr.message}`);

      if (insertedDevices && insertedDevices.length > 0) {
        const movementsToInsert = insertedDevices.map(d => ({
          device_id: d.id,
          movement_type: 'Entrada',
          previous_status: null,
          new_status: 'Disponível',
          reason: `Importação de Planilha (Lote: ${batchCode})`,
          notes: `Importado por ${userResponsavel}`
        }));
        await supabase.from('stock_movements').insert(movementsToInsert);
      }

      return {
        success: true,
        reference_code: batchCode,
        count: insertedDevices?.length || devicesList.length,
        devices_count: insertedDevices?.length || devicesList.length,
        total_cost_usd: totalCost
      };
    }

    const existingDevices = getStored(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
    const existingImeis = new Set(existingDevices.map(d => (d.imei || '').trim()));

    for (const unit of devicesList) {
      const imei = (unit.imei || '').trim();
      if (existingImeis.has(imei)) {
        throw new Error(`O IMEI ${imei} já está cadastrado no sistema.`);
      }
    }

    const timestamp = new Date().toISOString();
    const entryId = `entry-${Date.now()}`;

    const newDevices = [];
    const newMovements = [];

    for (let i = 0; i < devicesList.length; i++) {
      const u = devicesList[i];
      const cost = parseFloat(u.cost_price_usd) || 0;
      const price = parseFloat(u.suggested_price_usd) || (cost * 1.25);

      const deviceId = `dev-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`;
      const newDev = {
        id: deviceId,
        model: u.model || 'iPhone 13',
        storage: u.storage || '128GB',
        grade_id: u.grade_id || '11111111-1111-1111-1111-111111111111',
        color: u.color || 'Padrão',
        battery_health: parseInt(u.battery_health, 10) || 100,
        imei: u.imei.trim(),
        cost_price_usd: cost,
        suggested_price_usd: price,
        status: 'Disponível',
        stock_entry_id: entryId,
        source: 'import',
        created_at: timestamp,
        updated_at: timestamp
      };

      newDevices.push(newDev);

      newMovements.push({
        id: `mov-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
        device_id: deviceId,
        imei: newDev.imei,
        movement_type: 'Entrada',
        previous_status: null,
        new_status: 'Disponível',
        reason: `Importação de Planilha (Lote: ${batchCode})`,
        notes: `Importado por ${userResponsavel}`,
        created_at: timestamp
      });
    }

    const newEntry = {
      id: entryId,
      reference_code: batchCode,
      model: 'Múltiplos Modelos',
      storage: 'Variado',
      grade_id: null,
      quantity: devicesList.length,
      total_cost_usd: totalCost,
      unit_cost_usd: totalCost / (devicesList.length || 1),
      suggested_price_usd: 0,
      notes: `Importação via planilha Excel/CSV (${devicesList.length} aparelhos)`,
      created_by: userResponsavel,
      source: 'import',
      created_at: timestamp
    };

    const stockEntries = getStored(STORAGE_KEYS.STOCK_ENTRIES, []);
    setStored(STORAGE_KEYS.STOCK_ENTRIES, [newEntry, ...stockEntries]);
    setStored(STORAGE_KEYS.DEVICES, [...newDevices, ...existingDevices]);

    const movements = getStored(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    setStored(STORAGE_KEYS.MOVEMENTS, [...newMovements, ...movements]);

    return {
      success: true,
      stock_entry: newEntry,
      count: newDevices.length,
      devices_count: newDevices.length,
      total_cost_usd: totalCost
    };
  },

  // Sincronização Externa Idempotente (UPSERT)
  async syncExternalDevices(externalDevicesList, sourceName = 'EXTERNAL_SYSTEM') {
    if (!Array.isArray(externalDevicesList) || externalDevicesList.length === 0) {
      return { success: true, inserted_count: 0, updated_count: 0, total_processed: 0 };
    }

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.rpc('rpc_sync_external_devices', {
        p_devices: externalDevicesList,
        p_source: sourceName
      });
      if (error) throw new Error(error.message);
      return data;
    }

    // Engine Local RPC Transacional Idempotente
    const devices = getStored(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
    const movements = getStored(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    const newMovements = [];
    const updatedDevices = [...devices];

    let insertedCount = 0;
    let updatedCount = 0;

    // Rastreia duplicidades no próprio batch
    const seenExternalIdsInBatch = new Set();
    const seenImeisInBatch = new Set();

    for (const rawDev of externalDevicesList) {
      const externalId = rawDev.external_id ? rawDev.external_id.toString().trim() : null;
      const imei = rawDev.imei ? rawDev.imei.toString().trim() : null;

      if (!imei || !rawDev.model) continue;

      if (externalId) {
        if (seenExternalIdsInBatch.has(externalId)) {
          throw new Error(`Identificador externo duplicado no mesmo lote: ${externalId}`);
        }
        seenExternalIdsInBatch.add(externalId);
      }

      if (seenImeisInBatch.has(imei)) {
        throw new Error(`IMEI duplicado no mesmo lote de sincronização: ${imei}`);
      }
      seenImeisInBatch.add(imei);

      // Localiza registro existente por external_id ou imei
      const existingIdx = updatedDevices.findIndex(d => 
        (externalId && d.external_id === externalId) || d.imei === imei
      );

      if (existingIdx !== -1) {
        // UPSERT: Atualiza dados físicos/originários
        const current = updatedDevices[existingIdx];

        // REGRA CRÍTICA DE OURO: Preservar status comercial interno
        // Um sync externo NUNCA pode transformar Reservado, Vendido ou Retirado por ajuste em Disponível
        let preservedStatus = current.status;
        if (!['Reservado', 'Vendido', 'Retirado por ajuste'].includes(current.status)) {
          preservedStatus = 'Disponível';
        }

        updatedDevices[existingIdx] = {
          ...current,
          external_id: externalId || current.external_id || `ext-${imei}`,
          external_source: sourceName,
          model: rawDev.model || current.model,
          storage: rawDev.storage || current.storage,
          grade_id: rawDev.grade_id || current.grade_id,
          color: rawDev.color || current.color,
          battery_health: rawDev.battery_health !== undefined ? rawDev.battery_health : current.battery_health,
          cost_price_usd: rawDev.cost_price_usd !== undefined ? rawDev.cost_price_usd : current.cost_price_usd,
          suggested_price_usd: rawDev.suggested_price_usd !== undefined ? rawDev.suggested_price_usd : current.suggested_price_usd,
          status: preservedStatus,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString()
        };

        updatedCount++;
      } else {
        // INSERÇÃO: Cria novo aparelho com status Disponível
        const newDevice = {
          id: `dev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          external_id: externalId || `ext-${imei}`,
          external_source: sourceName,
          model: rawDev.model,
          storage: rawDev.storage || '128GB',
          grade_id: rawDev.grade_id || '11111111-1111-1111-1111-111111111111',
          color: rawDev.color || 'Padrão',
          battery_health: rawDev.battery_health !== undefined ? rawDev.battery_health : 100,
          imei: imei,
          cost_price_usd: rawDev.cost_price_usd || 0,
          suggested_price_usd: rawDev.suggested_price_usd || ((rawDev.cost_price_usd || 0) * 1.25),
          status: 'Disponível',
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        };

        updatedDevices.unshift(newDevice);

        newMovements.push({
          id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          device_id: newDevice.id,
          imei: newDevice.imei,
          movement_type: 'Entrada',
          previous_status: null,
          new_status: 'Disponível',
          reason: `Sincronização com Sistema Externo (${sourceName})`,
          created_at: new Date().toISOString()
        });

        insertedCount++;
      }
    }

    setStored(STORAGE_KEYS.DEVICES, updatedDevices);
    if (newMovements.length > 0) {
      setStored(STORAGE_KEYS.MOVEMENTS, [...newMovements, ...movements]);
    }

    return {
      success: true,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      total_processed: insertedCount + updatedCount
    };
  },

  // Lojistas
  async getRetailers() {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('retailers').select('*').order('store_name');
      if (!error && data) return data;
    }
    return getStored(STORAGE_KEYS.RETAILERS, INITIAL_RETAILERS);
  },

  async saveRetailer(retailer) {
    if (!retailer || !retailer.store_name || !retailer.store_name.trim()) {
      throw new Error('Informe o nome da loja.');
    }

    const payload = {
      ...retailer,
      store_name: retailer.store_name.trim(),
      contact_name: retailer.contact_name !== undefined ? retailer.contact_name : '',
      phone: retailer.phone !== undefined ? retailer.phone : '',
      whatsapp: retailer.whatsapp !== undefined ? retailer.whatsapp : '',
      document: retailer.document !== undefined ? retailer.document : '',
      city: retailer.city !== undefined ? retailer.city : '',
      state: retailer.state !== undefined ? retailer.state : '',
      address: retailer.address !== undefined ? retailer.address : '',
      notes: retailer.notes !== undefined ? retailer.notes : ''
    };
    if (!payload.id || payload.id.trim() === '') {
      delete payload.id;
    }
    if (isLiveSupabaseConfigured) {
      const query = payload.id 
        ? supabase.from('retailers').upsert(payload).select()
        : supabase.from('retailers').insert(payload).select();
      const { data, error } = await query;
      if (error) {
        console.error('Erro ao salvar lojista no Supabase:', error);
        throw new Error(`Erro ao salvar lojista: ${error.message}`);
      }
      if (data && data[0]) return data[0];
    }
    const retailers = getStored(STORAGE_KEYS.RETAILERS, INITIAL_RETAILERS);
    let updated;
    if (payload.id) {
      updated = retailers.map(r => r.id === payload.id ? { ...r, ...payload } : r);
    } else {
      const newRet = { ...payload, id: `ret-${Date.now()}`, created_at: new Date().toISOString() };
      updated = [newRet, ...retailers];
    }
    setStored(STORAGE_KEYS.RETAILERS, updated);
    return payload.id ? payload : updated[0];
  },

  async deleteRetailer(id) {
    if (!id) throw new Error('ID do lojista não informado.');

    if (isLiveSupabaseConfigured) {
      // Verificar se existem pedidos vinculados ao lojista
      const { data: linkedOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('retailer_id', id)
        .limit(1);

      if (linkedOrders && linkedOrders.length > 0) {
        throw new Error('Não é possível excluir este lojista porque existem pedidos/vendas registrados para ele. Para desativar, remova ou cancele os pedidos associados primeiro.');
      }

      const { error } = await supabase.from('retailers').delete().eq('id', id);
      if (error) {
        console.error('Erro ao excluir lojista no Supabase:', error);
        throw new Error(`Erro ao excluir lojista: ${error.message}`);
      }
      return { success: true };
    }

    const orders = getStored(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    const hasOrders = orders.some(o => o.retailer_id === id);
    if (hasOrders) {
      throw new Error('Não é possível excluir este lojista porque existem pedidos/vendas registrados para ele.');
    }

    const retailers = getStored(STORAGE_KEYS.RETAILERS, INITIAL_RETAILERS);
    const updated = retailers.filter(r => r.id !== id);
    setStored(STORAGE_KEYS.RETAILERS, updated);
    return { success: true };
  },

  // Pedidos
  async getOrders() {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          retailers(store_name, contact_name),
          order_items(*),
          order_device_allocations(status, device_id, devices(id, imei, model, storage, grade_id, color, battery_health, cost_price_usd)),
          sale_returns(id, reason, notes, created_at, created_by, total_amount_usd, total_commission_usd, sale_return_items(device_id, imei, model, storage, original_sale_price_usd))
        `)
        .order('created_at', { ascending: false });
      if (!error && data) return data.map(normalizeOrderFromSupabase);
    }
    return getStored(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
  },

  // RPC / Transação: Reserva Automática e Atômica de Pedidos
  async reserveOrder(orderData, items) {
    if (isLiveSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('rpc_reserve_devices_for_order', {
          p_order_id: orderData.id || null,
          p_retailer_id: orderData.retailer_id || null,
          p_items: items,
          p_notes: orderData.notes || '',
          p_order_number: orderData.order_number || null
        });
        if (!error && data) return data;
      } catch (e) {
        console.warn('RPC rpc_reserve_devices_for_order com erro, usando fallback direto no Supabase:', e);
      }

      // Fluxo Direto no Supabase
      const { data: allAvailableDevices, error: devFetchErr } = await supabase
        .from('devices')
        .select('*')
        .eq('status', 'Disponível');

      if (devFetchErr) throw new Error(`Erro ao consultar estoque: ${devFetchErr.message}`);

      const allocatedDevices = [];
      const devicesToUpdateIds = [];
      let totalAmount = 0;
      let totalUnits = 0;

      for (const item of items) {
        const qty = parseInt(item.quantity, 10);
        const unitPrice = parseFloat(item.unit_price_usd);
        totalAmount += qty * unitPrice;
        totalUnits += qty;

        const matching = (allAvailableDevices || [])
          .filter(d => 
            d.model === item.model &&
            d.storage === item.storage &&
            (!item.grade_id || d.grade_id === item.grade_id) &&
            !devicesToUpdateIds.includes(d.id)
          )
          .sort((a, b) => (b.battery_health || 0) - (a.battery_health || 0));

        if (matching.length < qty) {
          throw new Error(`Estoque insuficiente para ${item.model} ${item.storage} (${matching.length} disponíveis de ${qty} solicitados)`);
        }

        const chosen = matching.slice(0, qty);
        chosen.forEach(dev => {
          devicesToUpdateIds.push(dev.id);
          allocatedDevices.push({
            device_id: dev.id,
            imei: dev.imei,
            model: dev.model,
            storage: dev.storage,
            grade_id: dev.grade_id,
            color: dev.color,
            battery_health: dev.battery_health,
            cost_price_usd: dev.cost_price_usd,
            separated: false
          });
        });
      }

      // Busca lojista para calcular comissão
      const { data: retailerData } = await supabase
        .from('retailers')
        .select('*')
        .eq('id', orderData.retailer_id)
        .single();

      const commissionRate = retailerData?.commission_per_unit_usd || 0;
      const totalCommission = totalUnits * commissionRate;
      const orderNumber = orderData.order_number || `PED-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

      // Cria pedido no Supabase
      const { data: createdOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          retailer_id: orderData.retailer_id,
          status: 'Reservado',
          total_amount_usd: totalAmount,
          paid_amount_usd: 0,
          balance_due_usd: totalAmount,
          total_commission_usd: totalCommission,
          total_profit_usd: 0,
          notes: orderData.notes || '',
          reserved_at: new Date().toISOString()
        })
        .select()
        .single();

      if (orderErr) throw new Error(`Erro ao criar pedido: ${orderErr.message}`);

      // Cria itens do pedido
      const orderItemsToInsert = items.map(it => ({
        order_id: createdOrder.id,
        model: it.model,
        storage: it.storage,
        grade_id: it.grade_id,
        quantity: parseInt(it.quantity, 10),
        unit_price_usd: parseFloat(it.unit_price_usd),
        total_price_usd: parseInt(it.quantity, 10) * parseFloat(it.unit_price_usd)
      }));
      await supabase.from('order_items').insert(orderItemsToInsert);

      // Atualiza status dos aparelhos no Supabase
      await supabase
        .from('devices')
        .update({ status: 'Reservado', updated_at: new Date().toISOString() })
        .in('id', devicesToUpdateIds);

      // Cria alocações de aparelhos
      const allocsToInsert = allocatedDevices.map(d => ({
        order_id: createdOrder.id,
        device_id: d.device_id,
        status: 'Reservado'
      }));
      try {
        await supabase.from('order_device_allocations').insert(allocsToInsert);
      } catch (e) {
        console.warn('order_device_allocations insert warning:', e);
      }

      // Cria movimentações de estoque
      const movementsToInsert = allocatedDevices.map(d => ({
        device_id: d.device_id,
        order_id: createdOrder.id,
        movement_type: 'Reserva',
        previous_status: 'Disponível',
        new_status: 'Reservado',
        reason: `Reserva do Pedido ${orderNumber}`
      }));
      await supabase.from('stock_movements').insert(movementsToInsert);

      return {
        ...createdOrder,
        retailer_name: retailerData?.store_name || 'Lojista',
        items,
        allocated_devices: allocatedDevices
      };
    }

    // Engine Local RPC Transacional (Fallback Offline / LocalStorage)
    const devices = getStored(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
    const allocatedDevices = [];
    const updatedDevices = [...devices];

    let totalAmount = 0;
    let totalUnits = 0;

    for (const item of items) {
      const qty = parseInt(item.quantity, 10);
      const unitPrice = parseFloat(item.unit_price_usd);
      totalAmount += qty * unitPrice;
      totalUnits += qty;

      const matchingDevices = updatedDevices.filter(d => 
        d.model === item.model &&
        d.storage === item.storage &&
        (!item.grade_id || d.grade_id === item.grade_id) &&
        d.status === 'Disponível'
      );

      if (matchingDevices.length < qty) {
        throw new Error(`Estoque insuficiente para ${item.model} ${item.storage} (${matchingDevices.length} disponíveis de ${qty} solicitados)`);
      }

      matchingDevices.sort((a, b) => (b.battery_health || 0) - (a.battery_health || 0));
      const chosen = matchingDevices.slice(0, qty);

      chosen.forEach(dev => {
        const idx = updatedDevices.findIndex(d => d.id === dev.id);
        if (idx !== -1) {
          updatedDevices[idx] = { ...updatedDevices[idx], status: 'Reservado' };
        }
        allocatedDevices.push({
          device_id: dev.id,
          imei: dev.imei,
          model: dev.model,
          storage: dev.storage,
          grade_id: dev.grade_id,
          color: dev.color,
          battery_health: dev.battery_health,
          cost_price_usd: dev.cost_price_usd,
          separated: false
        });
      });
    }

    setStored(STORAGE_KEYS.DEVICES, updatedDevices);

    const orders = getStored(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    const retailers = getStored(STORAGE_KEYS.RETAILERS, INITIAL_RETAILERS);
    const retailer = retailers.find(r => r.id === orderData.retailer_id);
    const commissionRate = retailer?.commission_per_unit_usd || 0;
    const totalCommission = totalUnits * commissionRate;

    const newOrder = {
      id: orderData.id || `ord-${Date.now()}`,
      order_number: orderData.order_number || `PED-${new Date().getFullYear()}-${String(orders.length + 1).padStart(3, '0')}`,
      retailer_id: orderData.retailer_id,
      retailer_name: retailer?.store_name || 'Lojista',
      status: 'Reservado',
      total_amount_usd: totalAmount,
      paid_amount_usd: 0,
      balance_due_usd: totalAmount,
      total_commission_usd: totalCommission,
      total_profit_usd: 0,
      created_at: new Date().toISOString(),
      reserved_at: new Date().toISOString(),
      items,
      allocated_devices: allocatedDevices,
      notes: orderData.notes || ''
    };

    setStored(STORAGE_KEYS.ORDERS, [newOrder, ...orders.filter(o => o.id !== newOrder.id)]);

    const movements = getStored(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    const newMovements = allocatedDevices.map(d => ({
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      device_id: d.device_id,
      imei: d.imei,
      order_id: newOrder.id,
      movement_type: 'Reserva',
      previous_status: 'Disponível',
      new_status: 'Reservado',
      reason: `Reserva do Pedido ${newOrder.order_number}`,
      created_at: new Date().toISOString()
    }));
    setStored(STORAGE_KEYS.MOVEMENTS, [...newMovements, ...movements]);

    return newOrder;
  },

  // RPC: Cancelamento de Pedido com Liberação Total de Estoque
  async cancelOrder(orderId, reason = 'Cancelado pelo administrador') {
    if (isLiveSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('rpc_cancel_order', {
          p_order_id: orderId,
          p_reason: reason
        });
        if (!error && data) return data;
      } catch (e) {
        console.warn('RPC rpc_cancel_order não encontrada, usando fluxo direto:', e);
      }

      // Fluxo Direto Supabase
      const { data: allocs } = await supabase
        .from('order_device_allocations')
        .select('device_id')
        .eq('order_id', orderId);

      const deviceIds = (allocs || []).map(a => a.device_id);
      if (deviceIds.length > 0) {
        await supabase
          .from('devices')
          .update({ status: 'Disponível', updated_at: new Date().toISOString() })
          .in('id', deviceIds);

        const movementsToInsert = deviceIds.map(dId => ({
          device_id: dId,
          order_id: orderId,
          movement_type: 'Cancelamento de Reserva',
          previous_status: 'Reservado',
          new_status: 'Disponível',
          reason: reason
        }));
        await supabase.from('stock_movements').insert(movementsToInsert);
      }

      await supabase.from('order_device_allocations').delete().eq('order_id', orderId);
      await supabase
        .from('orders')
        .update({ status: 'Cancelado', cancelled_at: new Date().toISOString() })
        .eq('id', orderId);

      return { success: true };
    }

    const orders = getStored(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error('Pedido não encontrado');

    const devices = getStored(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
    const allocatedIds = new Set((order.allocated_devices || []).map(d => d.device_id));

    const updatedDevices = devices.map(d => {
      if (allocatedIds.has(d.id)) {
        return { ...d, status: 'Disponível' };
      }
      return d;
    });
    setStored(STORAGE_KEYS.DEVICES, updatedDevices);

    const updatedOrders = orders.map(o => {
      if (o.id === orderId) {
        return { ...o, status: 'Cancelado', cancelled_at: new Date().toISOString(), notes: `${o.notes || ''} [Cancelamento: ${reason}]` };
      }
      return o;
    });
    setStored(STORAGE_KEYS.ORDERS, updatedOrders);

    const movements = getStored(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    const newMovements = (order.allocated_devices || []).map(d => ({
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      device_id: d.device_id,
      imei: d.imei,
      order_id: order.id,
      movement_type: 'Cancelamento de Reserva',
      previous_status: 'Reservado',
      new_status: 'Disponível',
      reason: reason,
      created_at: new Date().toISOString()
    }));
    setStored(STORAGE_KEYS.MOVEMENTS, [...newMovements, ...movements]);

    return { success: true };
  },

  // Exclusão de Venda (qualquer status): restaura automaticamente ao estoque
  // qualquer aparelho ainda vinculado (Reservado/Separado/Vendido) e remove
  // o pedido e seus registros filhos (pagamentos, parcelas, devoluções).
  async deleteOrder(orderId) {
    if (isLiveSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('rpc_delete_order', { p_order_id: orderId });
        if (!error && data) return data;

        const isFnMissing = error && (
          error.message?.includes('Could not find the function') ||
          error.code === '42883' ||
          error.code === 'PGRST202'
        );
        if (!isFnMissing) {
          throw new Error(error.message);
        }
      } catch (rpcErr) {
        if (!rpcErr.message?.includes('Could not find the function') && !rpcErr.message?.includes('schema cache')) {
          throw rpcErr;
        }
      }

      // Fluxo Direto Supabase (fallback caso a RPC ainda não tenha sido aplicada)
      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (!order) throw new Error('Pedido não encontrado');

      const { data: allocs } = await supabase.from('order_device_allocations').select('device_id, status').eq('order_id', orderId);
      const toRestore = (allocs || []).filter(a => a.status !== 'Devolvido').map(a => a.device_id);

      if (toRestore.length > 0) {
        await supabase.from('devices').update({ status: 'Disponível', updated_at: new Date().toISOString() }).in('id', toRestore);

        const movementsToInsert = toRestore.map(deviceId => ({
          device_id: deviceId,
          order_id: orderId,
          movement_type: 'Cancelamento de Reserva',
          previous_status: 'Vendido',
          new_status: 'Disponível',
          reason: `Venda ${order.order_number} excluída pelo administrador`
        }));
        await supabase.from('stock_movements').insert(movementsToInsert);
      }

      await supabase.from('sale_return_items').delete().eq('order_id', orderId);
      await supabase.from('sale_returns').delete().eq('order_id', orderId);
      await supabase.from('payments').delete().eq('order_id', orderId);
      await supabase.from('orders').delete().eq('id', orderId);

      return { success: true, order_id: orderId, restored_devices: toRestore.length };
    }

    // Engine Local (LocalStorage)
    const orders = getStored(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error('Pedido não encontrado');

    const devices = getStored(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
    const toRestoreIds = new Set((order.allocated_devices || []).map(d => d.device_id));

    const updatedDevices = devices.map(d => (toRestoreIds.has(d.id) ? { ...d, status: 'Disponível', updated_at: new Date().toISOString() } : d));
    setStored(STORAGE_KEYS.DEVICES, updatedDevices);

    const movements = getStored(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    const newMovements = (order.allocated_devices || []).map(d => ({
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      device_id: d.device_id,
      imei: d.imei,
      order_id: orderId,
      movement_type: 'Cancelamento de Reserva',
      previous_status: 'Vendido',
      new_status: 'Disponível',
      reason: `Venda ${order.order_number} excluída pelo administrador`,
      created_at: new Date().toISOString()
    }));
    setStored(STORAGE_KEYS.MOVEMENTS, [...newMovements, ...movements]);

    setStored(STORAGE_KEYS.ORDERS, orders.filter(o => o.id !== orderId));

    const installments = getStored(STORAGE_KEYS.INSTALLMENTS, INITIAL_INSTALLMENTS);
    setStored(STORAGE_KEYS.INSTALLMENTS, installments.filter(i => i.order_id !== orderId));

    return { success: true, order_id: orderId, restored_devices: toRestoreIds.size };
  },

  // Separação / Conferência de Aparelhos (Bipe de IMEI)
  async markDeviceAsSeparated(orderId, deviceId) {
    if (isLiveSupabaseConfigured) {
      await supabase
        .from('order_device_allocations')
        .update({ status: 'Separado', scanned_at: new Date().toISOString() })
        .eq('order_id', orderId)
        .eq('device_id', deviceId);
    }

    const orders = getStored(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    const updatedOrders = orders.map(order => {
      if (order.id === orderId) {
        const updatedAlloc = (order.allocated_devices || []).map(d => {
          if (d.device_id === deviceId || d.imei === deviceId) {
            return { ...d, separated: true, separated_at: new Date().toISOString() };
          }
          return d;
        });
        const allSeparated = updatedAlloc.every(d => d.separated);
        return {
          ...order,
          status: allSeparated ? 'Em Separação' : order.status,
          allocated_devices: updatedAlloc
        };
      }
      return order;
    });

    setStored(STORAGE_KEYS.ORDERS, updatedOrders);
    return { success: true };
  },

  // RPC: Finalização da Venda, Pagamentos, Parcelas e Lucro Real
  async finalizeOrderSale(orderId, paymentsList = [], installmentsList = []) {
    if (isLiveSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('rpc_finalize_order_sale', {
          p_order_id: orderId,
          p_payments: paymentsList,
          p_installments: installmentsList
        });
        if (!error && data) return data;
      } catch (e) {
        console.warn('RPC rpc_finalize_order_sale não encontrada, usando fluxo direto:', e);
      }

      // Fluxo Direto Supabase
      const { data: order } = await supabase
        .from('orders')
        .select('*, order_device_allocations(device_id)')
        .eq('id', orderId)
        .single();

      if (!order) throw new Error('Pedido não encontrado');
      if (order.status === 'Finalizado' || order.status === 'Parcialmente Devolvida' || order.status === 'Totalmente Devolvida') {
        throw new Error(`Pedido ${order.order_number} já foi finalizado anteriormente.`);
      }
      if (order.status === 'Cancelado') {
        throw new Error(`Pedido ${order.order_number} está cancelado e não pode ser finalizado.`);
      }

      const deviceIds = (order.order_device_allocations || []).map(a => a.device_id);
      let totalCost = 0;

      if (deviceIds.length > 0) {
        const { data: devs } = await supabase.from('devices').select('id, cost_price_usd').in('id', deviceIds);
        (devs || []).forEach(d => { totalCost += (d.cost_price_usd || 0); });

        await supabase
          .from('devices')
          .update({ status: 'Vendido', updated_at: new Date().toISOString() })
          .in('id', deviceIds);

        const movementsToInsert = deviceIds.map(dId => ({
          device_id: dId,
          order_id: orderId,
          movement_type: 'Venda',
          previous_status: 'Reservado',
          new_status: 'Vendido',
          reason: `Venda finalizada no pedido ${order.order_number}`
        }));
        await supabase.from('stock_movements').insert(movementsToInsert);
      }

      const totalPaid = paymentsList.reduce((acc, p) => acc + (parseFloat(p.amount_usd) || 0), 0);
      const totalProfit = order.total_amount_usd - totalCost;
      const balanceDue = Math.max(0, order.total_amount_usd - totalPaid);

      if (paymentsList.length > 0) {
        const paymentsToInsert = paymentsList.map(p => ({
          order_id: orderId,
          retailer_id: order.retailer_id,
          amount_usd: parseFloat(p.amount_usd) || 0,
          payment_method: p.method || 'PIX',
          exchange_rate: parseFloat(p.exchange_rate) || 1.0
        }));
        await supabase.from('payments').insert(paymentsToInsert);
      }

      if (installmentsList.length > 0) {
        const installmentsToInsert = installmentsList.map((inst, idx) => ({
          order_id: orderId,
          retailer_id: order.retailer_id,
          installment_number: idx + 1,
          amount_usd: parseFloat(inst.amount_usd) || 0,
          due_date: inst.due_date,
          status: new Date(inst.due_date) < new Date() ? 'Vencido' : 'A vencer'
        }));
        await supabase.from('installments').insert(installmentsToInsert);
      }

      await supabase
        .from('orders')
        .update({
          status: 'Finalizado',
          paid_amount_usd: totalPaid,
          balance_due_usd: balanceDue,
          total_profit_usd: totalProfit,
          finalized_at: new Date().toISOString()
        })
        .eq('id', orderId);

      return {
        success: true,
        total_profit_usd: totalProfit,
        total_cost_usd: totalCost,
        balance_due_usd: balanceDue
      };
    }

    const orders = getStored(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error('Pedido não encontrado');
    if (order.status === 'Finalizado' || order.status === 'Parcialmente Devolvida' || order.status === 'Totalmente Devolvida') {
      throw new Error(`Pedido ${order.order_number} já foi finalizado anteriormente.`);
    }
    if (order.status === 'Cancelado') {
      throw new Error(`Pedido ${order.order_number} está cancelado e não pode ser finalizado.`);
    }

    const devices = getStored(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
    const allocatedMap = new Map((order.allocated_devices || []).map(d => [d.device_id, d]));

    let totalCost = 0;
    const updatedDevices = devices.map(d => {
      if (allocatedMap.has(d.id)) {
        totalCost += (d.cost_price_usd || 0);
        return { ...d, status: 'Vendido' };
      }
      return d;
    });
    setStored(STORAGE_KEYS.DEVICES, updatedDevices);

    const totalPaid = paymentsList.reduce((acc, p) => acc + (parseFloat(p.amount_usd) || 0), 0);
    const totalProfit = order.total_amount_usd - totalCost;
    const balanceDue = Math.max(0, order.total_amount_usd - totalPaid);

    if (installmentsList.length > 0) {
      const existingInst = getStored(STORAGE_KEYS.INSTALLMENTS, INITIAL_INSTALLMENTS);
      const newInst = installmentsList.map((inst, idx) => ({
        id: `inst-${Date.now()}-${idx + 1}`,
        order_id: order.id,
        order_number: order.order_number,
        retailer_id: order.retailer_id,
        retailer_name: order.retailer_name,
        installment_number: idx + 1,
        amount_usd: parseFloat(inst.amount_usd),
        due_date: inst.due_date,
        status: new Date(inst.due_date) < new Date() ? 'Vencido' : 'A vencer',
        created_at: new Date().toISOString()
      }));
      setStored(STORAGE_KEYS.INSTALLMENTS, [...newInst, ...existingInst]);
    }

    const updatedOrders = orders.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status: 'Finalizado',
          paid_amount_usd: totalPaid,
          balance_due_usd: balanceDue,
          total_profit_usd: totalProfit,
          finalized_at: new Date().toISOString(),
          payments: paymentsList
        };
      }
      return o;
    });
    setStored(STORAGE_KEYS.ORDERS, updatedOrders);

    const movements = getStored(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    const newMovements = (order.allocated_devices || []).map(d => ({
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      device_id: d.device_id,
      imei: d.imei,
      order_id: order.id,
      movement_type: 'Venda',
      previous_status: 'Reservado',
      new_status: 'Vendido',
      reason: `Venda finalizada Pedido ${order.order_number}`,
      created_at: new Date().toISOString()
    }));
    setStored(STORAGE_KEYS.MOVEMENTS, [...newMovements, ...movements]);

    return {
      success: true,
      total_profit_usd: totalProfit,
      total_cost_usd: totalCost,
      balance_due_usd: balanceDue
    };
  },

  // RPC: Devolução de Aparelho(s) de uma Venda Finalizada (não é cancelamento)
  async registerSaleReturn(orderId, deviceIds, reason, notes = '', createdBy = 'admin') {
    if (!deviceIds || deviceIds.length === 0) {
      throw new Error('Selecione ao menos um aparelho para devolução.');
    }

    if (isLiveSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('rpc_register_sale_return', {
          p_order_id: orderId,
          p_device_ids: deviceIds,
          p_reason: reason,
          p_notes: notes || '',
          p_created_by: createdBy
        });
        if (!error && data) return data;

        const isFnMissing = error && (
          error.message?.includes('Could not find the function') ||
          error.code === '42883' ||
          error.code === 'PGRST202'
        );
        if (!isFnMissing) {
          throw new Error(error.message);
        }
      } catch (rpcErr) {
        if (!rpcErr.message?.includes('Could not find the function') && !rpcErr.message?.includes('schema cache')) {
          throw rpcErr;
        }
      }

      // Fluxo Direto Supabase (fallback caso a RPC ainda não tenha sido aplicada)
      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (!order) throw new Error('Pedido não encontrado');
      if (order.status !== 'Finalizado' && order.status !== 'Parcialmente Devolvida') {
        throw new Error(`Somente vendas Finalizadas ou Parcialmente Devolvidas podem receber devolução (status atual: ${order.status})`);
      }

      const { data: retailer } = await supabase.from('retailers').select('*').eq('id', order.retailer_id).single();
      const { data: orderItems } = await supabase.from('order_items').select('*').eq('order_id', orderId);
      const { data: allocations } = await supabase
        .from('order_device_allocations')
        .select('*, devices(*)')
        .eq('order_id', orderId)
        .in('device_id', deviceIds);

      if (!allocations || allocations.length !== deviceIds.length) {
        throw new Error('Um ou mais aparelhos não pertencem a este pedido.');
      }

      // Denominador estável para o preço médio de fallback: total de aparelhos JÁ alocados
      // ao pedido (ativos + devolvidos), que nunca muda — nunca a contagem atual, que
      // encolhe a cada devolução e infla o preço médio em devoluções sucessivas.
      const { count: totalEverAllocated } = await supabase
        .from('order_device_allocations')
        .select('*', { count: 'exact', head: true })
        .eq('order_id', orderId);

      let totalReturned = 0;
      let totalCostReturned = 0;
      const returnItemsToInsert = [];

      for (const alloc of allocations) {
        if (alloc.status === 'Devolvido') {
          throw new Error(`Aparelho ${alloc.devices?.imei} já foi devolvido anteriormente.`);
        }
        if (alloc.status !== 'Vendido') {
          throw new Error(`Aparelho ${alloc.devices?.imei} não está Vendido e não pode ser devolvido.`);
        }

        const matchingItem = (orderItems || []).find(it =>
          it.model === alloc.devices?.model && it.storage === alloc.devices?.storage && it.grade_id === alloc.devices?.grade_id
        );
        const unitPrice = matchingItem
          ? parseFloat(matchingItem.unit_price_usd)
          : (parseFloat(order.total_amount_usd) || 0) / Math.max(1, totalEverAllocated || deviceIds.length);

        totalReturned += unitPrice;
        totalCostReturned += parseFloat(alloc.devices?.cost_price_usd) || 0;

        returnItemsToInsert.push({
          device_id: alloc.device_id,
          imei: alloc.devices?.imei,
          model: alloc.devices?.model,
          storage: alloc.devices?.storage,
          original_sale_price_usd: unitPrice
        });
      }

      const totalCommissionReturned = allocations.length * (parseFloat(retailer?.commission_per_unit_usd) || 0);

      const { data: createdReturn, error: returnErr } = await supabase.from('sale_returns').insert({
        order_id: orderId,
        retailer_id: order.retailer_id,
        reason,
        notes: notes || '',
        total_amount_usd: totalReturned,
        total_commission_usd: totalCommissionReturned,
        created_by: createdBy
      }).select().single();
      if (returnErr) throw new Error(`Erro ao registrar devolução: ${returnErr.message}`);

      await supabase.from('sale_return_items').insert(
        returnItemsToInsert.map(it => ({ ...it, return_id: createdReturn.id, order_id: orderId }))
      );

      await supabase.from('order_device_allocations').update({ status: 'Devolvido' }).eq('order_id', orderId).in('device_id', deviceIds);
      await supabase.from('devices').update({ status: 'Disponível', updated_at: new Date().toISOString() }).in('id', deviceIds);

      const movementsToInsert = allocations.map(alloc => ({
        device_id: alloc.device_id,
        order_id: orderId,
        movement_type: 'Retorno',
        previous_status: 'Vendido',
        new_status: 'Disponível',
        reason: `Devolução de Venda (Pedido ${order.order_number})`,
        notes: `Motivo: ${reason}${notes ? ' — ' + notes : ''}`
      }));
      await supabase.from('stock_movements').insert(movementsToInsert);

      const newReturnedAmount = (parseFloat(order.returned_amount_usd) || 0) + totalReturned;
      const newReturnedCommission = (parseFloat(order.returned_commission_usd) || 0) + totalCommissionReturned;
      const netTotal = Math.max(0, (parseFloat(order.total_amount_usd) || 0) - newReturnedAmount);
      const newBalanceDue = Math.max(0, netTotal - (parseFloat(order.paid_amount_usd) || 0));
      const newCreditDue = Math.max(0, (parseFloat(order.paid_amount_usd) || 0) - netTotal);
      const newProfit = (parseFloat(order.total_profit_usd) || 0) - (totalReturned - totalCostReturned);

      const { data: openInstallments } = await supabase
        .from('installments')
        .select('*')
        .eq('order_id', orderId)
        .neq('status', 'Pago')
        .order('due_date', { ascending: false });

      const openSum = (openInstallments || []).reduce((s, i) => s + (parseFloat(i.amount_usd) || 0), 0);
      if (openSum > newBalanceDue) {
        let excess = openSum - newBalanceDue;
        for (const inst of (openInstallments || [])) {
          if (excess <= 0) break;
          const amount = parseFloat(inst.amount_usd) || 0;
          const reduction = Math.min(excess, amount);
          if (reduction >= amount) {
            await supabase.from('installments').update({
              status: 'Pago',
              amount_usd: 0,
              notes: `${inst.notes || ''} [Cancelada por devolução]`.trim()
            }).eq('id', inst.id);
          } else {
            await supabase.from('installments').update({ amount_usd: amount - reduction }).eq('id', inst.id);
          }
          excess -= reduction;
        }
      }

      const { count: totalAllocated } = await supabase.from('order_device_allocations').select('*', { count: 'exact', head: true }).eq('order_id', orderId);
      const { count: totalReturnedAlloc } = await supabase.from('order_device_allocations').select('*', { count: 'exact', head: true }).eq('order_id', orderId).eq('status', 'Devolvido');
      const newStatus = totalReturnedAlloc >= totalAllocated ? 'Totalmente Devolvida' : 'Parcialmente Devolvida';

      await supabase.from('orders').update({
        returned_amount_usd: newReturnedAmount,
        returned_commission_usd: newReturnedCommission,
        total_profit_usd: newProfit,
        balance_due_usd: newBalanceDue,
        credit_due_usd: newCreditDue,
        status: newStatus,
        updated_at: new Date().toISOString()
      }).eq('id', orderId);

      return {
        success: true,
        return_id: createdReturn.id,
        order_id: orderId,
        order_status: newStatus,
        returned_amount_usd: totalReturned,
        returned_commission_usd: totalCommissionReturned,
        net_total_usd: netTotal,
        balance_due_usd: newBalanceDue,
        credit_due_usd: newCreditDue
      };
    }

    // Engine Local RPC Transacional (Fallback Offline / LocalStorage)
    const orders = getStored(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error('Pedido não encontrado');
    if (order.status !== 'Finalizado' && order.status !== 'Parcialmente Devolvida') {
      throw new Error(`Somente vendas Finalizadas ou Parcialmente Devolvidas podem receber devolução (status atual: ${order.status})`);
    }

    const retailers = getStored(STORAGE_KEYS.RETAILERS, INITIAL_RETAILERS);
    const retailer = retailers.find(r => r.id === order.retailer_id);
    const commissionRate = parseFloat(retailer?.commission_per_unit_usd) || 0;

    const allocatedDevices = order.allocated_devices || [];
    const alreadyReturnedIds = new Set((order.returned_devices || []).map(d => d.device_id));

    const targets = [];
    for (const deviceId of deviceIds) {
      if (alreadyReturnedIds.has(deviceId)) {
        const dev = (order.returned_devices || []).find(d => d.device_id === deviceId);
        throw new Error(`Aparelho ${dev?.imei || deviceId} já foi devolvido anteriormente.`);
      }
      const alloc = allocatedDevices.find(d => d.device_id === deviceId);
      if (!alloc) {
        throw new Error(`Aparelho ${deviceId} não pertence a este pedido ou não está mais Vendido.`);
      }
      targets.push(alloc);
    }

    let totalReturned = 0;
    let totalCostReturned = 0;
    const returnItems = [];

    // Denominador estável para o preço médio de fallback: total de aparelhos JÁ
    // alocados ao pedido (ativos + devolvidos), que nunca muda — nunca a contagem
    // atual, que encolhe a cada devolução e infla o preço médio em devoluções sucessivas.
    const totalEverAllocated = allocatedDevices.length + (order.returned_devices || []).length;

    for (const dev of targets) {
      const matchingItem = (order.items || []).find(it =>
        it.model === dev.model && it.storage === dev.storage && (!it.grade_id || it.grade_id === dev.grade_id)
      );
      const unitPrice = matchingItem
        ? parseFloat(matchingItem.unit_price_usd)
        : (parseFloat(order.total_amount_usd) || 0) / Math.max(1, totalEverAllocated);

      totalReturned += unitPrice;
      totalCostReturned += parseFloat(dev.cost_price_usd) || 0;
      returnItems.push({
        device_id: dev.device_id,
        imei: dev.imei,
        model: dev.model,
        storage: dev.storage,
        original_sale_price_usd: unitPrice,
        returned_at: new Date().toISOString()
      });
    }

    const totalCommissionReturned = targets.length * commissionRate;

    const newReturn = {
      id: `ret-${Date.now()}`,
      order_id: orderId,
      retailer_id: order.retailer_id,
      reason,
      notes: notes || '',
      total_amount_usd: totalReturned,
      total_commission_usd: totalCommissionReturned,
      created_by: createdBy,
      created_at: new Date().toISOString(),
      items: returnItems
    };

    const devices = getStored(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
    const returnedIdsSet = new Set(deviceIds);
    const updatedDevices = devices.map(d => returnedIdsSet.has(d.id) ? { ...d, status: 'Disponível', updated_at: new Date().toISOString() } : d);
    setStored(STORAGE_KEYS.DEVICES, updatedDevices);

    const movements = getStored(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    const newMovements = targets.map(dev => ({
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      device_id: dev.device_id,
      imei: dev.imei,
      order_id: orderId,
      movement_type: 'Retorno',
      previous_status: 'Vendido',
      new_status: 'Disponível',
      reason: `Devolução de Venda (Pedido ${order.order_number})`,
      notes: `Motivo: ${reason}${notes ? ' — ' + notes : ''}`,
      created_at: new Date().toISOString()
    }));
    setStored(STORAGE_KEYS.MOVEMENTS, [...newMovements, ...movements]);

    const newReturnedAmount = (order.returned_amount_usd || 0) + totalReturned;
    const newReturnedCommission = (order.returned_commission_usd || 0) + totalCommissionReturned;
    const netTotal = Math.max(0, (order.total_amount_usd || 0) - newReturnedAmount);
    const newBalanceDue = Math.max(0, netTotal - (order.paid_amount_usd || 0));
    const newCreditDue = Math.max(0, (order.paid_amount_usd || 0) - netTotal);
    const newProfit = (order.total_profit_usd || 0) - (totalReturned - totalCostReturned);

    const remainingAllocated = allocatedDevices.filter(d => !returnedIdsSet.has(d.device_id));
    const newStatus = remainingAllocated.length === 0 ? 'Totalmente Devolvida' : 'Parcialmente Devolvida';

    // Ajusta parcelas em aberto (da mais recente para a mais antiga) para não deixar Contas a Receber incorreto
    const installments = getStored(STORAGE_KEYS.INSTALLMENTS, INITIAL_INSTALLMENTS);
    const orderOpenInstallments = installments
      .filter(i => i.order_id === orderId && i.status !== 'Pago')
      .sort((a, b) => new Date(b.due_date) - new Date(a.due_date));
    const openSum = orderOpenInstallments.reduce((s, i) => s + (parseFloat(i.amount_usd) || 0), 0);

    if (openSum > newBalanceDue) {
      let excess = openSum - newBalanceDue;
      const adjustments = new Map();
      for (const inst of orderOpenInstallments) {
        if (excess <= 0) break;
        const amount = parseFloat(inst.amount_usd) || 0;
        const reduction = Math.min(excess, amount);
        if (reduction >= amount) {
          adjustments.set(inst.id, { status: 'Pago', amount_usd: 0, notes: `${inst.notes || ''} [Cancelada por devolução]`.trim() });
        } else {
          adjustments.set(inst.id, { amount_usd: amount - reduction });
        }
        excess -= reduction;
      }
      setStored(STORAGE_KEYS.INSTALLMENTS, installments.map(i => adjustments.has(i.id) ? { ...i, ...adjustments.get(i.id) } : i));
    }

    const updatedOrders = orders.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          allocated_devices: remainingAllocated,
          returned_devices: [...(o.returned_devices || []), ...targets.map(t => ({ ...t, returned_at: new Date().toISOString() }))],
          returns: [...(o.returns || []), newReturn],
          returned_amount_usd: newReturnedAmount,
          returned_commission_usd: newReturnedCommission,
          total_profit_usd: newProfit,
          balance_due_usd: newBalanceDue,
          credit_due_usd: newCreditDue,
          status: newStatus
        };
      }
      return o;
    });
    setStored(STORAGE_KEYS.ORDERS, updatedOrders);

    return {
      success: true,
      return_id: newReturn.id,
      order_id: orderId,
      order_status: newStatus,
      returned_amount_usd: totalReturned,
      returned_commission_usd: totalCommissionReturned,
      net_total_usd: netTotal,
      balance_due_usd: newBalanceDue,
      credit_due_usd: newCreditDue
    };
  },

  // Baixa de Parcela (Contas a Receber)
  async payInstallment(installmentId, paymentDetails = {}) {
    if (isLiveSupabaseConfigured) {
      const { data: inst, error: fetchErr } = await supabase
        .from('installments')
        .select('*')
        .eq('id', installmentId)
        .single();

      if (fetchErr || !inst) throw new Error('Parcela não encontrada');

      await supabase
        .from('installments')
        .update({
          status: 'Pago',
          payment_date: new Date().toISOString()
        })
        .eq('id', installmentId);

      // Inserir registro em payments
      await supabase.from('payments').insert({
        order_id: inst.order_id,
        retailer_id: inst.retailer_id,
        amount_usd: inst.amount_usd,
        payment_method: paymentDetails.method || 'PIX',
        notes: `Baixa da parcela #${inst.installment_number}`
      });

      // Atualizar saldo do pedido
      const { data: order } = await supabase.from('orders').select('*').eq('id', inst.order_id).single();
      if (order) {
        const newPaid = (order.paid_amount_usd || 0) + inst.amount_usd;
        await supabase
          .from('orders')
          .update({
            paid_amount_usd: newPaid,
            balance_due_usd: Math.max(0, order.total_amount_usd - newPaid)
          })
          .eq('id', inst.order_id);
      }

      return { success: true };
    }

    const installments = getStored(STORAGE_KEYS.INSTALLMENTS, INITIAL_INSTALLMENTS);
    const inst = installments.find(i => i.id === installmentId);
    if (!inst) throw new Error('Parcela não encontrada');

    const updated = installments.map(i => {
      if (i.id === installmentId) {
        return {
          ...i,
          status: 'Pago',
          paid_at: new Date().toISOString(),
          payment_method: paymentDetails.method || 'PIX'
        };
      }
      return i;
    });
    setStored(STORAGE_KEYS.INSTALLMENTS, updated);

    // Atualiza saldo pago no pedido correspondente
    const orders = getStored(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    const updatedOrders = orders.map(o => {
      if (o.id === inst.order_id) {
        const newPaid = (o.paid_amount_usd || 0) + inst.amount_usd;
        return {
          ...o,
          paid_amount_usd: newPaid,
          balance_due_usd: Math.max(0, o.total_amount_usd - newPaid)
        };
      }
      return o;
    });
    setStored(STORAGE_KEYS.ORDERS, updatedOrders);

    return { success: true };
  },

  // RPC: Retirada / Ajuste de Estoque sem Venda
  async adjustStock(deviceId, reason, notes) {
    if (isLiveSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('rpc_adjust_device_stock', {
          p_device_id: deviceId,
          p_reason: reason,
          p_notes: notes
        });
        if (!error && data) return data;
      } catch (e) {
        console.warn('RPC rpc_adjust_device_stock não encontrada, usando fluxo direto:', e);
      }

      // Fluxo Direto Supabase
      const { data: dev } = await supabase.from('devices').select('*').eq('id', deviceId).single();
      if (!dev) throw new Error('Aparelho não encontrado');
      if (dev.status === 'Vendido') {
        throw new Error('Não é permitido retirar por ajuste um aparelho já Vendido');
      }

      await supabase
        .from('devices')
        .update({ status: 'Retirado por ajuste', updated_at: new Date().toISOString() })
        .eq('id', deviceId);

      await supabase.from('stock_movements').insert({
        device_id: deviceId,
        movement_type: 'Ajuste de Estoque',
        previous_status: dev.status,
        new_status: 'Retirado por ajuste',
        reason: `${reason}${notes ? ` - ${notes}` : ''}`
      });

      return { success: true };
    }

    const devices = getStored(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) throw new Error('Aparelho não encontrado');

    if (dev.status === 'Vendido') {
      throw new Error('Não é permitido retirar por ajuste um aparelho já Vendido');
    }

    const prevStatus = dev.status;
    const updatedDevices = devices.map(d => {
      if (d.id === deviceId) {
        return { ...d, status: 'Retirado por ajuste' };
      }
      return d;
    });
    setStored(STORAGE_KEYS.DEVICES, updatedDevices);

    // Registra ajuste
    const adjustments = getStored(STORAGE_KEYS.ADJUSTMENTS, []);
    const newAdj = {
      id: `adj-${Date.now()}`,
      device_id: deviceId,
      imei: dev.imei,
      model: dev.model,
      storage: dev.storage,
      reason,
      notes,
      created_at: new Date().toISOString()
    };
    setStored(STORAGE_KEYS.ADJUSTMENTS, [newAdj, ...adjustments]);

    // Registra movimentação
    const movements = getStored(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    const newMovement = {
      id: `mov-${Date.now()}`,
      device_id: deviceId,
      imei: dev.imei,
      movement_type: 'Ajuste',
      previous_status: prevStatus,
      new_status: 'Retirado por ajuste',
      reason: reason,
      notes: notes,
      created_at: new Date().toISOString()
    };
    setStored(STORAGE_KEYS.MOVEMENTS, [newMovement, ...movements]);

    return { success: true };
  },

  // Movimentações e Histórico de Aparelho
  async getMovements(deviceId = null) {
    if (isLiveSupabaseConfigured) {
      let query = supabase.from('stock_movements').select('*').order('created_at', { ascending: false });
      if (deviceId) {
        query = query.eq('device_id', deviceId);
      }
      const { data, error } = await query;
      if (!error && data) return data;
    }
    const movements = getStored(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    if (deviceId) {
      return movements.filter(m => m.device_id === deviceId);
    }
    return movements;
  },

  async getStockMovements(deviceId = null) {
    return this.getMovements(deviceId);
  },

  // Parcelas
  async getInstallments() {
    return getStored(STORAGE_KEYS.INSTALLMENTS, INITIAL_INSTALLMENTS);
  },

  // Ajustes
  async getAdjustments() {
    return getStored(STORAGE_KEYS.ADJUSTMENTS, []);
  },

  // Comissões por Indicação de Lojista
  async getRetailerReferrals() {
    return getStored(STORAGE_KEYS.RETAILER_REFERRALS, INITIAL_RETAILER_REFERRALS);
  },

  async saveRetailerReferral(referral) {
    const list = getStored(STORAGE_KEYS.RETAILER_REFERRALS, INITIAL_RETAILER_REFERRALS);
    let updated;
    if (referral.id) {
      updated = list.map(r => r.id === referral.id ? { ...r, ...referral } : r);
    } else {
      const newEntry = {
        ...referral,
        id: `ref-${Date.now()}`,
        status: referral.status || 'Ativo',
        created_at: new Date().toISOString()
      };
      updated = [newEntry, ...list];
    }
    setStored(STORAGE_KEYS.RETAILER_REFERRALS, updated);
    return referral;
  },

  async deleteRetailerReferral(id) {
    const list = getStored(STORAGE_KEYS.RETAILER_REFERRALS, INITIAL_RETAILER_REFERRALS);
    const updated = list.filter(r => r.id !== id);
    setStored(STORAGE_KEYS.RETAILER_REFERRALS, updated);
    return true;
  },

  // ==========================================
  // GESTÃO DE ACESSOS E LOGIN DE COMISSIONADOS
  // ==========================================
  async getCommissionAgents() {
    if (isLiveSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('commission_agents')
        .select('*')
        .order('name');
      if (!error && data) return data;
    }
    return getStored(STORAGE_KEYS.COMMISSION_AGENTS, []);
  },

  async saveCommissionAgent(agent) {
    if (!agent || !agent.name || !agent.name.trim()) {
      throw new Error('Informe o nome do comissionado.');
    }
    if (!agent.email || !agent.email.trim()) {
      throw new Error('Informe o e-mail de acesso do comissionado.');
    }

    const cleanEmail = agent.email.trim().toLowerCase();
    const agents = getStored(STORAGE_KEYS.COMMISSION_AGENTS, []);

    // Validar duplicidade de e-mail em outro cadastro
    const existing = agents.find(a => a.email.toLowerCase() === cleanEmail && a.id !== agent.id);
    if (existing) {
      throw new Error(`O e-mail ${cleanEmail} já está em uso por outro comissionado.`);
    }

    const payload = {
      ...agent,
      id: agent.id || `agent-${Date.now()}`,
      name: agent.name.trim(),
      email: cleanEmail,
      phone: agent.phone ? agent.phone.trim() : '',
      is_active: agent.is_active !== undefined ? Boolean(agent.is_active) : true,
      password: agent.password || agent.password_hash || '123456',
      created_at: agent.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isLiveSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('commission_agents')
        .upsert(payload)
        .select();
      if (error) {
        console.error('Erro ao salvar comissionado no Supabase:', error);
      } else if (data && data[0]) {
        // Atualiza localmente também
      }
    }

    let updatedList;
    if (agent.id) {
      updatedList = agents.map(a => a.id === agent.id ? { ...a, ...payload } : a);
    } else {
      updatedList = [payload, ...agents];
    }
    setStored(STORAGE_KEYS.COMMISSION_AGENTS, updatedList);

    // Sincronizar vínculos existentes em retailer_referrals
    const referrals = getStored(STORAGE_KEYS.RETAILER_REFERRALS, INITIAL_RETAILER_REFERRALS);
    let referralsUpdated = false;
    const mappedReferrals = referrals.map(ref => {
      if (ref.referrer_name && ref.referrer_name.trim().toLowerCase() === payload.name.toLowerCase() && ref.agent_id !== payload.id) {
        referralsUpdated = true;
        return { ...ref, agent_id: payload.id };
      }
      return ref;
    });
    if (referralsUpdated) {
      setStored(STORAGE_KEYS.RETAILER_REFERRALS, mappedReferrals);
    }

    return payload;
  },

  async setCommissionAgentStatus(id, isActive) {
    if (!id) throw new Error('ID do comissionado não informado.');
    const agents = getStored(STORAGE_KEYS.COMMISSION_AGENTS, []);
    const target = agents.find(a => a.id === id);
    if (!target) throw new Error('Comissionado não encontrado.');

    target.is_active = Boolean(isActive);
    target.updated_at = new Date().toISOString();

    if (isLiveSupabaseConfigured && supabase) {
      await supabase
        .from('commission_agents')
        .update({ is_active: target.is_active, updated_at: target.updated_at })
        .eq('id', id);
    }

    const updated = agents.map(a => a.id === id ? { ...a, is_active: target.is_active } : a);
    setStored(STORAGE_KEYS.COMMISSION_AGENTS, updated);
    return target;
  },

  async resetCommissionAgentPassword(id, newPassword) {
    if (!id) throw new Error('ID do comissionado não informado.');
    if (!newPassword || newPassword.length < 4) {
      throw new Error('A nova senha deve ter pelo menos 4 caracteres.');
    }
    const agents = getStored(STORAGE_KEYS.COMMISSION_AGENTS, []);
    const target = agents.find(a => a.id === id);
    if (!target) throw new Error('Comissionado não encontrado.');

    target.password = newPassword;
    target.updated_at = new Date().toISOString();

    if (isLiveSupabaseConfigured && supabase) {
      await supabase
        .from('commission_agents')
        .update({ password_hash: newPassword, updated_at: target.updated_at })
        .eq('id', id);
    }

    const updatedAgent = { ...target, password: newPassword, password_hash: newPassword };
    const updated = agents.map(a => a.id === id ? updatedAgent : a);
    setStored(STORAGE_KEYS.COMMISSION_AGENTS, updated);
    return { success: true, agent: updatedAgent, message: 'Senha atualizada com sucesso.' };
  },

  async deleteCommissionAgent(id) {
    if (!id) throw new Error('ID do comissionado não informado.');
    if (isLiveSupabaseConfigured && supabase) {
      await supabase.from('commission_agents').delete().eq('id', id);
    }
    const agents = getStored(STORAGE_KEYS.COMMISSION_AGENTS, []);
    const updated = agents.filter(a => a.id !== id);
    setStored(STORAGE_KEYS.COMMISSION_AGENTS, updated);
    return true;
  },

  /**
   * Consulta Segura e Exclusiva para o Portal do Comissionado (Somente Leitura)
   * Blindado contra vazamento de dados de outros comissionados, custos, margens e estoque.
   */
  async getCommissionAgentPortalData(identifier, periodFilter = {}) {
    const agents = getStored(STORAGE_KEYS.COMMISSION_AGENTS, []);
    
    // Identifier can be a string (agentId/userId/email) or an object ({ agentId, email, userId })
    let agentId = null;
    let email = null;
    let userId = null;
    
    if (typeof identifier === 'string') {
      agentId = identifier;
    } else if (identifier && typeof identifier === 'object') {
      agentId = identifier.agentId || identifier.id;
      email = identifier.email;
      userId = identifier.userId;
    }

    // Localizar o comissionado por ID, e-mail ou user_id
    let agent = null;
    if (agentId) {
      agent = agents.find(a => a.id === agentId || a.user_id === agentId);
    }
    if (!agent && email) {
      const clean = email.trim().toLowerCase();
      agent = agents.find(a => a.email && a.email.toLowerCase() === clean);
    }
    if (!agent && userId) {
      agent = agents.find(a => a.user_id === userId || a.id === userId);
    }

    if (!agent) {
      throw new Error('Acesso não autorizado: Comissionado não identificado.');
    }

    if (!agent.is_active) {
      throw new Error('Acesso desativado. Entre em contato com a administração da RiseMobile.');
    }

    // Carregar indicações vinculadas exclusivamente a este agente
    const allReferrals = getStored(STORAGE_KEYS.RETAILER_REFERRALS, INITIAL_RETAILER_REFERRALS);
    const myReferrals = allReferrals.filter(ref => 
      ref.agent_id === agent.id || 
      (ref.referrer_name && ref.referrer_name.trim().toLowerCase() === agent.name.trim().toLowerCase())
    );

    // Carregar lojas
    const allRetailers = getStored(STORAGE_KEYS.RETAILERS, INITIAL_RETAILERS);
    
    // Carregar pedidos finalizados das lojas indicadas
    const allOrders = getStored(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    const myRetailerIds = new Set(myReferrals.map(r => r.retailer_id));
    const myRetailerNames = new Set(myReferrals.map(r => (r.retailer_name || '').toLowerCase()));

    // Filtrar pedidos elegíveis
    const startDate = periodFilter.startDate ? new Date(periodFilter.startDate) : null;
    const endDate = periodFilter.endDate ? new Date(periodFilter.endDate) : null;
    if (endDate) endDate.setHours(23, 59, 59, 999);

    const validCompletedOrders = allOrders.filter(o => {
      const orderRetailerId = o.retailer_id || o.retailerId;
      const orderRetailerName = (o.retailer_name || o.client || '').toLowerCase();
      
      const isMyStore = (orderRetailerId && myRetailerIds.has(orderRetailerId)) ||
                        (orderRetailerName && myRetailerNames.has(orderRetailerName));
      if (!isMyStore) return false;

      const statusLower = (o.status || '').toLowerCase();
      const isCompleted = statusLower === 'finalizado' || statusLower === 'completed' || statusLower === 'parcialmente devolvida' || !o.status;
      if (!isCompleted) return false;

      if (startDate || endDate) {
        const orderDate = new Date(o.created_at || o.date);
        if (startDate && orderDate < startDate) return false;
        if (endDate && orderDate > endDate) return false;
      }
      return true;
    });

    // Calcular agregado por lojista indicado
    const calculatedReferrals = myReferrals.map(ref => {
      const retailer = allRetailers.find(ret => ret.id === ref.retailer_id || (ret.store_name && ret.store_name.toLowerCase() === (ref.retailer_name || '').toLowerCase()));
      const refStoreName = (ref.retailer_name || (retailer ? retailer.store_name : '')).toLowerCase();
      
      const retailerOrders = validCompletedOrders.filter(o => {
        const oId = o.retailer_id || o.retailerId;
        const oName = (o.retailer_name || o.client || '').toLowerCase();
        return (oId && oId === ref.retailer_id) || (oName && oName === refStoreName);
      });

      // Quantidade total de peças válidas compradas
      let unitsCount = 0;
      if (retailerOrders.length > 0) {
        unitsCount = retailerOrders.reduce((sum, order) => {
          const itemsQty = order.items?.reduce((isum, item) => isum + (Number(item.quantity) || 0), 0) || Number(order.quantity) || 0;
          const returnedQty = Number(order.returned_quantity) || 0;
          return sum + Math.max(0, itemsQty - returnedQty);
        }, 0);
      } else {
        unitsCount = Number(ref.total_units) || Number(ref.units_count) || 0;
      }

      const commRate = parseFloat(ref.commission_per_unit_usd || ref.commission_per_unit) || 0;
      const accumulatedCommission = unitsCount * commRate;

      return {
        id: ref.id,
        retailer_id: ref.retailer_id,
        retailer_name: retailer ? retailer.store_name : (ref.retailer_name || 'Lojista'),
        retailer_city: retailer ? retailer.city : '',
        retailer_state: retailer ? retailer.state : '',
        commission_per_unit_usd: commRate,
        units_count: unitsCount,
        accumulated_commission_usd: accumulatedCommission,
        status: ref.status || 'Ativo',
        notes: ref.notes || '',
        created_at: ref.created_at
      };
    });

    // Extrato de Pedidos (somente campos seguros)
    const ordersHistory = [];
    validCompletedOrders.forEach(order => {
      const orderRetailerId = order.retailer_id || order.retailerId;
      const orderRetailerName = (order.retailer_name || order.client || '').toLowerCase();
      const ref = myReferrals.find(r => 
        (orderRetailerId && r.retailer_id === orderRetailerId) || 
        (orderRetailerName && (r.retailer_name || '').toLowerCase() === orderRetailerName)
      );
      const retailer = allRetailers.find(ret => 
        (orderRetailerId && ret.id === orderRetailerId) ||
        (orderRetailerName && ret.store_name && ret.store_name.toLowerCase() === orderRetailerName)
      );
      const itemsQty = order.items?.reduce((isum, item) => isum + (Number(item.quantity) || 0), 0) || Number(order.quantity) || 0;
      const returnedQty = Number(order.returned_quantity) || 0;
      const validUnits = Math.max(0, itemsQty - returnedQty);
      
      if (validUnits > 0) {
        const commRate = ref ? (parseFloat(ref.commission_per_unit_usd || ref.commission_per_unit) || 0) : 0;
        ordersHistory.push({
          order_id: order.id,
          order_number: order.order_number || `PED-${(order.id || '').slice(0, 6)}`,
          retailer_name: retailer ? retailer.store_name : (order.retailer_name || order.client || 'Lojista'),
          store_name: retailer ? retailer.store_name : (order.retailer_name || order.client || 'Lojista'),
          date: order.created_at || order.date,
          units_count: validUnits,
          commission_rate_usd: commRate,
          commission_usd: validUnits * commRate,
          commission_earned: validUnits * commRate,
          status: order.status
        });
      }
    });

    // Ordenar histórico do mais recente para o mais antigo
    ordersHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalUnits = calculatedReferrals.reduce((sum, r) => sum + r.units_count, 0);
    const totalCommissionUSD = calculatedReferrals.reduce((sum, r) => sum + r.accumulated_commission_usd, 0);
    const activeRetailersCount = calculatedReferrals.filter(r => {
      const s = (r.status || '').toLowerCase();
      return s.includes('ativ') || s.includes('activ');
    }).length;

    return {
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        phone: agent.phone || '',
        is_active: agent.is_active
      },
      referrals: calculatedReferrals,
      orders_history: ordersHistory,
      salesHistory: ordersHistory,
      total_units: totalUnits,
      total_commission_usd: totalCommissionUSD,
      active_retailers_count: activeRetailersCount,
      summary: {
        totalUnits,
        totalCommissionUSD,
        activeStores: activeRetailersCount
      }
    };
  },

  // Configurações Globais
  async getSettings() {
    return getStored(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
  },

  async saveSettings(settings) {
    setStored(STORAGE_KEYS.SETTINGS, settings);
    return settings;
  },

  // Limpar todos os dados operacionais (Estoque, Vendas, Clientes, Parcelas, Movimentações, Entradas)
  clearAllOperationalData() {
    setStored(STORAGE_KEYS.RETAILERS, []);
    setStored(STORAGE_KEYS.DEVICES, []);
    setStored(STORAGE_KEYS.ORDERS, []);
    setStored(STORAGE_KEYS.INSTALLMENTS, []);
    setStored(STORAGE_KEYS.MOVEMENTS, []);
    setStored(STORAGE_KEYS.ADJUSTMENTS, []);
    setStored(STORAGE_KEYS.AUDIT_LOGS, []);
    setStored(STORAGE_KEYS.RETAILER_REFERRALS, []);
    setStored(STORAGE_KEYS.STOCK_ENTRIES, []);
    return { success: true };
  },

  // Resetar para base 100% limpa para produção
  resetToDemoData() {
    this.clearAllOperationalData();
    setStored(STORAGE_KEYS.GRADES, INITIAL_GRADES);
    setStored(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
  }
};

export { AuthService } from './authService.js';

