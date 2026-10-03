let databaseReady = false;
let databaseRevision = 0;
let pendingSave = null;
let saving = false;
let saveTimer;
const BACKUP_KEY = STORAGE_KEY + '-before-neon';
function panelNotice(message='') {
  const notice=document.querySelector('#syncStatus');
  notice.textContent=message;
  notice.hidden=!message;
  document.querySelector('.database-bar').hidden=!message && document.querySelector('#importLocal').hidden && document.querySelector('#retrySync').hidden;
}
function assignIds(payload) {
  for(const item of [...payload.machines,...payload.patrimony]) {
    if(!item.id) item.id = crypto.randomUUID();
    if(item.bought && !item.purchasedAt) item.purchasedAt = new Date().toISOString();
  }
  return payload;
}
async function databaseRequest(url,options={}) {
  const response = await fetch(url,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers}});
  const data = await response.json();
  if(!response.ok) throw Object.assign(Error(data.error||'Erro ao salvar.'),{status:response.status});
  return data;
}
function applyDatabase(result) {
  databaseRevision=result.revision;
  state=normalizeState(result.state);
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  savedInput.value=formatMoney(state.saved);
  financeSalaryInput.value=formatMoney(state.finance.salary);
  financePercentInput.value=formatPercent(state.finance.percent);
  renderViewChrome();renderMachines();renderTotals();
}
function queueDatabaseSave() {
  if(!databaseReady)return;
  pendingSave=JSON.parse(JSON.stringify(assignIds(state)));
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  clearTimeout(saveTimer);saveTimer=setTimeout(flushDatabaseSave,450);
}
async function flushDatabaseSave() {
  if(saving||!pendingSave)return;
  saving=true;
  let failed=false;
  try {
    while(pendingSave){
      const snapshot=pendingSave;pendingSave=null;
      try{
        const result=await databaseRequest('/api/state',{method:'PUT',body:JSON.stringify({state:snapshot,revision:databaseRevision})});
        databaseRevision=result.revision;
      }catch(error){pendingSave=pendingSave||snapshot;throw error;}
    }
    document.querySelector('#retrySync').hidden=true;
    panelNotice();
  }catch(error){
    failed=true;
    localStorage.setItem(BACKUP_KEY,JSON.stringify(state));
    panelNotice(error.message+' A cópia local foi preservada.');
    if(error.status===409){databaseReady=false;document.querySelector('.app').inert=true;}
    document.querySelector('#retrySync').hidden=false;
  }finally{saving=false;if(!failed&&pendingSave)flushDatabaseSave();}
}
async function initializeDatabase() {
  databaseReady=false;
  document.querySelector('.app').hidden=true;
  for(const id of ['logout','importLocal','retrySync']) document.querySelector('#'+id).hidden=true;
  panelNotice();
  try{
    await databaseRequest('/api/session');
    document.querySelector('#loginPanel').hidden=true;
    const result=await databaseRequest('/api/state');
    let local=loadState();
    assignIds(local);
    if(localStorage.getItem(STORAGE_KEY) && !localStorage.getItem(BACKUP_KEY) && result.revision===0) localStorage.setItem(BACKUP_KEY,JSON.stringify(local));
    if(result.revision===0 && !result.state.machines.length && !result.state.patrimony.length) {
      if(!localStorage.getItem(STORAGE_KEY)) {
        local.machines=(await databaseRequest('/api/default-items')).items;
        assignIds(local);
      }
      const imported=await databaseRequest('/api/import',{method:'POST',body:JSON.stringify({state:local,revision:result.revision})});
      applyDatabase(imported);localStorage.removeItem(BACKUP_KEY);
    }else {
      // Preserve an old browser-only list before replacing its cache with the database.
      if(!localStorage.getItem(STORAGE_KEY+'-synced') && localStorage.getItem(STORAGE_KEY) && !localStorage.getItem(BACKUP_KEY)) localStorage.setItem(BACKUP_KEY,JSON.stringify(local));
      applyDatabase(result);
    }
    localStorage.setItem(STORAGE_KEY+'-synced','1');
    databaseReady=true;
    document.querySelector('.app').hidden=false;
    document.querySelector('.app').inert=false;
    requestAnimationFrame(()=>machineList.querySelectorAll('.machine-name').forEach(resizeNameField));
    document.querySelector('#importLocal').hidden=!localStorage.getItem(BACKUP_KEY);
    document.querySelector('#logout').hidden=false;
    panelNotice();
  }catch(error){
    if(error.status===401){document.querySelector('#loginPanel').hidden=false;}
    else{document.querySelector('#retrySync').hidden=false;panelNotice(error.message);}
  }
}
document.querySelector('#loginForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const button=event.submitter;button.disabled=true;
  try{await databaseRequest('/api/session',{method:'POST',body:JSON.stringify({username:document.querySelector('#dashboardUsername').value.trim(),password:document.querySelector('#dashboardPassword').value})});document.querySelector('#dashboardPassword').value='';await initializeDatabase();}
  catch(error){panelNotice(error.message);}finally{button.disabled=false;}
});
document.querySelector('#importLocal').addEventListener('click',async event=>{
  await flushDatabaseSave();
  if(pendingSave||saving)return;
  if(!confirm('Adicionar ao banco os itens da antiga lista deste navegador? Os valores financeiros já salvos no banco serão mantidos.'))return;
  event.target.disabled=true;
  try{
    const backup=assignIds(normalizeState(JSON.parse(localStorage.getItem(BACKUP_KEY))));
    localStorage.setItem(BACKUP_KEY,JSON.stringify(backup));
    applyDatabase(await databaseRequest('/api/import',{method:'POST',body:JSON.stringify({state:backup,revision:databaseRevision})}));
    localStorage.removeItem(BACKUP_KEY);event.target.hidden=true;panelNotice();
  }catch(error){panelNotice(error.message);}finally{event.target.disabled=false;}
});
document.querySelector('#retrySync').addEventListener('click',()=>{
  if(databaseReady&&pendingSave)flushDatabaseSave();
  else{pendingSave=null;initializeDatabase();}
});
document.querySelector('#logout').addEventListener('click',async()=>{
  await flushDatabaseSave();if(pendingSave)return;
  await databaseRequest('/api/session',{method:'DELETE'});databaseReady=false;await initializeDatabase();
});
window.addEventListener('beforeunload',event=>{if(pendingSave||saving){event.preventDefault();event.returnValue='';}});
window.addEventListener('resize',()=>machineList.querySelectorAll('.machine-name').forEach(resizeNameField));
document.querySelectorAll('a[data-view]').forEach(link=>link.addEventListener('click',async event=>{
  if(!pendingSave&&!saving)return;
  event.preventDefault();clearTimeout(saveTimer);
  while(saving)await new Promise(resolve=>setTimeout(resolve,50));
  await flushDatabaseSave();if(!pendingSave)location.href=link.href;
}));
