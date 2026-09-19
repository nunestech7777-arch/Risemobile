import { DataService } from '../src/lib/supabaseClient.js';
import assert from 'assert';

console.log('================================================================================');
console.log('🧪 INICIANDO TESTES DO CADASTRO FLEXÍVEL DE LOJISTAS');
console.log('================================================================================\n');

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [TESTE ${total}] APROVADO: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [TESTE ${total}] FALHOU: ${name}`);
      console.error(err);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [TESTE ${total}] APROVADO: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [TESTE ${total}] FALHOU: ${name}`);
      console.error(err);
    }
  }

  // Teste 1: Cadastrar lojista apenas com store_name
  await asyncTest('Cadastro de lojista preenchendo APENAS o Nome da Loja', async () => {
    const minimalRetailer = await DataService.saveRetailer({
      store_name: 'Loja Apenas Nome SP'
    });

    assert.ok(minimalRetailer.id, 'Lojista deve ter um ID gerado');
    assert.strictEqual(minimalRetailer.store_name, 'Loja Apenas Nome SP');
    assert.strictEqual(minimalRetailer.contact_name, '');
    assert.strictEqual(minimalRetailer.whatsapp, '');
    assert.strictEqual(minimalRetailer.city, '');
    assert.strictEqual(minimalRetailer.state, '');

    // Verificar se aparece na listagem
    const all = await DataService.getRetailers();
    const found = all.find(r => r.id === minimalRetailer.id);
    assert.ok(found, 'Lojista cadastrado apenas com nome deve constar na listagem de lojistas');
  });

  // Teste 2: Cadastrar lojista com store_name + alguns campos opcionais
  await asyncTest('Cadastro de lojista com Nome da Loja + apenas WhatsApp e Cidade', async () => {
    const partialRetailer = await DataService.saveRetailer({
      store_name: 'Tech Mobile Express',
      whatsapp: '11988887777',
      city: 'Campinas'
    });

    assert.ok(partialRetailer.id);
    assert.strictEqual(partialRetailer.store_name, 'Tech Mobile Express');
    assert.strictEqual(partialRetailer.whatsapp, '11988887777');
    assert.strictEqual(partialRetailer.city, 'Campinas');
    assert.strictEqual(partialRetailer.document, '');
    assert.strictEqual(partialRetailer.contact_name, '');
  });

  // Teste 3: Bloqueio estrito se store_name estiver vazio
  await asyncTest('Bloqueio estrito quando Nome da Loja está vazio', async () => {
    let errorCaught = null;
    try {
      await DataService.saveRetailer({
        store_name: '   ',
        whatsapp: '11999999999'
      });
    } catch (err) {
      errorCaught = err;
    }

    assert.ok(errorCaught, 'Deve lançar erro quando o nome da loja for vazio');
    assert.strictEqual(errorCaught.message, 'Informe o nome da loja.');
  });

  // Teste 4: Permitir editar lojista posteriormente para completar dados
  await asyncTest('Editar lojista cadastrado previamente apenas com nome para adicionar dados completos', async () => {
    const initial = await DataService.saveRetailer({
      store_name: 'Loja Rápida Para Edição'
    });

    const updated = await DataService.saveRetailer({
      id: initial.id,
      store_name: 'Loja Rápida Para Edição VIP',
      contact_name: 'Carlos Oliveira',
      whatsapp: '11977776666',
      city: 'São Paulo',
      state: 'SP',
      address: 'Rua Sta Ifigênia, 100',
      document: '12.345.678/0001-90',
      notes: 'Desconto de 2% para pagamento à vista'
    });

    assert.strictEqual(updated.id, initial.id);
    assert.strictEqual(updated.store_name, 'Loja Rápida Para Edição VIP');
    assert.strictEqual(updated.contact_name, 'Carlos Oliveira');
    assert.strictEqual(updated.whatsapp, '11977776666');
    assert.strictEqual(updated.document, '12.345.678/0001-90');
    assert.strictEqual(updated.city, 'São Paulo');
    assert.strictEqual(updated.state, 'SP');
    assert.strictEqual(updated.address, 'Rua Sta Ifigênia, 100');
    assert.strictEqual(updated.notes, 'Desconto de 2% para pagamento à vista');
  });

  console.log('\n================================================================================');
  console.log(`🎉 TESTES CONCLUÍDOS: ${passed}/${total} APROVADOS`);
  console.log('================================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
