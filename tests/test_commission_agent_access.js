import assert from 'assert';

// Global localStorage polyfill for Node test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = {};
  globalThis.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

import { AuthService } from '../src/lib/authService.js';
import { DataService, STORAGE_KEYS } from '../src/lib/supabaseClient.js';

console.log('🚀 Iniciando Testes de Isolamento e Segurança do Portal do Comissionado...\n');

async function runTests() {
  let passed = 0;
  let failed = 0;

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  // Setup seed mock data
  const mockRetailers = [
    { id: 'ret-1', store_name: 'Tech Store ABC' },
    { id: 'ret-2', store_name: 'Cell Prime VIP' },
    { id: 'ret-3', store_name: 'Mega Store SP' }
  ];

  const mockReferrals = [
    {
      id: 'ref-1',
      retailer_id: 'ret-1',
      retailer_name: 'Tech Store ABC',
      referrer_name: 'Lucas Consultoria',
      agent_id: 'agent-1',
      commission_per_unit: 10,
      total_units: 15,
      total_commission: 150,
      status: 'active'
    },
    {
      id: 'ref-2',
      retailer_id: 'ret-2',
      retailer_name: 'Cell Prime VIP',
      referrer_name: 'Lucas Consultoria',
      agent_id: 'agent-1',
      commission_per_unit: 15,
      total_units: 10,
      total_commission: 150,
      status: 'active'
    },
    {
      id: 'ref-3',
      retailer_id: 'ret-3',
      retailer_name: 'Mega Store SP',
      referrer_name: 'Carlos Representações',
      agent_id: 'agent-2',
      commission_per_unit: 20,
      total_units: 5,
      total_commission: 100,
      status: 'active'
    }
  ];

  const mockOrders = [
    {
      id: 'ord-1',
      retailer_name: 'Tech Store ABC',
      created_at: '2026-03-01T10:00:00Z',
      quantity: 15,
      status: 'completed'
    },
    {
      id: 'ord-2',
      retailer_name: 'Cell Prime VIP',
      created_at: '2026-03-03T11:00:00Z',
      quantity: 10,
      status: 'completed'
    },
    {
      id: 'ord-3',
      retailer_name: 'Mega Store SP',
      created_at: '2026-03-05T14:00:00Z',
      quantity: 5,
      status: 'completed'
    }
  ];

  const mockAgents = [
    {
      id: 'agent-1',
      name: 'Lucas Consultoria',
      email: 'lucas@comissao.com',
      password: 'Rise@1234',
      role: 'commission_agent',
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'agent-2',
      name: 'Carlos Representações',
      email: 'carlos@comissao.com',
      password: 'Rise@5678',
      role: 'commission_agent',
      is_active: false, // Inactive
      created_at: new Date().toISOString()
    }
  ];

  localStorage.setItem(STORAGE_KEYS.RETAILERS, JSON.stringify(mockRetailers));
  localStorage.setItem(STORAGE_KEYS.RETAILER_REFERRALS, JSON.stringify(mockReferrals));
  localStorage.setItem(STORAGE_KEYS.COMMISSION_AGENTS, JSON.stringify(mockAgents));
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(mockOrders));

  // TEST 1: Authentication of Commission Agent
  await asyncTest('1. Autenticação de Comissionado Ativo com role "commission_agent"', async () => {
    const res = await AuthService.signInWithPassword('lucas@comissao.com', 'Rise@1234');
    assert.strictEqual(res.success, true, 'Autenticação deve retornar sucesso');
    assert.strictEqual(res.user.email, 'lucas@comissao.com');
    assert.strictEqual(res.user.role, 'commission_agent');
    assert.strictEqual(res.user.user_metadata.name, 'Lucas Consultoria');
    assert.strictEqual(res.user.user_metadata.role, 'commission_agent');
  });

  // TEST 2: Inactive Commission Agent is blocked from login
  await asyncTest('2. Bloqueio de Login para Comissionado Inativo (is_active: false)', async () => {
    const res = await AuthService.signInWithPassword('carlos@comissao.com', 'Rise@5678');
    assert.strictEqual(res.success, false, 'Deveria bloquear login de comissionado inativo');
    assert.ok(res.error && res.error.includes('desativado'), `Mensagem esperada continha 'desativado', recebeu: ${res.error}`);
  });

  // TEST 3: Commission Agent Data Isolation (Agent 1 only sees their referrals and sales)
  await asyncTest('3. Isolamento Estrito: Comissionado 1 visualiza APENAS suas próprias comissões e lojistas', async () => {
    const portalData = await DataService.getCommissionAgentPortalData('agent-1');

    // Check stores list
    assert.strictEqual(portalData.referrals.length, 2, 'Deveria conter apenas 2 lojas indicadas');
    const storeNames = portalData.referrals.map(r => r.retailer_name);
    assert.ok(storeNames.includes('Tech Store ABC'));
    assert.ok(storeNames.includes('Cell Prime VIP'));
    assert.ok(!storeNames.includes('Mega Store SP'), 'NÃO deve conter Mega Store SP (indicada pelo Agente 2)');

    // Check aggregated metrics
    assert.strictEqual(portalData.summary.totalUnits, 25, 'Total de unidades deve ser 15 + 10 = 25');
    assert.strictEqual(portalData.summary.totalCommissionUSD, 300, 'Total comissão deve ser 150 + 150 = 300');
    assert.strictEqual(portalData.summary.activeStores, 2, 'Total de lojas ativas = 2');
  });

  // TEST 4: Sensitive Data Sanitization (NO IMEIs, Unit Costs, Profit, Margins in payload)
  await asyncTest('4. Higienização de Dados Sensíveis: Ausência total de IMEI, custo unitário e lucro nos dados retornados', async () => {
    const portalData = await DataService.getCommissionAgentPortalData('agent-1');

    const salesHistory = portalData.salesHistory;
    assert.ok(salesHistory.length > 0, 'Histórico de vendas deve ter registros');

    for (const item of salesHistory) {
      assert.strictEqual(item.imei, undefined, 'Propriedade IMEI NUNCA deve existir');
      assert.strictEqual(item.unit_cost_usd, undefined, 'Custo unitário NUNCA deve existir');
      assert.strictEqual(item.profit, undefined, 'Lucro NUNCA deve existir');
      assert.strictEqual(item.margin, undefined, 'Margem NUNCA deve existir');
      assert.ok(item.commission_earned > 0, 'Comissão calculada com sucesso');
      assert.ok(item.store_name === 'Tech Store ABC' || item.store_name === 'Cell Prime VIP', 'Loja pertence ao agente');
    }
  });

  // TEST 5: Agent 2 (Carlos) gets 0 data or only their own store when active
  await asyncTest('5. Comissionado 2 (Carlos) não tem acesso aos dados de Lucas', async () => {
    // Temporarily activate Carlos to query portal data
    await DataService.setCommissionAgentStatus('agent-2', true);

    const portalDataAgent2 = await DataService.getCommissionAgentPortalData('agent-2');

    assert.strictEqual(portalDataAgent2.referrals.length, 1);
    assert.strictEqual(portalDataAgent2.referrals[0].retailer_name, 'Mega Store SP');
    assert.strictEqual(portalDataAgent2.summary.totalUnits, 5);
    assert.strictEqual(portalDataAgent2.summary.totalCommissionUSD, 100);

    const storeNames = portalDataAgent2.referrals.map(r => r.retailer_name);
    assert.ok(!storeNames.includes('Tech Store ABC'));
    assert.ok(!storeNames.includes('Cell Prime VIP'));
  });

  // TEST 6: Inactive Agent query rejected
  await asyncTest('6. Consulta de dados bloqueada se comissionado estiver inativo', async () => {
    await DataService.setCommissionAgentStatus('agent-2', false);
    let errorThrown = false;
    try {
      await DataService.getCommissionAgentPortalData('agent-2'); // agent-2 is_active: false
    } catch (err) {
      errorThrown = true;
      assert.ok(err.message.includes('desativado'));
    }
    assert.strictEqual(errorThrown, true, 'Tentativa de consultar dados com agente desativado deve falhar');
  });

  // TEST 7: Reset Password functionality
  await asyncTest('7. Administrador redefine senha e comissionado acessa com nova senha', async () => {
    const resReset = await DataService.resetCommissionAgentPassword('agent-1', 'Rise@9999');
    assert.strictEqual(resReset.success, true);
    assert.strictEqual(resReset.agent.password, 'Rise@9999');

    // Old password fails
    const oldLogin = await AuthService.signInWithPassword('lucas@comissao.com', 'Rise@1234');
    assert.strictEqual(oldLogin.success, false, 'Senha antiga não deve mais autenticar');

    // New password succeeds
    const newLogin = await AuthService.signInWithPassword('lucas@comissao.com', 'Rise@9999');
    assert.strictEqual(newLogin.success, true);
    assert.strictEqual(newLogin.user.email, 'lucas@comissao.com');
  });

  // TEST 8: Admin can toggle status to activate / deactivate
  await asyncTest('8. Administrador ativa/desativa comissionado em tempo real', async () => {
    // Activate Carlos
    await DataService.setCommissionAgentStatus('agent-2', true);
    const authCarlos = await AuthService.signInWithPassword('carlos@comissao.com', 'Rise@5678');
    assert.strictEqual(authCarlos.success, true);
    assert.strictEqual(authCarlos.user.role, 'commission_agent');

    // Deactivate Lucas
    await DataService.setCommissionAgentStatus('agent-1', false);
    const lucasBlocked = await AuthService.signInWithPassword('lucas@comissao.com', 'Rise@9999');
    assert.strictEqual(lucasBlocked.success, false);
    assert.ok(lucasBlocked.error.includes('desativado'));
  });

  console.log(`\n========================================`);
  console.log(`📊 Resultado dos Testes: ${passed} PASSOU | ${failed} FALHOU`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
