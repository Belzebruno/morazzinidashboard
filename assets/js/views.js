    function resizeNameField(field) {
      field.style.height = "auto";
      field.style.height = `${field.scrollHeight + 2}px`;
    }

    function renderMachines() {
      machineList.innerHTML = "";
      if (currentView === "finance") return;

      const collection = getCurrentCollection();

      collection.forEach((machine, index) => {
        const item = template.content.firstElementChild.cloneNode(true);
        const link = item.querySelector(".link-btn");
        const purchase = item.querySelector(".purchase-btn");
        const name = item.querySelector(".machine-name");
        const price = item.querySelector(".price-input");
        const remove = item.querySelector(".remove");
        const sourceUrl = normalizeUrl(machine.sourceUrl);

        item.dataset.sourceUrl = sourceUrl;
        name.value = machine.name;
        resizeNameField(name);
        price.value = formatMoney(machine.price);

        if (sourceUrl) {
          link.disabled = false;
          link.addEventListener("click", () => {
            window.open(sourceUrl, "_blank", "noopener,noreferrer");
          });
        } else {
          link.disabled = true;
          link.title = "Sem link salvo";
          link.setAttribute("aria-label", "Sem link salvo");
        }

        if (currentView === "patrimony") {
          purchase.classList.add("asset");
          purchase.disabled = true;
          purchase.title = "Registrado no patrimônio";
          purchase.setAttribute("aria-label", "Registrado no patrimônio");
        } else {
          purchase.addEventListener("click", () => {
            moveToPatrimony(index);
          });
        }

        name.addEventListener("input", () => {
          collection[index].name = name.value;
          resizeNameField(name);
          saveState();
        });

        price.addEventListener("focus", () => {
          price.value = String(collection[index].price).replace(".", ",");
          price.select();
        });

        price.addEventListener("blur", () => {
          collection[index].price = parseMoney(price.value);
          price.value = formatMoney(collection[index].price);
          persistAndRenderTotals();
        });

        price.addEventListener("keydown", (event) => {
          if (event.key === "Enter") price.blur();
        });

        remove.addEventListener("click", () => {
          collection.splice(index, 1);
          persistAndRenderAll();
        });

        machineList.append(item);
      });

      requestAnimationFrame(() => {
        machineList.querySelectorAll(".machine-name").forEach(resizeNameField);
      });
    }

    function moveToPatrimony(index) {
      const [machine] = state.machines.splice(index, 1);
      if (!machine) return;
      state.patrimony.push({
        ...machine,
        bought: true,
        purchasedAt: new Date().toISOString()
      });
      switchView("patrimony");
    }

    function renderTotals() {
      const remaining = state.machines.reduce((sum, machine) => sum + parseMoney(machine.price), 0);
      const bought = state.patrimony.reduce((sum, machine) => sum + parseMoney(machine.price), 0);
      const planned = remaining + bought;
      const saved = parseMoney(state.saved);
      const missing = Math.max(0, remaining - saved);
      const progressBase = planned || 1;
      const progress = Math.min(100, ((bought + Math.min(saved, remaining)) / progressBase) * 100);
      const assetCount = state.patrimony.length;
      const pendingCount = state.machines.length;
      const boughtShare = planned ? Math.min(100, (bought / planned) * 100) : 0;
      const salary = parseMoney(state.finance?.salary);
      const percent = parsePercent(state.finance?.percent);
      const monthlySaving = salary * (percent / 100);
      const months = missing <= 0 ? 0 : monthlySaving > 0 ? Math.ceil(missing / monthlySaving) : Infinity;

      if (currentView === "patrimony") {
        const average = assetCount ? bought / assetCount : 0;
        const lastAsset = state.patrimony.at(-1);

        progressPanel.classList.add("asset-progress");
        progressHeading.textContent = "Valor registrado no patrimônio";
        savedMoneyPanel.hidden = true;
        savedInput.disabled = true;
        totals.progressText.textContent = formatMoney(bought);
        totals.progressFill.style.width = `${boughtShare}%`;
        totals.progressNote.textContent = assetCount
          ? `${formatCount(assetCount, "item registrado", "itens registrados")} vindos da abertura.`
          : "Nenhum item foi enviado da abertura para o patrimônio.";

        totals.plannedLabel.textContent = "Itens registrados";
        totals.planned.textContent = String(assetCount);
        totals.boughtLabel.textContent = "Valor patrimonial";
        totals.bought.textContent = formatMoney(bought);
        totals.remainingLabel.textContent = "Média por item";
        totals.remaining.textContent = formatMoney(average);
        totals.savedLabel.textContent = "Ainda na abertura";
        totals.saved.textContent = String(pendingCount);
        totals.missingLabel.textContent = "Última entrada";
        totals.missing.textContent = formatShortDate(lastAsset?.purchasedAt);
        return;
      }

      if (currentView === "finance") {
        progressPanel.classList.add("asset-progress");
        progressHeading.textContent = "Reserva mensal planejada";
        savedMoneyPanel.hidden = false;
        savedInput.disabled = false;
        totals.progressText.textContent = formatPercent(percent);
        totals.progressFill.style.width = `${percent}%`;
        totals.progressNote.textContent = monthlySaving > 0
          ? `Guardando ${formatMoney(monthlySaving)} por mês, o objetivo fica em ${formatMonths(months)}.`
          : "Informe salário e percentual para calcular o prazo.";

        totals.plannedLabel.textContent = "Objetivo restante";
        totals.planned.textContent = formatMoney(missing);
        totals.boughtLabel.textContent = "Salário mensal";
        totals.bought.textContent = formatMoney(salary);
        totals.remainingLabel.textContent = "Reserva mensal";
        totals.remaining.textContent = formatMoney(monthlySaving);
        totals.savedLabel.textContent = "Percentual";
        totals.saved.textContent = formatPercent(percent);
        totals.missingLabel.textContent = "Prazo estimado";
        totals.missing.textContent = formatMonths(months);
        financeInsight.textContent = months === 0
          ? "Com o valor guardado atual, esta etapa já está coberta."
          : Number.isFinite(months)
            ? `Mantendo esse ritmo, a previsão é chegar no valor em ${formatTargetMonth(months)}.`
            : "Defina uma reserva mensal para o sistema calcular em quantos meses você chega no objetivo.";
        return;
      }

      progressPanel.classList.add("asset-progress");
      progressHeading.textContent = "Valor guardado para as máquinas";
      savedMoneyPanel.hidden = true;
      savedInput.disabled = true;
      totals.plannedLabel.textContent = "Total da etapa";
      totals.boughtLabel.textContent = "Virou patrimônio";
      totals.remainingLabel.textContent = "A comprar";
      totals.savedLabel.textContent = "Guardado";
      totals.missingLabel.textContent = "Falta para abrir";
      totals.planned.textContent = formatMoney(planned);
      totals.bought.textContent = formatMoney(bought);
      totals.remaining.textContent = formatMoney(remaining);
      totals.saved.textContent = formatMoney(saved);
      totals.missing.textContent = formatMoney(missing);
      totals.progressText.textContent = `${Math.round(progress)}%`;
      totals.progressFill.style.width = `${progress}%`;
      totals.progressNote.textContent = missing === 0
        ? "As máquinas pendentes estão cobertas pelo valor guardado."
        : `Ainda faltam ${formatMoney(missing)} para cobrir as máquinas que faltam.`;
    }

    function persistAndRenderTotals() {
      saveState();
      renderTotals();
    }

    function persistAndRenderAll() {
      saveState();
      renderViewChrome();
      renderMachines();
      renderTotals();
    }

    function getCurrentCollection() {
      return currentView === "patrimony" ? state.patrimony : state.machines;
    }

    function renderViewChrome() {
      const isOpening = currentView === "opening";
      const isPatrimony = currentView === "patrimony";
      const isFinance = currentView === "finance";

      currentSection.textContent = isFinance ? "Financeiro" : isPatrimony ? "Patrimônio" : "Abertura";
      machinesTitle.textContent = isPatrimony ? "Patrimônio" : "Máquinas e ferramentas";
      emptyState.textContent = isPatrimony
        ? "Nenhum patrimônio registrado ainda."
        : "Nenhuma máquina cadastrada ainda.";
      machinePanel.hidden = isFinance;
      financePanel.hidden = !isFinance;

      openingOnlyElements.forEach((element) => {
        element.hidden = !isOpening;
        const controls = [
          ...(element.matches("button, input, textarea") ? [element] : []),
          ...element.querySelectorAll("button, input, textarea")
        ];
        controls.forEach((control) => {
          control.disabled = !isOpening;
        });
      });

      viewButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.view === currentView);
        if (button.dataset.view === currentView) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });
    }

    function switchView(view) {
      currentView = ["opening", "patrimony", "finance"].includes(view) ? view : "opening";
      persistAndRenderAll();
    }
