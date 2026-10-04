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

test('Mercado Livre extrai título e preço da oferta principal nos dois exemplos', () => {
  vm.runInContext(fs.readFileSync('assets/js/format.js','utf8'),context);
  const url = 'https://www.mercadolivre.com.br/produto/p/MLB15564215?pdp_filters=item_id%3AMLB3861626525';
  for (const [name, fraction, cents, expected] of [
    ['Coladeira De Fita De Borda H1100','5.899',undefined,5899],
    ['Plaina elétrica manual DeWalt D26676 8cm cor amarelo','1.335','60',1335.60]
  ]) {
    const amount = {querySelector: selector => ({textContent: selector.endsWith('__fraction') ? fraction : cents})};
    const doc = {
      querySelectorAll: () => [{textContent:JSON.stringify({'@type':'Product',name,url,offers:{price:'9999'}})}],
      querySelector: selector => {
        if (selector === 'h1.ui-pdp-title' || selector === 'h1') return {textContent:name};
        if (selector === '.ui-pdp-price__second-line .andes-money-amount:not(.andes-money-amount--previous)') return amount;
        if (selector.startsWith('meta[property="og:title"]')) return {content:'Título genérico | Mercado Livre'};
        if (selector.startsWith('meta[property="product:price:amount"]')) return {content:'2222'};
        return null;
      }
    };
    context.DOMParser = class {parseFromString() {return doc;}};
    const product = context.extractProductFromHtml('<html></html>',url);
    assert.equal(product.name,name);
    assert.equal(product.price,expected);
  }
});

test('Mercado Livre preserva oferta e remove rastreamento de anúncios', () => {
  const url = context.normalizeUrl('https://www.mercadolivre.com.br/coladeira-de-fita-de-borda-h1100/up/MLBU4033264487?pdp_filters=item_id%3AMLB4731281795\\&matt_tool=123&cq_src=google_ads&from=gshop&gad_source=1');
  assert.equal(new URL(url).searchParams.get('pdp_filters'),'item_id:MLB4731281795');
  assert.equal(new URL(url).searchParams.size,1);
  assert.equal(context.cleanProductName('Coladeira H1100 | Mercado Livre','https://www.mercadolivre.com.br/coladeira-h1100/p/MLB123'),'Coladeira H1100');
  assert.equal(context.isMercadoLivreUrl('https://mercadolivre.com.br.example.org'),false);
});

test('Mercado Livre não usa preços fora da oferta principal', () => {
  const doc = {querySelector: selector => selector === 'h1.ui-pdp-title' ? {textContent:'Plaina'} : null};
  assert.equal(context.getMercadoLivreProductData(doc,'https://www.mercadolivre.com.br/plaina/p/MLB123').price,0);
});
