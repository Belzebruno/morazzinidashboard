const crypto = require('node:crypto');
const {readState,writeState}=require('./dashboard-db.cjs');
const loginLimit=require('./login-limit.cjs');
function json(res,status,data){res.statusCode=status;res.end(JSON.stringify(data));}
function configured(){return process.env.DASHBOARD_USERNAME && process.env.DASHBOARD_PASSWORD_HASH && process.env.DASHBOARD_SESSION_SECRET;}
function authenticated(req){
  if(!configured()) return false;
  const cookie=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('morazzini_session='))?.slice(18);
  if(!cookie) return false;
  const [expires,signature]=cookie.split('.');
  if(!/^\d+$/.test(expires)||Number(expires)<=Date.now()) return false;
  const expected=crypto.createHmac('sha256',process.env.DASHBOARD_SESSION_SECRET).update(expires).digest('hex');
  return /^[a-f\d]{64}$/.test(signature||'') && crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected));
}
async function body(req){
  if(req.body) return typeof req.body==='string'?JSON.parse(req.body):req.body;
  let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>1000000)throw Object.assign(Error('Dados muito grandes.'),{status:413});}
  return JSON.parse(data||'{}');
}
async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const url=new URL(req.url,'http://localhost');
  const secure=req.headers['x-forwarded-proto']==='https'||Boolean(process.env.VERCEL);
  if(req.method!=='GET'){
    const origin=req.headers.origin;
    let validOrigin=false;
    try{validOrigin=origin && new URL(origin).host===req.headers.host;}catch{}
    if(!validOrigin) return json(res,403,{error:'Origem não permitida.'});
  }
  if(!configured())return json(res,503,{error:'Acesso do painel ainda não configurado.'});
  try{
    if(url.pathname==='/api/session'){
      if(req.method==='GET')return json(res,authenticated(req)?200:401,{authenticated:authenticated(req)});
      if(req.method==='DELETE'){res.setHeader('Set-Cookie',`morazzini_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure?'; Secure':''}`);return json(res,200,{ok:true});}
      if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'});
      const attempt=await loginLimit.consume(req);
      if(!attempt.allowed){res.setHeader('Retry-After','900');return json(res,429,{error:'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.'});}
      const {username,password}=await body(req);
      const [salt,hash]=process.env.DASHBOARD_PASSWORD_HASH.split(':');
      if(typeof password!=='string'||password.length>200||!salt||!hash)return json(res,401,{error:'Senha incorreta.'});
      const derived=await new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,(error,key)=>error?reject(error):resolve(key)));
      if(username!==process.env.DASHBOARD_USERNAME||!/^[a-f\d]{128}$/.test(hash)||!crypto.timingSafeEqual(derived,Buffer.from(hash,'hex'))){await new Promise(resolve=>setTimeout(resolve,1000));return json(res,401,{error:'Usuário ou senha incorretos.'});}
      const expires=String(Date.now()+7*86400000);
      await loginLimit.clear(attempt.key);
      const signature=crypto.createHmac('sha256',process.env.DASHBOARD_SESSION_SECRET).update(expires).digest('hex');
      res.setHeader('Set-Cookie',`morazzini_session=${expires}.${signature}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${secure?'; Secure':''}`);
      return json(res,200,{ok:true});
    }
    if(!authenticated(req))return json(res,401,{error:'Entre com a senha do painel.'});
    if(url.pathname==='/api/default-items' && req.method==='GET')return json(res,200,{items:require('./default-items.cjs')});
    if(req.method==='GET')return json(res,200,await readState());
    if(req.method==='PUT'||(req.method==='POST'&&url.pathname==='/api/import'))return json(res,200,await writeState(await body(req),req.method==='POST'));
    return json(res,405,{error:'Método não permitido.'});
  }catch(error){console.error('Dashboard API:',error.code||error.name);return json(res,error.status||500,{error:error.status?error.message:'Não foi possível acessar o banco. Tente novamente.'});}
}
module.exports={handler,authenticated};
