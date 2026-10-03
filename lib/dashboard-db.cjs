const { Pool } = require('pg');
const { attachDatabasePool } = require('@vercel/functions');
const PROFILE = 'c1acfc7e-9c85-4e23-a451-d518e59c1332';
let pool;
function getPool() {
  if (!process.env.DATABASE_URL) throw Object.assign(Error('Banco não configurado no servidor.'),{status:503});
  if (!pool) {
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('sslmode','verify-full');
    pool = new Pool({connectionString:url.href,max:3,connectionTimeoutMillis:15000,idleTimeoutMillis:5000});
    attachDatabasePool(pool);
  }
  return pool;
}
function validateState(state) {
  const fail = () => {throw Object.assign(Error('Dados inválidos.'),{status:400});};
  if (!state || !Array.isArray(state.machines) || !Array.isArray(state.patrimony) || state.machines.length+state.patrimony.length > 1000) fail();
  const amount = value => {if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1e12) fail();return Math.round(value*100)/100;};
  const saved = amount(state.saved), salary = amount(state.finance?.salary), percent = amount(state.finance?.percent);
  if (percent > 100) fail();
  const seen = new Set();
  const items = [...state.machines.map(item=>({...item,bought:false})),...state.patrimony.map(item=>({...item,bought:true}))].map((item,order)=> {
    if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(item.id) || seen.has(item.id)) fail();
    seen.add(item.id);
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length>300) fail();
    let sourceUrl = item.sourceUrl || null;
    if (sourceUrl) {try {const url=new URL(sourceUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||sourceUrl.length>8192) fail();}catch{fail();}}
    if(item.bought && !Number.isFinite(Date.parse(item.purchasedAt))) fail();
    return {id:item.id,name:item.name.trim(),price:amount(item.price),sourceUrl,bought:item.bought,purchasedAt:item.bought?item.purchasedAt:null,order};
  });
  return {saved,salary,percent,items};
}
async function readState(client=getPool()) {
  const result = await client.query(`SELECT p.revision, f.saved_amount, f.monthly_salary, f.saving_percent,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'price',i.price,'sourceUrl',i.source_url,'bought',i.status='purchased','purchasedAt',i.purchased_at) ORDER BY i.sort_order,i.id) FROM public.itens i WHERE i.profile_id=p.id),'[]'::jsonb) AS items
    FROM public.planejamentos p JOIN public.configuracoes_financeiras f ON f.profile_id=p.id WHERE p.id=$1`,[PROFILE]);
  if(!result.rowCount) throw Error('Planejamento não encontrado.');
  const row=result.rows[0];
  return {revision:Number(row.revision),state:{saved:Number(row.saved_amount),finance:{salary:Number(row.monthly_salary),percent:Number(row.saving_percent)},machines:row.items.filter(item=>!item.bought),patrimony:row.items.filter(item=>item.bought)}};
}
async function writeState(payload, importing=false) {
  const data=validateState(payload.state);
  if(!Number.isSafeInteger(payload.revision)||payload.revision<0) throw Object.assign(Error('Versão inválida.'),{status:400});
  const client=await getPool().connect();
  try {
    await client.query('BEGIN');
    const current=await client.query('SELECT revision FROM public.planejamentos WHERE id=$1 FOR UPDATE',[PROFILE]);
    if(Number(current.rows[0]?.revision)!==payload.revision) throw Object.assign(Error('Os dados mudaram em outro dispositivo. Recarregue antes de editar.'),{status:409});
    if(!importing) await client.query('DELETE FROM public.itens WHERE profile_id=$1 AND NOT(id=ANY($2::uuid[]))',[PROFILE,data.items.map(item=>item.id)]);
    for(const item of data.items) {
      if(importing){
        const duplicate=await client.query('SELECT id FROM public.itens WHERE profile_id=$1 AND ((source_url IS NOT NULL AND source_url=$2) OR (name=$3 AND price=$4)) LIMIT 1',[PROFILE,item.sourceUrl,item.name,item.price]);
        if(duplicate.rowCount)continue;
      }
      await client.query(`INSERT INTO public.itens (id,profile_id,name,price,status,source_url,purchased_at,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(id) DO ${importing?'NOTHING':'UPDATE SET name=EXCLUDED.name,price=EXCLUDED.price,status=EXCLUDED.status,source_url=EXCLUDED.source_url,purchased_at=EXCLUDED.purchased_at,sort_order=EXCLUDED.sort_order WHERE itens.profile_id=EXCLUDED.profile_id'}`,[item.id,PROFILE,item.name,item.price,item.bought?'purchased':'planned',item.sourceUrl,item.purchasedAt,item.order]);
    }
    if(!importing || payload.revision===0) await client.query('UPDATE public.configuracoes_financeiras SET saved_amount=$2,monthly_salary=$3,saving_percent=$4 WHERE profile_id=$1',[PROFILE,data.saved,data.salary,data.percent]);
    await client.query('UPDATE public.planejamentos SET revision=revision+1 WHERE id=$1',[PROFILE]);
    const result=await readState(client);
    await client.query('COMMIT');return result;
  } catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
module.exports={readState,writeState,validateState,getPool};
