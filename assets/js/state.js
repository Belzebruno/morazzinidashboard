    function normalizeState(payload) {
      const cleanMachines = Array.isArray(payload?.machines)
        ? payload.machines.filter((machine) => machine.sourceUrl !== VALIDATION_SAMPLE_URL)
        : initialMachines.map((machine) => ({ ...machine }));
      const cleanPatrimony = Array.isArray(payload?.patrimony)
        ? payload.patrimony.filter((machine) => machine.sourceUrl !== VALIDATION_SAMPLE_URL)
        : [];

      return {
        saved: parseMoney(payload?.saved),
        finance: {
          salary: parseMoney(payload?.finance?.salary),
          percent: parsePercent(payload?.finance?.percent ?? 20)
        },
        machines: cleanMachines.filter((machine) => !machine.bought).map((machine) => ({ ...machine, bought: false })),
        patrimony: [
          ...cleanPatrimony,
          ...cleanMachines.filter((machine) => machine.bought)
        ].map((machine) => ({ ...machine, bought: true }))
      };
    }

    function loadState() {
      const fallback = {
        saved: 0,
        finance: {
          salary: 0,
          percent: 20
        },
        machines: initialMachines.map((machine) => ({ ...machine })),
        patrimony: []
      };

      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved && Array.isArray(saved.machines)) return normalizeState(saved);
        }
      } catch {
        // Continue to legacy migration below.
      }

      for (const key of LEGACY_STORAGE_KEYS) {
        try {
          const legacy = JSON.parse(localStorage.getItem(key));
          if (!legacy || !Array.isArray(legacy.machines)) continue;
          const migrated = normalizeState(legacy);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        } catch {
          // Ignore invalid legacy payloads.
        }
      }

      return fallback;
    }

    function saveState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

