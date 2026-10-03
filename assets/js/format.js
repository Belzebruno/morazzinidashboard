    function parseMoney(value) {
      if (typeof value === "number") return value;
      let clean = String(value || "")
        .replace(/[^\d,.-]/g, "")
        .trim();

      if (clean.includes(",")) {
        clean = clean.replace(/\./g, "").replace(",", ".");
      } else {
        const parts = clean.split(".");
        if (parts.length > 2) {
          clean = clean.replace(/\./g, "");
        }
      }

      const parsed = Number.parseFloat(clean);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function formatMoney(value) {
      return currency.format(Math.max(0, Number(value) || 0));
    }

    function parsePercent(value) {
      const parsed = parseMoney(value);
      if (!Number.isFinite(parsed)) return 0;
      return Math.min(100, Math.max(0, parsed));
    }

    function formatPercent(value) {
      const percent = parsePercent(value);
      return `${percent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
    }

    function formatCount(value, singular, plural) {
      const count = Number(value) || 0;
      return `${count} ${count === 1 ? singular : plural}`;
    }

    function formatMonths(value) {
      if (!Number.isFinite(value)) return "Sem prazo";
      if (value <= 0) return "Agora";
      return formatCount(value, "mês", "meses");
    }

    function formatTargetMonth(months) {
      if (!Number.isFinite(months) || months <= 0) return "";
      const date = new Date();
      date.setMonth(date.getMonth() + months);
      return new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric"
      }).format(date);
    }

    function formatShortDate(value) {
      if (!value) return "Sem entradas";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Sem data";
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(date);
    }

