const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('build publica páginas e assets sem arquivos privados', () => {
  for (const page of ['index.html','patrimonio.html','financeiro.html']) {
    assert.match(fs.readFileSync(`dist/${page}`, 'utf8'), /brand-logo/);
  }
  assert.ok(fs.existsSync('dist/assets/js/app.js'));
  assert.ok(!fs.readFileSync('dist/assets/js/config.js','utf8').includes('229.90'));
  for (const file of ['.env.local','.neon','server.cjs','neon.ts','package.json']) assert.equal(fs.existsSync(`dist/${file}`),false);
});

test('função Vercel rejeita métodos inválidos e URLs privadas', async () => {
  const { default: handler } = await import('../api/product.mjs');
  function response() {
    return { headers:{}, setHeader(key,value) { this.headers[key] = value; }, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
  }
  const post = response();
  await handler({method:'POST',url:'/api/product'},post);
  assert.equal(post.code,405);
  const privateUrl = response();
  await handler({method:'GET',url:'/api/product?url=http://127.0.0.1'},privateUrl);
  assert.equal(privateUrl.code,422);
  assert.equal(privateUrl.headers['Cache-Control'],'no-store');
});
