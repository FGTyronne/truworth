(() => {
  // Snap & Assess v18: barcode -> label OCR -> retail zero-shot vision fallback.
  // Runs locally in the browser; raw photos are not uploaded.
  window.__TRUWORTH_VISION_OVERRIDE__ = true;

  const TRANSFORMERS_SRC = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm';
  const ZERO_SHOT_MODEL = 'Xenova/siglip-base-patch16-224';
  const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
  const SNAP_KEY = 'truworth_snap_candidate_v1';
  let zeroShotPromise = null;

  const esc = (value = '') => String(value).replace(/[&<>'"]/g, (m) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[m]));
  const titleCase = (s = '') => String(s).toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

  const BRANDS = [
    'Vaseline','Nivea','Carmex','Blistex','Burt\'s Bees','Eos','Dove','Neutrogena','CeraVe','Olay','Garnier','L\'Oreal','Maybelline','The Ordinary',
    'Gillette','Oral-B','Colgate','Pantene','Head & Shoulders','Tresemmé','Dyson','Philips','Bosch','DeLonghi','Nespresso','Apple','Samsung','Sony','Bose',
    'JBL','Nintendo','Microsoft','Xbox','PlayStation','Canon','Nikon','Dell','HP','Lenovo','ASUS','Acer','LG','Garmin','Fitbit','GoPro','Nike','Adidas','LEGO'
  ];

  const RETAIL_LABELS = [
    ['lip balm or lip care product', 'Lip balm / lip care'],
    ['petroleum jelly skincare product', 'Petroleum jelly / skin balm'],
    ['lip gloss cosmetic', 'Lip gloss'],
    ['lipstick cosmetic', 'Lipstick'],
    ['small cosmetic jar or balm tin', 'Cosmetic balm / jar'],
    ['face cream or moisturiser', 'Face cream / moisturiser'],
    ['body lotion or hand cream', 'Body lotion / hand cream'],
    ['sunscreen product', 'Sunscreen'],
    ['deodorant or antiperspirant', 'Deodorant / antiperspirant'],
    ['shampoo bottle', 'Shampoo'],
    ['conditioner bottle', 'Conditioner'],
    ['hair styling product', 'Hair styling product'],
    ['perfume or fragrance bottle', 'Perfume / fragrance'],
    ['makeup compact or powder', 'Makeup compact'],
    ['mascara cosmetic', 'Mascara'],
    ['toothpaste tube', 'Toothpaste'],
    ['toothbrush or electric toothbrush', 'Toothbrush'],
    ['razor or electric shaver', 'Razor / shaver'],
    ['soap or body wash product', 'Soap / body wash'],
    ['electric salt and pepper grinder', 'Electric salt / pepper grinder'],
    ['manual pepper mill or spice grinder', 'Pepper mill / spice grinder'],
    ['coffee grinder', 'Coffee grinder'],
    ['coffee machine or espresso maker', 'Coffee / espresso machine'],
    ['electric kettle', 'Electric kettle'],
    ['toaster', 'Toaster'],
    ['blender or food processor', 'Blender / food processor'],
    ['drinking bottle or water bottle', 'Water bottle'],
    ['mug or drinking cup', 'Mug / cup'],
    ['food storage container', 'Food storage container'],
    ['frying pan or saucepan', 'Cookware'],
    ['kitchen knife', 'Kitchen knife'],
    ['kitchen utensil', 'Kitchen utensil'],
    ['mobile phone or smartphone', 'Mobile phone'],
    ['tablet computer', 'Tablet'],
    ['laptop computer', 'Laptop'],
    ['wireless earbuds', 'Wireless earbuds'],
    ['headphones', 'Headphones'],
    ['portable speaker', 'Speaker'],
    ['phone charger or power bank', 'Charger / power bank'],
    ['remote control', 'Remote control'],
    ['digital camera', 'Camera'],
    ['smartwatch or fitness tracker', 'Smartwatch / fitness tracker'],
    ['vacuum cleaner', 'Vacuum cleaner'],
    ['hair dryer', 'Hair dryer'],
    ['desk lamp or light', 'Lamp / light'],
    ['electric fan', 'Fan'],
    ['clothes iron', 'Iron'],
    ['weighing scale', 'Scale'],
    ['household cleaning spray', 'Cleaning product'],
    ['laundry detergent product', 'Laundry detergent'],
    ['shoe or sneaker', 'Shoes / sneakers'],
    ['backpack or rucksack', 'Backpack'],
    ['handbag or purse', 'Handbag'],
    ['sunglasses', 'Sunglasses'],
    ['wrist watch', 'Watch'],
    ['piece of clothing', 'Clothing'],
    ['toy or game', 'Toy / game'],
    ['book', 'Book'],
    ['notebook or stationery item', 'Stationery'],
    ['hand tool or power tool', 'Tool'],
    ['sports equipment', 'Sports equipment'],
    ['packaged snack or food item', 'Food / snack'],
    ['soft drink or beverage bottle or can', 'Drink / beverage'],
    ['healthcare or pharmacy product', 'Healthcare product'],
    ['other retail product whose exact type is unclear', '__unknown__'],
    ['packaging component, lid, cap or empty container rather than the main product', '__packaging__']
  ];

  const LABEL_TO_TITLE = new Map(RETAIL_LABELS);
  const ZERO_SHOT_LABELS = RETAIL_LABELS.map(([label]) => label);

  function findBrand(text) {
    const value = String(text || '').toLowerCase();
    return BRANDS.find((b) => value.includes(b.toLowerCase())) || '';
  }

  function meaningfulTokens(text) {
    const common = new Set(['the','and','with','for','from','this','that','made','original','new','care','product','therapy','net','weight','skin','daily','advanced']);
    return String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g)?.filter((t) => !common.has(t)) || [];
  }

  function plausibleLabelText(query, confidence) {
    const tokens = meaningfulTokens(query);
    const brand = findBrand(query);
    const alpha = (String(query).match(/[A-Za-z]/g) || []).length;
    const alnum = (String(query).match(/[A-Za-z0-9]/g) || []).length;
    if (!query || alpha / Math.max(1, alnum) < 0.62) return false;
    if (brand && tokens.length >= 1) return true;
    return confidence >= 55 && tokens.length >= 2;
  }

  function makeLabelCandidate(query, confidence) {
    const brand = findBrand(query);
    const cleaned = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    return {
      title: titleCase(cleaned),
      brand,
      category: 'Text read from product label',
      image_url: null,
      source_url: null,
      source_label: 'Visible label text',
      price: null,
      currency: null,
      retailer: null,
      confidence: Math.max(1, Math.min(99, Math.round(confidence || 0))),
      label_only: true
    };
  }

  function catalogueAgreement(candidate, query) {
    const title = `${candidate?.brand || ''} ${candidate?.title || ''}`.toLowerCase();
    const brand = findBrand(query);
    if (brand && title.includes(brand.toLowerCase())) return true;
    const tokens = [...new Set(meaningfulTokens(query))];
    if (!tokens.length) return false;
    const hits = tokens.filter((t) => title.includes(t));
    return hits.length >= Math.min(2, tokens.length) || hits.some((t) => t.length >= 7);
  }

  async function getZeroShot() {
    if (!zeroShotPromise) zeroShotPromise = (async () => {
      const mod = await import(TRANSFORMERS_SRC);
      return mod.pipeline('zero-shot-image-classification', ZERO_SHOT_MODEL, {
        device: 'wasm',
        dtype: 'q8'
      });
    })();
    return zeroShotPromise;
  }

  async function classifyRetail(file) {
    try {
      const classifier = await getZeroShot();
      const rows = await classifier(file, ZERO_SHOT_LABELS, {
        hypothesis_template: 'a retail product photo of {}'
      });
      const ranked = (rows || []).map((r) => ({
        label: String(r.label || ''),
        title: LABEL_TO_TITLE.get(String(r.label || '')) || String(r.label || ''),
        score: Number(r.score || 0)
      })).sort((a,b) => b.score - a.score);

      const top = ranked[0]?.score || 0;
      const topRow = ranked[0];
      if (!topRow || ['__unknown__','__packaging__'].includes(topRow.title)) {
        const next = ranked.find((r) => !['__unknown__','__packaging__'].includes(r.title));
        if (!next || next.score < top * 0.92) return [];
      }
      return ranked
        .filter((r) => !['__unknown__','__packaging__'].includes(r.title))
        .filter((r) => r.score >= Math.max(0.04, top * 0.76))
        .slice(0, 2);
    } catch (error) {
      console.warn('Retail zero-shot recognition unavailable', error);
      return [];
    }
  }

  async function scanBarcode(file) {
    if (!('BarcodeDetector' in window)) return '';
    const supported = await BarcodeDetector.getSupportedFormats?.() || [];
    const wanted = ['ean_13','ean_8','upc_a','upc_e','code_128','itf'];
    const formats = wanted.filter((f) => !supported.length || supported.includes(f));
    const detector = new BarcodeDetector(formats.length ? { formats } : undefined);
    const bitmap = await createImageBitmap(file);
    try {
      const results = await detector.detect(bitmap);
      const hit = results.find((r) => /\d{8,14}/.test(r.rawValue || '')) || results[0];
      return String(hit?.rawValue || '').replace(/\s/g, '');
    } finally { bitmap.close?.(); }
  }

  async function loadTesseract() {
    if (window.Tesseract?.createWorker) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = TESSERACT_SRC;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function makeOcrCanvas(file) {
    const bitmap = await createImageBitmap(file);
    try {
      const max = 1800;
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0, width, height);
      const image = ctx.getImageData(0, 0, width, height);
      const d = image.data;
      for (let i = 0; i < d.length; i += 4) {
        const grey = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const contrasted = Math.max(0, Math.min(255, (grey - 128) * 1.55 + 128));
        d[i] = d[i + 1] = d[i + 2] = contrasted;
      }
      ctx.putImageData(image, 0, 0);
      return canvas;
    } finally { bitmap.close?.(); }
  }

  async function scanText(file, onProgress) {
    await loadTesseract();
    const worker = await window.Tesseract.createWorker('eng', 1, {
      logger: (m) => { if (m.status === 'recognizing text') onProgress?.(Number(m.progress || 0)); }
    });
    try {
      await worker.setParameters({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1' });
      const prepared = await makeOcrCanvas(file).catch(() => file);
      let result = await worker.recognize(prepared);
      let text = result?.data?.text || '';
      let confidence = Number(result?.data?.confidence || 0);
      if (confidence < 42 || meaningfulTokens(text).length < 2) {
        const fallback = await worker.recognize(file);
        if (Number(fallback?.data?.confidence || 0) > confidence || meaningfulTokens(fallback?.data?.text).length > meaningfulTokens(text).length) {
          result = fallback;
          text = fallback?.data?.text || '';
          confidence = Number(fallback?.data?.confidence || 0);
        }
      }
      return { text, confidence };
    } finally { await worker.terminate(); }
  }

  function usefulOcrQuery(raw) {
    const stop = /^(warning|caution|made in|serial|s\/n|model|barcode|www\.|http|ce\b|recycle|recycling|keep away|instructions|ingredients|directions|net wt|net weight)/i;
    const lines = String(raw || '').split(/\n+/)
      .map((x, index) => ({ index, text: x.replace(/[^\p{L}\p{N}\-+&.'\/ ]/gu, ' ').replace(/\s+/g, ' ').trim() }))
      .filter((x) => x.text.length >= 3 && x.text.length <= 60 && !stop.test(x.text))
      .map((x) => {
        const brand = findBrand(x.text);
        const letters = (x.text.match(/[A-Za-z]/g) || []).length;
        const alnum = (x.text.match(/[A-Za-z0-9]/g) || []).length;
        const words = meaningfulTokens(x.text).length;
        const score = (brand ? 8 : 0) + Math.min(words, 4) * 2 + (letters / Math.max(1, alnum) > 0.75 ? 2 : 0) - (/^\d/.test(x.text) ? 2 : 0);
        return { ...x, score };
      })
      .filter((x) => x.score >= 2)
      .sort((a,b) => b.score - a.score)
      .slice(0, 3)
      .sort((a,b) => a.index - b.index);
    return lines.map((x) => x.text).join(' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  }

  async function serverResolve(barcode, text) {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return { candidates: [] };
    const { data, error } = await supabaseClient.functions.invoke('snap-resolve', { body: { barcode: barcode || null, text: text || null } });
    if (error) throw error;
    return data || { candidates: [] };
  }

  function getCard(input) {
    const existing = input.closest('[data-snap-card]');
    if (existing) return { card: existing, fromHome: false };
    const shell = document.createElement('section');
    shell.className = 'snap-modal-shell';
    shell.innerHTML = `<button class="snap-modal-close" aria-label="Close">×</button><section class="snap-card compact" data-snap-card><div class="snap-copy"><span class="snap-icon" aria-hidden="true">◉</span><div><p class="kicker">Snap & Assess</p><h2>Recognising what you photographed.</h2><p>TruWorth checks a barcode and visible label first, then uses retail-focused visual recognition if needed. The raw photo stays on this device.</p></div></div><div class="snap-work"><img class="snap-preview" alt="Photo selected for product identification"><div class="snap-progress"><strong>Looking for the product…</strong><span class="snap-progress-text">Checking the image locally.</span><div class="snap-meter"><i></i></div></div></div><p class="snap-status" role="status"></p><div class="snap-candidates"></div></section>`;
    document.body.appendChild(shell);
    shell.querySelector('.snap-modal-close')?.addEventListener('click', () => shell.remove());
    return { card: shell.querySelector('[data-snap-card]'), fromHome: true };
  }

  function setProgress(card, text, pct) {
    const work = card?.querySelector('.snap-work');
    const label = card?.querySelector('.snap-progress-text');
    const meter = card?.querySelector('.snap-meter i');
    if (work) work.hidden = false;
    if (label) label.textContent = text;
    if (meter) meter.style.width = `${Math.max(8, Math.min(100, pct || 8))}%`;
  }

  function status(card, text, error = false) {
    const node = card?.querySelector('.snap-status');
    if (!node) return;
    node.textContent = text;
    node.className = `snap-status ${error ? 'error' : ''}`;
  }

  function choose(candidate, fromHome) {
    if (fromHome || !document.getElementById('assessment')) {
      sessionStorage.setItem(SNAP_KEY, JSON.stringify(candidate));
      location.href = 'assess.html?snap=1';
      return;
    }
    const set = (id, value) => { const node = document.getElementById(id); if (node && value != null) node.value = value; };
    set('item', candidate.title || '');
    set('brand', candidate.brand || '');
    set('retailer', candidate.retailer || '');
    if (candidate.price != null) set('price', Number(candidate.price).toFixed(2));
    set('productUrl', candidate.source_url || '');
    set('canonicalUrl', candidate.source_url || '');
    set('imageUrl', candidate.image_url || '');
    if (candidate.currency) set('currency', candidate.currency);
    status(document.querySelector('[data-snap-card]'), `Using ${candidate.title}. Confirm the exact item and price below before calculating.`);
    document.getElementById('item')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function visualCandidate(row) {
    return {
      title: row.title,
      brand: '',
      category: row.title,
      image_url: null,
      source_url: null,
      source_label: 'On-device retail visual recognition',
      price: null,
      currency: null,
      retailer: null,
      confidence: Math.round(row.score * 100),
      visual_only: true
    };
  }

  function render(card, { labelCandidate, visualRows = [], catalogueRows = [], query = '', fromHome = false, barcode = '' }) {
    const mount = card?.querySelector('.snap-candidates');
    if (!mount) return;
    const aligned = query ? catalogueRows.filter((c) => catalogueAgreement(c, query)).slice(0, 3) : catalogueRows.slice(0, 3);

    if (!labelCandidate && !visualRows.length && !aligned.length) {
      status(card, 'I could not identify this reliably. Try the front label or barcode, or enter the item manually.', true);
      mount.innerHTML = `<a class="secondary-button" href="assess.html">Continue manually</a>`;
      return;
    }

    status(card, barcode ? 'Barcode matched. Confirm the exact product.' : 'Confirm what you photographed before TruWorth uses it.');
    let html = '';

    if (labelCandidate) {
      html += `<div class="snap-match-head"><strong>Label read from the photo</strong><span>Best signal when branding or a product name is visible.</span></div><div class="snap-match-list"><article class="snap-match"><div class="snap-match-placeholder">Aa</div><div><small>${labelCandidate.brand ? `${esc(labelCandidate.brand)} · ` : ''}${labelCandidate.confidence}% OCR confidence</small><strong>${esc(labelCandidate.title)}</strong><span>Use this if the words match what is printed on the product.</span></div><button class="secondary-button label-use" type="button">Use this</button></article></div>`;
    }

    if (aligned.length) {
      html += `<div class="snap-match-head"><strong>${barcode ? 'Barcode match' : 'Possible catalogue matches'}</strong><span>Only matches consistent with the readable label are shown.</span></div><div class="snap-match-list">${aligned.map((c, i) => `<article class="snap-match"><div class="snap-match-placeholder">?</div><div><small>${esc(c.brand || c.source_label || 'Catalogue match')}</small><strong>${esc(c.title || 'Product')}</strong><span>${esc(c.category || 'Price to confirm')}</span></div><button class="secondary-button catalogue-use" data-catalogue-index="${i}" type="button">Use this</button></article>`).join('')}</div>`;
    }

    if (visualRows.length) {
      html += `<div class="snap-match-head"><strong>Product type</strong><span>Retail-focused visual fallback — not a claim about the exact brand or model.</span></div><div class="snap-match-list">${visualRows.map((r, i) => `<article class="snap-match"><div class="snap-match-placeholder">◉</div><div><small>Visual match · ${Math.round(r.score * 100)}%</small><strong>${esc(r.title)}</strong><span>Use this only if the product type is right.</span></div><button class="secondary-button vision-use" data-vision-index="${i}" type="button">Use this type</button></article>`).join('')}</div>`;
    }

    mount.innerHTML = html;
    mount.querySelector('.label-use')?.addEventListener('click', () => choose(labelCandidate, fromHome));
    mount.querySelectorAll('.catalogue-use').forEach((button) => button.addEventListener('click', () => choose(aligned[Number(button.dataset.catalogueIndex)], fromHome)));
    mount.querySelectorAll('.vision-use').forEach((button) => button.addEventListener('click', () => choose(visualCandidate(visualRows[Number(button.dataset.visionIndex)]), fromHome)));
  }

  async function identify(file, card, fromHome) {
    if (!file.type.startsWith('image/')) return status(card, 'Choose an image file.', true);
    if (file.size > 12 * 1024 * 1024) return status(card, 'That photo is too large. Try one under 12 MB.', true);

    const preview = card?.querySelector('.snap-preview');
    const url = URL.createObjectURL(file);
    if (preview) { preview.src = url; preview.onload = () => URL.revokeObjectURL(url); }

    status(card, '');
    setProgress(card, 'Checking for a barcode…', 10);
    let barcode = '';
    try { barcode = await scanBarcode(file); } catch (e) { console.debug('Barcode scan unavailable', e); }

    if (barcode) {
      setProgress(card, `Barcode found: ${barcode}. Looking it up…`, 72);
      try {
        const rows = (await serverResolve(barcode, ''))?.candidates || [];
        if (rows.length) {
          setProgress(card, 'Product match ready.', 100);
          return render(card, { catalogueRows: rows, fromHome, barcode });
        }
      } catch (e) { console.warn('Barcode lookup failed', e); }
    }

    setProgress(card, 'Reading the product label locally…', 28);
    let ocr = { text: '', confidence: 0 };
    try { ocr = await scanText(file, (p) => setProgress(card, 'Reading the product label locally…', 28 + p * 32)); } catch (e) { console.warn('OCR unavailable', e); }
    const query = usefulOcrQuery(ocr.text);
    const labelCandidate = plausibleLabelText(query, ocr.confidence) ? makeLabelCandidate(query, ocr.confidence) : null;

    let catalogueRows = [];
    if (query) {
      setProgress(card, 'Checking the readable label against product data…', 66);
      try { catalogueRows = (await serverResolve('', query))?.candidates || []; } catch (e) { console.warn('Catalogue lookup failed', e); }
    }

    // If the label itself is strong, do not waste time downloading a large vision model.
    if (labelCandidate && (findBrand(query) || ocr.confidence >= 68)) {
      setProgress(card, 'Label match ready.', 100);
      return render(card, { labelCandidate, catalogueRows, query, fromHome });
    }

    setProgress(card, 'No strong label match. Recognising the product type locally…', 74);
    const visualRows = await classifyRetail(file);
    setProgress(card, 'Recognition ready.', 100);
    render(card, { labelCandidate, visualRows, catalogueRows, query, fromHome });
  }

  // Capture phase is intentional: it prevents the older OCR-only Snap handler from also firing.
  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains('snap-file-input')) return;
    const file = input.files?.[0];
    if (!file) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const { card, fromHome } = getCard(input);
    identify(file, card, fromHome).catch((error) => {
      console.error('Snap recognition failed', error);
      status(card, 'Recognition could not finish. Try the front label, barcode, or enter the product manually.', true);
      const mount = card?.querySelector('.snap-candidates');
      if (mount) mount.innerHTML = `<a class="secondary-button" href="assess.html">Continue manually</a>`;
    });
  }, true);
})();
