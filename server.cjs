const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns').promises;
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
if (!process.env.VERCEL && fs.existsSync(path.join(root,'.env.local'))) {
  const env = require('node:util').parseEnv(fs.readFileSync(path.join(root,'.env.local'),'utf8'));
  for (const [key,value] of Object.entries(env)) if(!process.env[key]) process.env[key]=value;
}
function isPublic(address) {
  if (net.isIP(address) !== 4) return false;
  const [a,b] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)));
}
async function readProduct(value, redirects = 0, deadline = Date.now() + 9000) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (url.port && !['80','443'].includes(url.port))) throw Error('Link inválido');
  const addresses = await dns.lookup(url.hostname, {all:true, family:4});
  if (!addresses.length || addresses.some(entry => !isPublic(entry.address))) throw Error('Endereço não permitido');
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw Error('Tempo esgotado');
  return new Promise((resolve,reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(url, {lookup: (_host,options,callback) => options.all ? callback(null, [addresses[0]]) : callback(null, addresses[0].address, 4), headers: {'User-Agent':'MorazziniPlanner/1.0', Accept:'text/html'}}, response => {
      if ([301,302,303,307,308].includes(response.statusCode)) {
        response.resume();
        if (redirects >= 4 || !response.headers.location) return reject(Error('Redirecionamento inválido'));
        return readProduct(new URL(response.headers.location,url).href, redirects+1, deadline).then(resolve,reject);
      }
      if (response.statusCode !== 200 || !/text\/html|application\/xhtml/i.test(response.headers['content-type'] || '')) {response.resume(); return reject(Error('Loja indisponível'));}
      const chunks = []; let size = 0;
      response.on('data',chunk => { size += chunk.length; if (size > 5_000_000) req.destroy(Error('Página muito grande')); else chunks.push(chunk); });
      response.on('end',() => resolve(Buffer.concat(chunks).toString('utf8')));
      response.on('error',reject);
    });
    const timer = setTimeout(() => req.destroy(Error('Tempo esgotado')), remaining);
    req.on('close', () => clearTimeout(timer));
    req.on('error',reject);
  });
}
const publicFiles = /^(?:index\.html|patrimonio\.html|financeiro\.html|assets\/(?:css|js)\/[\w.-]+|Logo\/[^/]+)$/;
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url,'http://localhost');
  if (['/api/state','/api/session','/api/import','/api/default-items'].includes(url.pathname)) return require('./lib/dashboard-api.cjs').handler(req,res);
  if (req.method !== 'GET') {res.writeHead(405); return res.end();}
  if (url.pathname === '/api/product') {
    res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store');
    try {res.end(JSON.stringify({html:await readProduct(url.searchParams.get('url'))}));}
    catch {res.writeHead(422); res.end(JSON.stringify({error:'Não foi possível ler a loja. Preencha os dados manualmente.'}));}
    return;
  }
  let file;
  try {file = decodeURIComponent(url.pathname).replace(/^\//,'') || 'index.html';} catch {res.writeHead(400);return res.end();}
  if (!publicFiles.test(file)) {res.writeHead(404);return res.end();}
  try {
    const data = await fs.promises.readFile(path.join(root,file));
    res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'})[path.extname(file)] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.end(data);
  } catch {res.writeHead(404);res.end();}
});
if (require.main === module) server.listen(Number(process.env.PORT || 3000),'0.0.0.0', () => console.log('Morazzini: http://localhost:' + (process.env.PORT || 3000)));
module.exports = {server, isPublic, readProduct};
