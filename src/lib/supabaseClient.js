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
  RETAILER_REFERRALS: 'risemobile_retailer_referrals'
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

// Initialize default storage if empty
export const initStorageIfNeeded = () => {
  try {
    if (typeof localStorage !== 'undefined') {
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
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('grades').upsert(grade).select();
      if (!error && data) return data[0];
    }
    const grades = getStored(STORAGE_KEYS.GRADES, INITIAL_GRADES);
    let updated;
    if (grade.id) {
      updated = grades.map(g => g.id === grade.id ? { ...g, ...grade } : g);
    } else {
      const newGrade = { ...grade, id: `grade-${Date.now()}`, is_active: true };
      updated = [...grades, newGrade];
    }
    setStored(STORAGE_KEYS.GRADES, updated);
    return grade;
  },

  // Devices / Estoque
  async getDevices() {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('devices').select('*, grades(name, badge_color)').order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    return getStored(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
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
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('retailers').upsert(retailer).select();
      if (!error && data) return data[0];
    }
    const retailers = getStored(STORAGE_KEYS.RETAILERS, INITIAL_RETAILERS);
    let updated;
    if (retailer.id) {
      updated = retailers.map(r => r.id === retailer.id ? { ...r, ...retailer } : r);
    } else {
      const newRet = { ...retailer, id: `ret-${Date.now()}`, created_at: new Date().toISOString() };
      updated = [newRet, ...retailers];
    }
    setStored(STORAGE_KEYS.RETAILERS, updated);
    return retailer;
  },

  // Pedidos
  async getOrders() {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('orders').select('*, retailers(store_name, contact_name), order_items(*)').order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    return getStored(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
  },

  // RPC: Reserva Automática e Atômica
  async reserveOrder(orderData, items) {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.rpc('rpc_reserve_devices_for_order', {
        p_order_id: orderData.id,
        p_items: items
      });
      if (error) throw new Error(error.message);
      return data;
    }

    // Engine Local RPC Transacional
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

      // Busca aparelhos disponíveis que satisfaçam modelo, armazenamento e grade
      const matchingDevices = updatedDevices.filter(d => 
        d.model === item.model &&
        d.storage === item.storage &&
        (d.grade_id === item.grade_id || !item.grade_id) &&
        d.status === 'Disponível'
      );

      if (matchingDevices.length < qty) {
        throw new Error(`Estoque insuficiente para ${item.model} ${item.storage} (${matchingDevices.length} disponíveis de ${qty} solicitados)`);
      }

      // Ordena por maior saúde de bateria e data de entrada
      matchingDevices.sort((a, b) => (b.battery_health || 0) - (a.battery_health || 0));
      const chosen = matchingDevices.slice(0, qty);

      chosen.forEach(dev => {
        // Marca como reservado
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

    // Salva aparelhos atualizados
    setStored(STORAGE_KEYS.DEVICES, updatedDevices);

    // Cria/Atualiza o Pedido
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

    // Registra movimentações
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
      const { data, error } = await supabase.rpc('rpc_cancel_order', {
        p_order_id: orderId,
        p_reason: reason
      });
      if (error) throw new Error(error.message);
      return data;
    }

    const orders = getStored(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error('Pedido não encontrado');

    const devices = getStored(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
    const allocatedIds = new Set((order.allocated_devices || []).map(d => d.device_id));

    // Retorna unidades para Disponível
    const updatedDevices = devices.map(d => {
      if (allocatedIds.has(d.id)) {
        return { ...d, status: 'Disponível' };
      }
      return d;
    });
    setStored(STORAGE_KEYS.DEVICES, updatedDevices);

    // Atualiza pedido
    const updatedOrders = orders.map(o => {
      if (o.id === orderId) {
        return { ...o, status: 'Cancelado', cancelled_at: new Date().toISOString(), notes: `${o.notes || ''} [Cancelamento: ${reason}]` };
      }
      return o;
    });
    setStored(STORAGE_KEYS.ORDERS, updatedOrders);

    // Registra movimentação de cancelamento
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
      const { data, error } = await supabase.rpc('rpc_finalize_order_sale', {
        p_order_id: orderId,
        p_payments: paymentsList,
        p_installments: installmentsList
      });
      if (error) throw new Error(error.message);
      return data;
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

    // Calcula pagamentos
    const totalPaid = paymentsList.reduce((acc, p) => acc + (parseFloat(p.amount_usd) || 0), 0);
    const totalProfit = order.total_amount_usd - totalCost;
    const balanceDue = Math.max(0, order.total_amount_usd - totalPaid);

    // Cria parcelas se existirem
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

    // Atualiza pedido
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

    // Registra movimentações de venda
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
      const { data, error } = await supabase.rpc('rpc_adjust_device_stock', {
        p_device_id: deviceId,
        p_reason: reason,
        p_notes: notes
      });
      if (error) throw new Error(error.message);
      return data;
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
    const movements = getStored(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    if (deviceId) {
      return movements.filter(m => m.device_id === deviceId);
    }
    return movements;
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

  // Resetar / Re-seed dados de teste
  resetToDemoData() {
    setStored(STORAGE_KEYS.GRADES, INITIAL_GRADES);
    setStored(STORAGE_KEYS.RETAILERS, INITIAL_RETAILERS);
    setStored(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
    setStored(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    setStored(STORAGE_KEYS.INSTALLMENTS, INITIAL_INSTALLMENTS);
    setStored(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    setStored(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
    setStored(STORAGE_KEYS.ADJUSTMENTS, []);
    setStored(STORAGE_KEYS.RETAILER_REFERRALS, INITIAL_RETAILER_REFERRALS);
  }
};

export { AuthService } from './authService.js';

