    const machineList = document.querySelector("#machineList");
    const template = document.querySelector("#machineTemplate");
    const savedInput = document.querySelector("#savedInput");
    const machinePanel = document.querySelector("#machinePanel");
    const financePanel = document.querySelector("#financePanel");
    const financeSalaryInput = document.querySelector("#financeSalaryInput");
    const financePercentInput = document.querySelector("#financePercentInput");
    const financeInsight = document.querySelector("#financeInsight");
    const linkForm = document.querySelector("#linkForm");
    const productUrlInput = document.querySelector("#productUrlInput");
    const addByLinkButton = document.querySelector("#addByLink");
    const linkStatus = document.querySelector("#linkStatus");
    const currentSection = document.querySelector("#currentSection");
    const machinesTitle = document.querySelector("#machines-title");
    const emptyState = document.querySelector("#emptyState");
    const progressPanel = document.querySelector("#progressPanel");
    const progressHeading = document.querySelector("#progressHeading");
    const savedMoneyPanel = document.querySelector("#savedMoneyPanel");
    const viewButtons = document.querySelectorAll("[data-view]");
    const openingOnlyElements = document.querySelectorAll(".opening-only");
    const totals = {
      plannedLabel: document.querySelector("#plannedLabel"),
      planned: document.querySelector("#plannedTotal"),
      boughtLabel: document.querySelector("#boughtLabel"),
      bought: document.querySelector("#boughtTotal"),
      remainingLabel: document.querySelector("#remainingLabel"),
      remaining: document.querySelector("#remainingTotal"),
      savedLabel: document.querySelector("#savedLabel"),
      saved: document.querySelector("#savedTotal"),
      missingLabel: document.querySelector("#missingLabel"),
      missing: document.querySelector("#missingTotal"),
      progressText: document.querySelector("#progressText"),
      progressFill: document.querySelector("#progressFill"),
      progressNote: document.querySelector("#progressNote")
    };

    let currentView = document.body.dataset.page || "opening";
    let state = loadState();

    savedInput.addEventListener("focus", () => {
      savedInput.value = String(state.saved || 0).replace(".", ",");
      savedInput.select();
    });

    savedInput.addEventListener("blur", () => {
      state.saved = parseMoney(savedInput.value);
      savedInput.value = formatMoney(state.saved);
      persistAndRenderTotals();
    });

    savedInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") savedInput.blur();
    });

    financeSalaryInput.addEventListener("focus", () => {
      financeSalaryInput.value = String(state.finance.salary || 0).replace(".", ",");
      financeSalaryInput.select();
    });

    financeSalaryInput.addEventListener("blur", () => {
      state.finance.salary = parseMoney(financeSalaryInput.value);
      financeSalaryInput.value = formatMoney(state.finance.salary);
      persistAndRenderTotals();
    });

    financeSalaryInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") financeSalaryInput.blur();
    });

    financePercentInput.addEventListener("focus", () => {
      financePercentInput.value = String(state.finance.percent || 0).replace(".", ",");
      financePercentInput.select();
    });

    financePercentInput.addEventListener("blur", () => {
      state.finance.percent = parsePercent(financePercentInput.value);
      financePercentInput.value = formatPercent(state.finance.percent);
      persistAndRenderTotals();
    });

    financePercentInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") financePercentInput.blur();
    });

    document.querySelector("#addMachine").addEventListener("click", () => {
      currentView = "opening";
      state.machines.push({
        name: "Nova máquina",
        price: 0,
        bought: false
      });
      persistAndRenderAll();
      const lastName = machineList.querySelector(".machine:last-child .machine-name");
      if (lastName) {
        lastName.focus();
        lastName.select();
      }
    });

    document.querySelector("#resetList").addEventListener("click", async () => {
      const confirmed = confirm("Restaurar a lista inicial de máquinas? O valor guardado será mantido.");
      if (!confirmed) return;
      currentView = "opening";
      try {
        const defaults = await databaseRequest('/api/default-items');
        state.machines = defaults.items.map((machine) => ({ ...machine }));
      } catch (error) { panelNotice(error.message); return; }
      state.patrimony = [];
      persistAndRenderAll();
    });



    linkForm.addEventListener("submit", (event) => {
      event.preventDefault();
      addMachineFromLink();
    });



    savedInput.value = formatMoney(state.saved);
    financeSalaryInput.value = formatMoney(state.finance.salary);
    financePercentInput.value = formatPercent(state.finance.percent);
    renderViewChrome();
    renderMachines();
    renderTotals();
  
document.querySelector('#today').textContent = new Intl.DateTimeFormat('pt-BR', {dateStyle: 'medium'}).format(new Date());
initializeDatabase();
