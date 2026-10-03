
    const STORAGE_KEY = "morazzini-opening-machines-v3";
    const LEGACY_STORAGE_KEYS = ["morazzini-opening-machines-v2", "morazzini-opening-machines-v1"];
    const VALIDATION_SAMPLE_URL = "https://www.lojadomecanico.com.br/produto/153785/21/222/esmerilhadeira-angular-4-12-pol-850w-110v-makita-m9510b";

    const initialMachines = [];

    const currency = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

