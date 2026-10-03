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
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|gclid$|gbraid$|wbraid$|gad_|srsltid$)/i.test(key)) url.searchParams.delete(key);
    return url.href;
  } catch { return ''; }
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
        .trim();
      if (/confirme seu acesso|access denied|just a moment|captcha|verifique.*humano|attention required/i.test(clean)) return fallback;
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

    function extractProductFromHtml(html, url) {
      const document = new DOMParser().parseFromString(html, "text/html");
      const jsonLd = getJsonLdProductData(document, url);
      const metaName = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]')?.content;
      const headingName = document.querySelector("h1")?.textContent;
      const titleName = document.querySelector("title")?.textContent;
      const metaPrice = document.querySelector('meta[property="product:price:amount"], meta[property="nuvemshop:price"], meta[property="og:price:amount"], meta[itemprop="price"], [itemprop="price"]')?.content
        || document.querySelector('[itemprop="price"]')?.getAttribute("content")
        || document.querySelector('[data-price]')?.getAttribute("data-price");

      const name = cleanProductName(jsonLd.name || metaName || headingName || titleName, url);
      const priceText = metaPrice || jsonLd.price;

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
  const response = await fetchWithTimeout('/api/product?url=' + encodeURIComponent(url), 12000);
  const data = JSON.parse(response);
  return data.html;
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
  } catch { /* Manual review remains available for blocked retailers. */ }
  if (request !== lookupId) return;
  pendingProduct = {...product, sourceUrl: url};
  document.querySelector('#reviewName').value = product.name;
  document.querySelector('#reviewPrice').value = product.price > 0 ? String(product.price).replace('.', ',') : '';
  document.querySelector('#reviewSource').textContent = 'Loja: ' + new URL(url).hostname;
  document.querySelector('#productReview').hidden = false;
  setLinkStatus(loaded ? 'Confira o nome, a versão e o preço da oferta.' : 'A loja não forneceu os dados automaticamente. Preencha nome e preço para adicionar.', loaded ? 'success' : 'warning');
  addByLinkButton.disabled = false;
  productUrlInput.disabled = false;
  addByLinkButton.textContent = 'Buscar produto';
  document.querySelector(loaded ? '#reviewName' : '#reviewPrice').focus();
}
