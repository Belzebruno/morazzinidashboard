const viewPages = {
  opening: { file: 'index.html', title: 'Abertura' },
  patrimony: { file: 'patrimonio.html', title: 'Patrimônio' },
  finance: { file: 'financeiro.html', title: 'Financeiro' }
};

function navigateToView(view, updateHistory=true) {
  if(!viewPages[view]) return;
  currentView=view;
  document.body.dataset.page=view;
  document.title=viewPages[view].title+' | Morazzini';
  renderViewChrome();
  renderMachines();
  renderTotals();
  if(updateHistory) {
    const url=new URL(viewPages[view].file, location.href);
    if(url.href!==location.href) history.pushState(null,'',url);
  }
  window.scrollTo({top:0,left:0,behavior:'auto'});
}

if('scrollRestoration' in history) history.scrollRestoration='manual';

document.querySelectorAll('a[data-view]').forEach(link=>link.addEventListener('click',event=>{
  if(!databaseReady || event.button!==0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  document.activeElement?.blur();
  navigateToView(link.dataset.view);
}));

window.addEventListener('popstate',()=>{
  document.activeElement?.blur();
  const file=location.pathname.split('/').pop() || 'index.html';
  const view=Object.keys(viewPages).find(key=>viewPages[key].file===file) || 'opening';
  navigateToView(view,false);
});
