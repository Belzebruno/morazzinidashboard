const fs=require('node:fs');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const envFile=process.argv[2];
if(!envFile||!envFile.includes('schema-test'))throw Error('Este teste só deve rodar no ambiente de teste.');
const env=require('node:util').parseEnv(fs.readFileSync(envFile,'utf8'));
process.env.DATABASE_URL=env.DATABASE_URL_UNPOOLED||env.DATABASE_URL;
const db=require('../lib/dashboard-db.cjs');
(async()=>{
  const original=await db.readState();
  let latest=original;
  try{
    const state=JSON.parse(JSON.stringify(original.state));
    const id=crypto.randomUUID();state.machines.push({id,name:'Teste sincronização',price:10460,sourceUrl:'https://example.com/esquadrejadeira'});
    state.saved=500;state.finance={salary:2000,percent:25};
    latest=await db.writeState({state,revision:original.revision});
    assert.equal(latest.state.machines.find(item=>item.id===id).price,10460);
    assert.equal(latest.state.saved,500);
    await assert.rejects(db.writeState({state,revision:original.revision}),error=>error.status===409);
    const bought=latest.state.machines.splice(latest.state.machines.findIndex(item=>item.id===id),1)[0];
    latest.state.patrimony.push({...bought,bought:true,purchasedAt:new Date().toISOString()});
    latest=await db.writeState(latest);
    assert.ok(latest.state.patrimony.some(item=>item.id===id));
    const imported={...original.state,machines:[{id:crypto.randomUUID(),name:'Importado',price:20}],patrimony:[]};
    latest=await db.writeState({state:imported,revision:latest.revision},true);
    assert.equal(latest.state.saved,500);
    const count=latest.state.machines.length;
    imported.machines[0].id=crypto.randomUUID();
    latest=await db.writeState({state:imported,revision:latest.revision},true);
    assert.equal(latest.state.machines.length,count);
    console.log('Verificado: criação, edição financeira, compra, conflito e importação sem duplicatas.');
  }finally{
    const current=await db.readState();await db.writeState({state:original.state,revision:current.revision});await db.getPool().end();
    console.log('Dados de teste restaurados.');
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
