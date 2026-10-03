const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');
const command = process.argv[2] || 'inspect';
const envFile = process.argv[3] || '.env.local';
const env = fs.existsSync(envFile) ? require('node:util').parseEnv(fs.readFileSync(envFile,'utf8')) : {};
const connectionString = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw Error('Defina DATABASE_URL_UNPOOLED no arquivo de ambiente.');
const connectionUrl = new URL(connectionString);
if (connectionUrl.hostname.includes('-pooler')) throw Error('Use conexão direta para migrações.');
connectionUrl.searchParams.set('sslmode', 'verify-full');
const client = new Client({ connectionString: connectionUrl.href, connectionTimeoutMillis: 15000, query_timeout: 20000 });

async function migrationTable() {
  const result = await client.query("SELECT to_regclass('public.migracoes_dashboard') AS renamed");
  return result.rows[0].renamed ? 'public.migracoes_dashboard' : 'public.dashboard_schema_migrations';
}

async function migrate() {
  await client.query('BEGIN');
  try {
    await client.query("SELECT pg_advisory_xact_lock(51928371)");
    let ledger = await migrationTable();
    await client.query(`CREATE TABLE IF NOT EXISTS ${ledger} (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    const dir = path.join(__dirname,'../db/migrations');
    for (const name of fs.readdirSync(dir).filter(name=>name.endsWith('.sql')).sort()) {
      const sql = fs.readFileSync(path.join(dir,name),'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const existing = await client.query(`SELECT checksum FROM ${ledger} WHERE name = $1`,[name]);
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) throw Error('Migração alterada após aplicação: '+name);
        console.log('Já aplicada: '+name); continue;
      }
      await client.query(sql);
      ledger = await migrationTable();
      await client.query(`INSERT INTO ${ledger} (name, checksum) VALUES ($1,$2)`,[name,checksum]);
      console.log('Aplicada: '+name);
    }
    await client.query('COMMIT');
  } catch(error) { await client.query('ROLLBACK'); throw error; }
}

async function verify() {
  await client.query('BEGIN');
  try {
    const profile = 'c1acfc7e-9c85-4e23-a451-d518e59c1332';
    const inserted = await client.query("INSERT INTO public.itens (profile_id,name,price,source_url) VALUES ($1,'Teste temporário',123.45,'https://example.com/produto') RETURNING id",[profile]);
    const id = inserted.rows[0].id;
    await client.query("UPDATE public.itens SET status='purchased',purchased_at=now() WHERE id=$1",[id]);
    const item = await client.query('SELECT status, price FROM public.itens WHERE id=$1',[id]);
    if (item.rows[0].status !== 'purchased' || item.rows[0].price !== '123.45') throw Error('Persistência de compra falhou');
    for (const sql of [
      "UPDATE public.itens SET price=-1 WHERE id=$1",
      "UPDATE public.itens SET status='planned' WHERE id=$1",
      "UPDATE public.itens SET source_url='javascript:alert(1)' WHERE id=$1",
      "UPDATE public.configuracoes_financeiras SET saving_percent=101 WHERE profile_id=$1"
    ]) {
      await client.query('SAVEPOINT validation');
      let rejected = false;
      try { await client.query(sql,[sql.includes('configuracoes_financeiras') ? profile : id]); }
      catch(error) { if (error.code === '23514') rejected = true; else throw error; }
      await client.query('ROLLBACK TO SAVEPOINT validation');
      if (!rejected) throw Error('Restrição esperada não foi aplicada');
    }
    console.log('Verificado: cadastro, compra, valores decimais e restrições. Dados de teste revertidos.');
  } finally {await client.query('ROLLBACK');}
}

(async () => {
  await client.connect();
  try {
    if (command === 'migrate') await migrate();
    else if (command === 'verify') await verify();
    else if (command !== 'inspect') throw Error('Comando inválido');
    const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
    console.log('Tabelas: '+result.rows.map(row=>row.table_name).join(', '));
  } finally {await client.end();}
})().catch(error => {console.error('Banco: '+(error.code || error.name)+' — '+error.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[conexão omitida]'));process.exitCode=1;});
