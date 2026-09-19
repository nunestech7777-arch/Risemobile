import { DataService } from './supabaseClient.js';

/**
 * Normaliza um payload de aparelho vindo de qualquer formato de API externa
 * para a estrutura padrão aceita pela RiseMobile.
 */
export const normalizeExternalDevicePayload = (externalDevice, defaultSource = 'EXTERNAL_SYSTEM') => {
  if (!externalDevice) return null;

  const externalId = (
    externalDevice.external_id || 
    externalDevice.id || 
    externalDevice.externalId || 
    externalDevice.sku || 
    ''
  ).toString().trim();

  const imei = (
    externalDevice.imei || 
    externalDevice.serial || 
    externalDevice.serialNumber || 
    externalDevice.imei1 || 
    ''
  ).toString().replace(/\D/g, '');

  const model = (
    externalDevice.model || 
    externalDevice.modelo || 
    externalDevice.name || 
    ''
  ).toString().trim();

  const storage = (
    externalDevice.storage || 
    externalDevice.capacidade || 
    externalDevice.capacity || 
    '128GB'
  ).toString().trim();

  const color = (
    externalDevice.color || 
    externalDevice.cor || 
    ''
  ).toString().trim();

  const batteryHealth = parseInt(
    externalDevice.battery_health ?? 
    externalDevice.battery ?? 
    externalDevice.saude_bateria ?? 
    '', 
    10
  );

  const costPrice = parseFloat(
    externalDevice.cost_price_usd ?? 
    externalDevice.cost ?? 
    externalDevice.custo_usd ?? 
    0
  );

  const suggestedPrice = parseFloat(
    externalDevice.suggested_price_usd ?? 
    externalDevice.price ?? 
    externalDevice.preco_sugerido ?? 
    (costPrice * 1.25)
  );

  return {
    external_id: externalId || (imei ? `ext-${imei}` : ''),
    external_source: externalDevice.external_source || defaultSource,
    external_updated_at: externalDevice.updated_at || new Date().toISOString(),
    imei,
    model,
    storage,
    grade_id: externalDevice.grade_id || null,
    grade_name: externalDevice.grade_name || externalDevice.grade || 'A++',
    color,
    battery_health: isNaN(batteryHealth) ? null : Math.max(0, Math.min(100, batteryHealth)),
    cost_price_usd: isNaN(costPrice) ? 0 : costPrice,
    suggested_price_usd: isNaN(suggestedPrice) ? 0 : suggestedPrice,
    sync_status: 'synced',
    last_synced_at: new Date().toISOString()
  };
};

/**
 * Provedor de Integração Externa (Adapter Pattern)
 * Permite plugar diferentes provedores de estoque sem acoplar a interface ou regras internas.
 */
export class ExternalInventoryProvider {
  constructor(sourceName = 'EXTERNAL_API') {
    this.sourceName = sourceName;
  }

  /**
   * Sincroniza uma lista de aparelhos recebidos do sistema externo com o estoque da RiseMobile.
   * A operação é totalmente idempotente e protege estados comerciais internos.
   */
  async syncDevices(rawExternalDevices) {
    if (!Array.isArray(rawExternalDevices) || rawExternalDevices.length === 0) {
      return { success: true, count: 0, message: 'Nenhum aparelho recebido para sincronização.' };
    }

    // Normaliza todos os registros
    const normalizedDevices = rawExternalDevices
      .map(item => normalizeExternalDevicePayload(item, this.sourceName))
      // IMEI é opcional: sem IMEI o aparelho externo é identificado pelo external_id
      .filter(item => item && (item.imei || item.external_id) && item.model);

    // Envia para o motor de UPSERT idempotente do DataService
    return await DataService.syncExternalDevices(normalizedDevices, this.sourceName);
  }
}

// Instância padrão do adapter de integração
export const defaultInventoryIntegration = new ExternalInventoryProvider('EXTERNAL_SYSTEM');
