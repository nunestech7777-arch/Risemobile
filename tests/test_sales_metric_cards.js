// ==============================================================================
// TESTE OFICIAL: 3 Cards Separados no Módulo de Vendas (Controlphone / Risemobile)
// Validação das regras de negócio, cálculos, devoluções, juros e fuso horário.
// ==============================================================================

import { calculateMonthlySalesMetrics, getSaoPauloDateParts } from '../src/lib/salesMetrics.js';
import { formatBRL } from '../src/lib/formatters.js';

let passedCount = 0;
function assert(condition, message) {
  passedCount++;
  if (!condition) {
    console.error(`❌ FALHA: ${message}`);
    process.exit(1);
  }
  console.log(`✅ APROVADO: ${message}`);
}

const RATE = 5.00; // Câmbio de R$ 5,00 por USD para facilitar auditoria matemática

// Helper para criar vendas simuladas no formato do Supabase
const createSale = ({
  id,
  status = 'Finalizado',
  finalizedAt = '2026-10-15T14:00:00-03:00',
  totalAmountUSD = 1000,
  returnedAmountUSD = 0,
  totalProfitUSD = null,
  allocatedDevices = [{ id: 'd1', cost_price_usd: 800 }],
  machineFeeUSD = 0
}) => ({
  id,
  status,
  finalized_at: finalizedAt,
  created_at: finalizedAt,
  total_amount_usd: totalAmountUSD,
  returned_amount_usd: returnedAmountUSD,
  total_profit_usd: totalProfitUSD,
  allocated_devices: allocatedDevices,
  machine_fee_usd: machineFeeUSD
});

console.log('\n--- TESTE 1: Selecionar um mês com vendas ---');
// Venda em Outubro/2026 com 2 aparelhos
const saleOct = createSale({
  id: 'v1',
  status: 'Finalizado',
  finalizedAt: '2026-10-10T15:30:00-03:00',
  totalAmountUSD: 2000,
  allocatedDevices: [
    { id: 'd1', cost_price_usd: 700 },
    { id: 'd2', cost_price_usd: 800 }
  ]
});
const resOct = calculateMonthlySalesMetrics([saleOct], 2026, 10, RATE);
assert(resOct.deviceCount === 2, 'Card 1 (Aparelhos Vendidos) mostra 2 aparelhos');
assert(resOct.totalRevenueBRL === 10000, `Card 2 (Faturamento Total) mostra R$ 10.000,00 (calculado: ${resOct.totalRevenueBRL})`);
assert(formatBRL(resOct.totalRevenueBRL) === 'R$\u00a010.000,00', 'Formatação em moeda brasileira R$ correta');
// Lucro: 2000 - (700 + 800) = 500 USD * 5 = R$ 2.500,00
assert(resOct.totalProfitBRL === 2500, `Card 3 (Lucro Total) mostra R$ 2.500,00 (calculado: ${resOct.totalProfitBRL})`);

console.log('\n--- TESTE 2: Selecionar um mês sem vendas ---');
// Nenhuma venda em Novembro/2026
const resNov = calculateMonthlySalesMetrics([saleOct], 2026, 11, RATE);
assert(resNov.deviceCount === 0, 'Card 1 sem vendas: 0 aparelhos');
assert(resNov.totalRevenueBRL === 0, 'Card 2 sem vendas: R$ 0,00');
assert(formatBRL(resNov.totalRevenueBRL) === 'R$\u00a00,00', 'Faturamento zero formatado corretamente');
assert(resNov.totalProfitBRL === 0, 'Card 3 sem vendas: R$ 0,00');
assert(formatBRL(resNov.totalProfitBRL) === 'R$\u00a00,00', 'Lucro zero formatado corretamente');

console.log('\n--- TESTE 3: Contagem de aparelhos vs pedidos (3 aparelhos em 1 pedido) ---');
// Venda 1: 3 aparelhos em um único pedido
const sale3Devices = createSale({
  id: 'v2',
  status: 'Finalizado',
  finalizedAt: '2026-10-12T10:00:00-03:00',
  totalAmountUSD: 3000,
  allocatedDevices: [
    { id: 'd1', cost_price_usd: 700 },
    { id: 'd2', cost_price_usd: 700 },
    { id: 'd3', cost_price_usd: 700 }
  ]
});
const resMultiDevices = calculateMonthlySalesMetrics([saleOct, sale3Devices], 2026, 10, RATE);
// Total: 2 aparelhos de saleOct + 3 aparelhos de sale3Devices = 5 aparelhos
assert(resMultiDevices.deviceCount === 5, 'Conta 5 aparelhos no total, não a quantidade de pedidos (2 pedidos)');

console.log('\n--- TESTE 4: Venda com juros da maquininha cobrados do cliente ---');
// Exemplo do prompt: Valor do aparelho: R$ 8.000,00 ($1.600 USD), Juros: R$ 200,00 ($40 USD), Custo: R$ 6.500,00 ($1.300 USD)
const saleWithFee = createSale({
  id: 'v_fee',
  status: 'Finalizado',
  finalizedAt: '2026-10-14T11:00:00-03:00',
  totalAmountUSD: 1600, // R$ 8.000,00
  machineFeeUSD: 40,    // R$ 200,00
  allocatedDevices: [{ id: 'd_cost', cost_price_usd: 1300 }] // R$ 6.500,00
});
const resFee = calculateMonthlySalesMetrics([saleWithFee], 2026, 10, RATE);
// Faturamento deve ser: (1600 + 40) * 5 = R$ 8.200,00
assert(resFee.totalRevenueBRL === 8200, `Faturamento inclui juros da maquininha: R$ 8.200,00 (calculado: ${resFee.totalRevenueBRL})`);
// Lucro bruto: (1600 - 1300) * 5 = R$ 1.500,00 (juros NÃO entram no lucro dos aparelhos)
assert(resFee.totalProfitBRL === 1500, `Juros da maquininha NÃO entram no lucro: R$ 1.500,00 (calculado: ${resFee.totalProfitBRL})`);

console.log('\n--- TESTE 5: Exclusão / Cancelamento de Venda ---');
const cancelledSale = createSale({
  id: 'v_cancel',
  status: 'Cancelado',
  finalizedAt: '2026-10-15T12:00:00-03:00',
  totalAmountUSD: 5000,
  allocatedDevices: [{ id: 'dc1', cost_price_usd: 4000 }]
});
const resWithCancelled = calculateMonthlySalesMetrics([saleOct, cancelledSale], 2026, 10, RATE);
assert(resWithCancelled.deviceCount === 2, 'Venda cancelada não adiciona aparelhos');
assert(resWithCancelled.totalRevenueBRL === 10000, 'Venda cancelada não entra no faturamento');
assert(resWithCancelled.totalProfitBRL === 2500, 'Venda cancelada não entra no lucro');

// Excluir a venda (remover do array como o Supabase faz ao deletar)
const resAfterDelete = calculateMonthlySalesMetrics([], 2026, 10, RATE);
assert(resAfterDelete.deviceCount === 0 && resAfterDelete.totalRevenueBRL === 0, 'Exclusão de venda recalcula os 3 cards para 0');

console.log('\n--- TESTE 6: Selecionar o mês anterior ---');
const saleSept = createSale({
  id: 'v_sept',
  status: 'Finalizado',
  finalizedAt: '2026-09-25T16:00:00-03:00',
  totalAmountUSD: 4000,
  allocatedDevices: [
    { id: 'ds1', cost_price_usd: 1200 },
    { id: 'ds2', cost_price_usd: 1200 },
    { id: 'ds3', cost_price_usd: 1200 },
    { id: 'ds4', cost_price_usd: 1200 }
  ]
});
const allSales = [saleOct, saleSept];
const resSept = calculateMonthlySalesMetrics(allSales, 2026, 9, RATE);
assert(resSept.deviceCount === 4, 'Setembro mostra 4 aparelhos vendidos');
assert(resSept.totalRevenueBRL === 20000, 'Setembro mostra faturamento de R$ 20.000,00');

console.log('\n--- TESTE 7: Devolução Parcial de Aparelho ---');
// Venda com 2 aparelhos de $1000 cada, 1 aparelho devolvido ($1000 devolvido)
const saleWithReturn = createSale({
  id: 'v_return',
  status: 'Parcialmente Devolvida',
  finalizedAt: '2026-10-18T10:00:00-03:00',
  totalAmountUSD: 2000,
  returnedAmountUSD: 1000,
  allocatedDevices: [{ id: 'active_1', cost_price_usd: 700 }] // apenas 1 aparelho ativo restou
});
const resReturn = calculateMonthlySalesMetrics([saleWithReturn], 2026, 10, RATE);
assert(resReturn.deviceCount === 1, 'Devolução desconta o aparelho devolvido (resta 1 aparelho ativo)');
assert(resReturn.totalRevenueBRL === 5000, 'Faturamento desconta o valor devolvido: $1000 * 5 = R$ 5.000,00');
assert(resReturn.totalProfitBRL === 1500, 'Lucro é recalculado sobre os produtos não devolvidos: ($1000 - $700) * 5 = R$ 1.500,00');

console.log('\n--- TESTE 8: Fuso Horário America/Sao_Paulo (UTC-3) ---');
// Venda realizada em 2026-10-01T01:00:00Z:
// Em UTC é 01 de Outubro, mas em São Paulo (UTC-3) ainda são 22:00 do dia 30 de Setembro!
const saleEndOfSept = createSale({
  id: 'v_tz_sept',
  status: 'Finalizado',
  finalizedAt: '2026-10-01T01:00:00Z',
  totalAmountUSD: 1000,
  allocatedDevices: [{ id: 'tz1', cost_price_usd: 800 }]
});
const resTzSept = calculateMonthlySalesMetrics([saleEndOfSept], 2026, 9, RATE);
assert(resTzSept.deviceCount === 1, '2026-10-01T01:00:00Z pertence a Setembro no fuso America/Sao_Paulo');

const resTzOct = calculateMonthlySalesMetrics([saleEndOfSept], 2026, 10, RATE);
assert(resTzOct.deviceCount === 0, '2026-10-01T01:00:00Z NÃO pertence a Outubro no fuso America/Sao_Paulo');

console.log(`\n🎉 TODOS OS ${passedCount} TESTES FORAM APROVADOS COM SUCESSO!\n`);
