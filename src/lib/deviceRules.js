// RISEMOBILE: regras de exclusão de aparelhos (usadas pela interface e pelo motor local).
// A regra definitiva vive no banco (rpc_delete_device, migration 018); isto só antecipa a resposta na tela.

export const DEVICE_DELETE_BLOCKED_MESSAGE =
  'Este aparelho possui vínculos com pedido, venda, reserva ou movimentações financeiras. Para preservar o histórico e a integridade dos dados, ele não pode ser apagado. Use ajuste de estoque ou cancele o vínculo relacionado.';

export const DELETE_REASON_OPTIONS = [
  'Cadastro duplicado',
  'Cadastro feito por engano',
  'Dados incorretos',
  'Outro'
];

// Monta o texto gravado em deletion_reason ('Outro' exige observação).
export const buildDeletionReason = (choice, note = '') => {
  const cleanNote = (note || '').trim();
  if (!choice) return '';
  if (choice === 'Outro') return cleanNote ? `Outro — ${cleanNote}` : '';
  return cleanNote ? `${choice} — ${cleanNote}` : choice;
};

// Ids de aparelhos com qualquer movimentação além da Entrada (reserva, venda, devolução, ajuste...).
export const getDevicesWithCommercialHistory = (movements = []) =>
  new Set(movements.filter(m => m.movement_type !== 'Entrada').map(m => m.device_id));

// Retorna null quando a tela pode oferecer a exclusão, ou o motivo do bloqueio.
export const getDeviceDeleteBlock = (device, commercialDeviceIds = new Set()) => {
  if (!device) return 'Aparelho não encontrado.';
  if (device.status !== 'Disponível') {
    return `Aparelho ${device.status}: não pode ser apagado.`;
  }
  if (commercialDeviceIds.has(device.id)) {
    return 'Este aparelho já teve reserva, venda, devolução ou ajuste.';
  }
  return null;
};
