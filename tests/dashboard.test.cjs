const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {validateState}=require('../lib/dashboard-db.cjs');
test('valida itens e finanças antes de acessar o banco',()=>{
  const state={saved:25,finance:{salary:1500,percent:20},machines:[{id:crypto.randomUUID(),name:'Serra',price:123.45,sourceUrl:'https://example.com/serra'}],patrimony:[]};
  assert.equal(validateState(state).items[0].price,123.45);
  for(const change of [{saved:-1},{finance:{salary:1500,percent:101}},{machines:[{...state.machines[0],sourceUrl:'javascript:alert(1)'}]},{machines:[state.machines[0],state.machines[0]]}])assert.throws(()=>validateState({...state,...change}));
});
test('login cria cookie HttpOnly e API bloqueia acesso sem senha',async()=>{
  const salt=crypto.randomBytes(16).toString('hex');
  process.env.DASHBOARD_PASSWORD_HASH=salt+':'+crypto.scryptSync('senha-apenas-teste',salt,64).toString('hex');
  process.env.DASHBOARD_SESSION_SECRET=crypto.randomBytes(32).toString('hex');
  process.env.DASHBOARD_USERNAME='teste';
  const limiter=require('../lib/login-limit.cjs');
  const originalConsume=limiter.consume, originalClear=limiter.clear;
  limiter.consume=async()=>({allowed:true,key:'test'});limiter.clear=async()=>{};
  const {handler,authenticated}=require('../lib/dashboard-api.cjs');
  const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.body=JSON.parse(value);}});
  const unauthorized=response();await handler({url:'/api/state',method:'GET',headers:{}},unauthorized);assert.equal(unauthorized.statusCode,401);
  const login=response();await handler({url:'/api/session',method:'POST',headers:{origin:'https://example.com',host:'example.com','x-forwarded-proto':'https'},body:{username:'teste',password:'senha-apenas-teste'}},login);
  assert.equal(login.statusCode,200);assert.match(login.headers['Set-Cookie'],/HttpOnly; SameSite=Strict/);assert.match(login.headers['Set-Cookie'],/Secure/);
  assert.equal(authenticated({headers:{cookie:login.headers['Set-Cookie'].split(';')[0]}}),true);
  const csrf=response();await handler({url:'/api/state',method:'PUT',headers:{origin:'https://evil.example',host:'example.com'}},csrf);assert.equal(csrf.statusCode,403);
  const defaults=response();await handler({url:'/api/default-items',method:'GET',headers:{}},defaults);assert.equal(defaults.statusCode,401);
  limiter.consume=async()=>({allowed:false});
  const limited=response();await handler({url:'/api/session',method:'POST',headers:{origin:'https://example.com',host:'example.com'},body:{username:'teste',password:'senha-apenas-teste'}},limited);assert.equal(limited.statusCode,429);
  limiter.consume=originalConsume;limiter.clear=originalClear;
});
