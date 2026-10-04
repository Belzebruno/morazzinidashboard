    function setLinkStatus(message, tone = "") {
      linkStatus.textContent = message;
      linkStatus.dataset.tone = tone;
    }


function normalizeUrl(value) {
  try {
    let url = new URL(String(value || '').trim().replaceAll('&amp;', '&').replaceAll('\\&', '&'));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    if (/(^|\.)google\.[a-z.]+$/.test(url.hostname)) {
      const target = url.searchParams.get('url') || url.searchParams.get('q') || url.searchParams.get('adurl');
      if (target && /^https?:/.test(target)) url = new URL(target);
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    if (isMercadoLivreUrl(url.href)) {
      const fragment = new URLSearchParams(url.hash.slice(1));
      const offer = url.searchParams.get('wid') || fragment.get('wid');
      if (!url.searchParams.has('pdp_filters') && /^MLB\d+$/.test(offer || '')) url.searchParams.set('pdp_filters', 'item_id:' + offer);
      url.hash = '';
    }
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|gclid$|gbraid$|wbraid$|gad_|srsltid$)/i.test(key) || (isMercadoLivreUrl(url.href) && /^(matt_|cq_|from$)/i.test(key))) url.searchParams.delete(key);
    return url.href;
  } catch { return ''; }
}
function isMercadoLivreUrl(value) {
  try { return /(^|\.)mercadolivre\.com\.br$/.test(new URL(value).hostname); } catch { return false; }
}
function machineNameFromUrl(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part));
    const slug = parts.filter(part => !/^\d+$/.test(part)).sort((a,b) => b.length-a.length)[0];
    return slug ? slug.replace(/[-_]+/g,' ').replace(/\s+\d{10,}$/,'').trim() : 'Novo item';
  } catch { return 'Novo item'; }
}
    function cleanProductName(value, url) {
      const fallback = machineNameFromUrl(url);
      const clean = String(value || "")
        .replace(/\s+/g, " ")
        .replace(/\s[-|]\s.*?(Loja do Mecânico|Comprar|Oferta).*$/i, "")
        .replace(/\s*-\s*Loja do Mecânico.*$/i, "")
        .replace(/\s*[|\-–]\s*Mercado\s*Livre.*$/i, "")
        .trim();
      if (/confirme seu acesso|access denied|just a moment|captcha|verifique.*humano|attention required|verificação de segurança|faça login|entrar no mercado livre|^mercado\s*livr[ei]$/i.test(clean)) return fallback;
      return clean || fallback;
    }

    function findValueByKey(object, wantedKeys) {
      if (!object || typeof object !== "object") return "";
      for (const key of wantedKeys) {
        if (object[key] !== undefined && object[key] !== null) return object[key];
      }

      for (const value of Object.values(object)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            const found = findValueByKey(item, wantedKeys);
            if (found) return found;
          }
        } else if (value && typeof value === "object") {
          const found = findValueByKey(value, wantedKeys);
          if (found) return found;
        }
      }

      return "";
    }

    function getJsonLdProductData(document, url) {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

      for (const script of scripts) {
        try {
          const json = JSON.parse(script.textContent.trim());
          const entries = Array.isArray(json) ? json : [json];

          for (const entry of entries) {
            const graph = Array.isArray(entry["@graph"]) ? entry["@graph"] : [entry];
            const product = graph.find((item) => {
              const type = item && item["@type"];
              const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
              const target = item?.url || item?.mainEntityOfPage?.["@id"] || item?.offers?.url;
              const heading = document.querySelector('h1')?.textContent?.trim().toLowerCase();
              const matchesName = heading && item?.name?.trim().toLowerCase() === heading;
              let matchesUrl = false;
              try { matchesUrl = target && new URL(target, url).pathname.replace(/\/$/, '') === new URL(url).pathname.replace(/\/$/, ''); } catch {}
              return isProduct && (matchesUrl || matchesName || (!target && !heading));
            });

            if (product) {
              return {
                name: product.name,
                price: findValueByKey(product.offers || product, ["price", "lowPrice"])
              };
            }
          }
        } catch {
          // Ignore invalid JSON-LD blocks from retailers.
        }
      }

      return {};
    }

    function getMercadoLivreProductData(document, url) {
      if (!isMercadoLivreUrl(url)) return {};
      const name = document.querySelector('h1.ui-pdp-title')?.textContent;
      // Scope the amount to the main offer: recommendations, old prices and
      // installments also contain andes-money-amount elements.
      const amount = document.querySelector('.ui-pdp-price__second-line .andes-money-amount:not(.andes-money-amount--previous)');
      const fraction = amount?.querySelector('.andes-money-amount__fraction')?.textContent;
      const cents = amount?.querySelector('.andes-money-amount__cents')?.textContent;
      const whole = String(fraction || '').replace(/\s/g, '');
      const decimal = String(cents || '').trim();
      const valid = /^\d+(?:\.\d{3})*$/.test(whole) && (!decimal || /^\d{2}$/.test(decimal));
      return { name, price: valid ? Number(whole.replace(/\./g, '')) + Number(decimal || 0) / 100 : 0 };
    }

    function extractProductFromHtml(html, url) {
      if (isMercadoLivreUrl(url) && /suspicious-traffic-frontend|gz-account-verification|\/account-verification/i.test(html)) {
        return {name: machineNameFromUrl(url), price: 0, blocked: true};
      }
      const document = new DOMParser().parseFromString(html, "text/html");
      const jsonLd = getJsonLdProductData(document, url);
      const mercadoLivre = getMercadoLivreProductData(document, url);
      const metaName = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]')?.content;
      const headingName = document.querySelector("h1")?.textContent;
      const titleName = document.querySelector("title")?.textContent;
      const metaPrice = document.querySelector('meta[property="product:price:amount"], meta[property="nuvemshop:price"], meta[property="og:price:amount"], meta[itemprop="price"], [itemprop="price"]')?.content
        || document.querySelector('[itemprop="price"]')?.getAttribute("content")
        || document.querySelector('[data-price]')?.getAttribute("data-price");

      const name = cleanProductName(mercadoLivre.name || jsonLd.name || headingName || metaName || titleName, url);
      const priceText = mercadoLivre.price || jsonLd.price || metaPrice;

      return {
        name,
        price: Math.max(0, parseMoney(priceText))
      };
    }

    async function fetchWithTimeout(url, timeout = 14000) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.text();
      } finally {
        clearTimeout(timer);
      }
    }


async function loadProductHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('/api/product?url=' + encodeURIComponent(url), {signal:controller.signal});
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'Loja indisponível'), {code:data.code});
    return data.html;
  } finally { clearTimeout(timer); }
}
function extractCopiedProduct(text, url) {
  const value = String(text || '').replace(/\\\s*\r?\n/g, '\n');
  const amounts = [...value.matchAll(/R\$\s*(\d+(?:\.\d{3})*(?:\s*,\s*\d{2})?)(?!\d)/g)];
  if (amounts.length !== 1) throw new Error('Cole apenas o título e o preço total do produto, sem parcelas ou outros valores.');
  const amount = amounts[0];
  const name = cleanProductName(value.slice(0, amount.index).replace(/^\s*#+\s*/, '').trim(), url);
  if (!value.slice(0, amount.index).trim()) throw new Error('Inclua o título antes do preço.');
  const price = Number(amount[1].replace(/\s|\./g, '').replace(',', '.'));
  if (!Number.isFinite(price) || price <= 0) throw new Error('Inclua um preço maior que zero.');
  return {name, price};
}
let pendingProduct = null;
let lookupId = 0;
async function addMachineFromLink() {
  if (currentView !== 'opening' || addByLinkButton.disabled) return;
  const url = normalizeUrl(productUrlInput.value);
  if (!url) { setLinkStatus('Cole um link http ou https válido da loja.', 'warning'); return; }
  const request = ++lookupId;
  addByLinkButton.disabled = true;
  productUrlInput.disabled = true;
  addByLinkButton.textContent = 'Buscando…';
  document.querySelector('#productReview').hidden = true;
  pendingProduct = null;
  setLinkStatus('Buscando dados na loja… Você poderá revisar antes de adicionar.');
  let product = {name: machineNameFromUrl(url), price: 0};
  let loaded = false;
  try {
    product = extractProductFromHtml(await loadProductHtml(url), url);
    loaded = product.price > 0;
  } catch (error) { product.blocked = error.code === 'RETAILER_BLOCKED'; }
  if (request !== lookupId) return;
  pendingProduct = {...product, sourceUrl: url};
  document.querySelector('#reviewName').value = product.name;
  document.querySelector('#reviewPrice').value = product.price > 0 ? String(product.price).replace('.', ',') : '';
  document.querySelector('#reviewSource').textContent = 'Loja: ' + new URL(url).hostname;
  document.querySelector('#reviewOffer').href = url;
  document.querySelector('#copiedProduct').value = '';
  document.querySelector('#productReview').hidden = false;
  setLinkStatus(loaded ? 'Confira o nome, a versão e o preço da oferta.' : product.blocked ? 'O Mercado Livre bloqueou a consulta automática. Abra o anúncio e cole o título e o preço abaixo, ou preencha os campos.' : 'A loja não forneceu os dados automaticamente. Cole o título e o preço do anúncio abaixo, ou preencha os campos.', loaded ? 'success' : 'warning');
  addByLinkButton.disabled = false;
  productUrlInput.disabled = false;
  addByLinkButton.textContent = 'Buscar produto';
  document.querySelector(loaded ? '#reviewName' : '#reviewPrice').focus();
}
