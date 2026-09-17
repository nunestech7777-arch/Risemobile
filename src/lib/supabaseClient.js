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
const STORAGE_KEYS = {
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
  STOCK_ENTRIES: 'risemobile_stock_entries'
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
    const payload = { ...retailer };
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

  // Pedidos
  async getOrders() {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('orders').select('*, retailers(store_name, contact_name), order_items(*)').order('created_at', { ascending: false });
      if (!error && data) return data;
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

