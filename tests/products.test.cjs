const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const {server,isPublic} = require('../server.cjs');
const context = vm.createContext({URL});
vm.runInContext(fs.readFileSync('assets/js/products.js','utf8'),context);
test('links das três lojas preservam variantes e identificam o produto', () => {
  const examples = [
    'https://maksiwastore.com/produtos/esquadrejadeira-2900-mm-com-eixo-inclinavel-esq-2900-i-black-edition/?variant=1260319642&gclid=test',
    'https://www.madeiranit.com.br/esquadrejadeira-sec-3-ir-com-eixo-inclinavel-e-riscador-c-motor-trifasico-baldan?region_id=000001&loja_54',
    'https://www.lojadomecanico.com.br/produto/122841/21/224/serra-esquadrejadeira-sec3ir-com-eixo-inclinavel-e-riscador-3cv-220v-monofasico-baldan-7899577700849/153/?srsltid=test'
  ];
  for (const url of examples) {
    const normalized = context.normalizeUrl(url);
    assert.match(context.machineNameFromUrl(normalized), /esquadrejadeira/i);
    assert.ok(!normalized.includes('gclid') && !normalized.includes('srsltid'));
  }
  assert.match(context.normalizeUrl(examples[0]), /variant=1260319642/);
  assert.match(context.normalizeUrl(examples[1]), /region_id=000001/);
});
test('redirecionamento Google e protocolos inválidos', () => {
  assert.equal(context.normalizeUrl('https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fproduto'), 'https://example.com/produto');
  for (const value of ['javascript:alert(1)','file:///etc/passwd','https://user:pass@example.com']) assert.equal(context.normalizeUrl(value),'');
  assert.equal(context.cleanProductName('Para prosseguir, confirme seu acesso...', 'https://example.com/serra-esquadrejadeira/'), 'serra esquadrejadeira');
});
test('ignora produtos recomendados com outro endereço', () => {
  const selected = { '@type':'Product', name:'Produto principal', url:'https://example.com/principal', offers:{price:'10460'} };
  const recommendation = { '@type':'Product', name:'Recomendado', url:'https://example.com/outro', offers:{price:'56958.58'} };
  const doc = {
    querySelectorAll: () => [recommendation,selected].map(product => ({textContent:JSON.stringify(product)})),
    querySelector: () => ({textContent:'Produto principal'})
  };
  const product = context.getJsonLdProductData(doc,'https://example.com/principal?variant=1');
  assert.equal(product.name,'Produto principal');
  assert.equal(product.price,'10460');
});
test('servidor bloqueia rede privada e não expõe arquivos internos', async () => {
  for (const ip of ['127.0.0.1','10.0.0.1','192.168.1.1','169.254.169.254','::1']) assert.equal(isPublic(ip),false);
  assert.equal(isPublic('8.8.8.8'),true);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const page of ['index.html','patrimonio.html','financeiro.html']) {
      const response = await fetch(`${base}/${page}`); assert.equal(response.status,200);
      const html = await response.text(); assert.ok(!html.includes('{{')); assert.match(html,/data-page=/);
    }
    assert.equal((await fetch(`${base}/server.cjs`)).status,404);
    assert.equal((await fetch(`${base}/api/product?url=http://127.0.0.1/`)).status,422);
  } finally {await new Promise(resolve => server.close(resolve));}
});

test('cadastro por link adiciona diretamente à lista quando a loja fornece os dados', async () => {
  let saves = 0;
  let requests = 0;
  let finishFetch;
  const doc = {
    querySelectorAll: () => [],
    querySelector: selector => {
      if (selector.startsWith('meta[property="og:title"]')) return {content:'Serra de bancada'};
      if (selector.startsWith('meta[property="product:price:amount"]')) return {content:'10460.00'};
      return null;
    }
  };
  const flow = vm.createContext({URL,AbortController,setTimeout,clearTimeout,
    currentView:'opening',addByLinkButton:{disabled:false},
    productUrlInput:{value:'https://example.com/serra?variant=220v&gclid=tracking',focus(){}},
    linkStatus:{dataset:{}},state:{machines:[]},persistAndRenderAll:()=>{saves++;},
    DOMParser:class {parseFromString(){return doc;}},
    fetch:()=>{requests++; return new Promise(resolve=>{finishFetch=resolve;});}
  });
  vm.runInContext(fs.readFileSync('assets/js/format.js','utf8'),flow);
  vm.runInContext(fs.readFileSync('assets/js/products.js','utf8'),flow);
  const pending = flow.addMachineFromLink();
  // Navigation can re-enable the DOM button while a request is pending.
  flow.addByLinkButton.disabled = false;
  await flow.addMachineFromLink();
  assert.equal(requests,1);
  finishFetch({ok:true,text:async()=>JSON.stringify({html:'<h1>Serra de bancada</h1>'})});
  await pending;
  assert.equal(saves,1);
  assert.equal(flow.state.machines.length,1);
  assert.equal(flow.state.machines[0].name,'Serra de bancada');
  assert.equal(flow.state.machines[0].price,10460);
  assert.equal(flow.state.machines[0].sourceUrl,'https://example.com/serra?variant=220v');
  assert.equal(flow.productUrlInput.value,'');
  assert.equal(flow.addByLinkButton.disabled,false);
});

test('falha na busca não cadastra um produto vazio nem mantém o botão bloqueado', async () => {
  const flow = vm.createContext({URL,AbortController,setTimeout,clearTimeout,
    currentView:'opening',addByLinkButton:{disabled:false},productUrlInput:{value:'https://example.com/serra',focus(){}},
    linkStatus:{dataset:{}},state:{machines:[]},fetch:async()=>({ok:false,status:422})
  });
  vm.runInContext(fs.readFileSync('assets/js/products.js','utf8'),flow);
  await flow.addMachineFromLink();
  assert.equal(flow.state.machines.length,0);
  assert.equal(flow.productUrlInput.value,'https://example.com/serra');
  assert.equal(flow.addByLinkButton.disabled,false);
  assert.match(flow.linkStatus.textContent,/Adicionar item/);
});
