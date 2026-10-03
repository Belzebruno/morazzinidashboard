const crypto=require('node:crypto');
const db=require('./dashboard-db.cjs');
async function consume(req){
  const ip=process.env.VERCEL ? (req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || 'unknown') : (req.socket?.remoteAddress || 'local');
  const key=crypto.createHmac('sha256',process.env.DASHBOARD_SESSION_SECRET).update(String(ip)).digest('hex');
  const result=await db.getPool().query(`INSERT INTO public.tentativas_login (chave,tentativas) VALUES ($1,1)
    ON CONFLICT(chave) DO UPDATE SET
      tentativas=CASE WHEN tentativas_login.inicio_janela < now()-interval '15 minutes' THEN 1 ELSE tentativas_login.tentativas+1 END,
      inicio_janela=CASE WHEN tentativas_login.inicio_janela < now()-interval '15 minutes' THEN now() ELSE tentativas_login.inicio_janela END
    RETURNING tentativas`,[key]);
  return {allowed:result.rows[0].tentativas<=5,key};
}
async function clear(key){await db.getPool().query('DELETE FROM public.tentativas_login WHERE chave=$1',[key]);}
module.exports={consume,clear};
