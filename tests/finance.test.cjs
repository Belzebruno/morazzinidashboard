const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function financeView() {
  const totals = Object.fromEntries([
    'plannedLabel', 'planned', 'boughtLabel', 'bought', 'remainingLabel',
    'remaining', 'savedLabel', 'saved', 'missingLabel', 'missing',
    'progressText', 'progressFill', 'progressNote'
  ].map(key => [key, { textContent: '', style: {} }]));
  const context = vm.createContext({
    Intl, Date,
    currency: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    currentView: 'finance',
    state: { machines: [{ price: 10000 }], patrimony: [], saved: 0, finance: { salary: 5000, percent: 20 } },
    progressPanel: { classList: { add() {} } },
    progressHeading: {}, savedMoneyPanel: {}, savedInput: {}, financeInsight: {}, totals
  });
  for (const file of ['format.js', 'views.js']) {
    vm.runInContext(fs.readFileSync(`assets/js/${file}`, 'utf8'), context);
  }
  return context;
}

test('progresso financeiro representa dinheiro guardado, independente da reserva mensal', () => {
  const view = financeView();
  view.renderTotals();
  assert.equal(view.totals.progressFill.style.width, '0%');
  assert.equal(view.totals.progressText.textContent, '0%');
  assert.equal(view.savedInput.disabled, false);

  view.state.saved = 5000;
  view.renderTotals();
  assert.equal(view.totals.progressFill.style.width, '50%');
  assert.equal(view.totals.progressText.textContent, '50%');

  view.state.finance.percent = 80;
  view.renderTotals();
  assert.equal(view.totals.progressFill.style.width, '50%');
});

test('progresso financeiro respeita o limite e não inventa um objetivo sem máquinas', () => {
  const view = financeView();
  view.state.saved = 15000;
  view.renderTotals();
  assert.equal(view.totals.progressFill.style.width, '100%');

  view.state.machines = [];
  view.renderTotals();
  assert.equal(view.totals.progressFill.style.width, '0%');
  assert.match(view.totals.progressNote.textContent, /definir o objetivo/);
});
