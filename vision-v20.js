(() => {
  // Snap & Assess v20: barcode-first, then multimodal AI product identification.
  window.__TRUWORTH_VISION_OVERRIDE__ = true;

  const SNAP_KEY = 'truworth_snap_candidate_v1';
  const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
  const MAX_ANALYSIS_EDGE = 1600;
  const AI_COPY = 'TruWorth checks barcodes on your device first. If that does not resolve the item, a resized copy is securely sent to AI vision for product identification. TruWorth does not store the photo.';

  const esc = (value = '') => String(value).replace(/[&<>'"]/g, (m) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[m]));
  const clean = (value = '', max = 180) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

  function patchSnapCopy(root = document) {
    const cards = [];
    if (root instanceof Element && root.matches?.('[data-snap-card]')) cards.push(root);
    if (root.querySelectorAll) cards.push(...root.querySelectorAll('[data-snap-card]'));
    cards.forEach((card) => {
      const copy = card.querySelector('.snap-copy div > p:last-child');
      if (copy && copy.textContent !== AI_COPY) copy.textContent = AI_COPY;
      const progress = card.querySelector('.snap-progress-text');
      if (progress && /locally|on your device/i.test(progress.textContent || '')) progress.textContent = 'Preparing product recognition.';
    });
  }

  patchSnapCopy();
  const copyObserver = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) patchSnapCopy(node);
      }
    }
  });
  copyObserver.observe(document.documentElement, { childList: true, subtree: true });

  function getCard(input) {
    const existing = input.closest('[data-snap-card]');
    if (existing) return { card: existing, fromHome: false };

    const shell = document.createElement('section');
    shell.className = 'snap-modal-shell';
    shell.innerHTML = `<button class="snap-modal-close" aria-label="Close">×</button>
      <section class="snap-card compact" data-snap-card>
        <div class="snap-copy"><span class="snap-icon" aria-hidden="true">◉</span><div><p class="kicker">Snap & Assess</p><h2>Identifying what you photographed.</h2><p>${AI_COPY}</p></div></div>
        <div class="snap-work"><img class="snap-preview" alt="Photo selected for product identification"><div class="snap-progress"><strong>Looking for the product…</strong><span class="snap-progress-text">Preparing product recognition.</span><div class="snap-meter"><i></i></div></div></div>
        <p class="snap-status" role="status"></p><div class="snap-candidates"></div>
      </section>`;
    document.body.appendChild(shell);
    shell.querySelector('.snap-modal-close')?.addEventListener('click', () => shell.remove());
    return { card: shell.querySelector('[data-snap-card]'), fromHome: true };
  }

  function status(card, text, error = false) {
    const node = card?.querySelector('.snap-status');
    if (!node) return;
    node.textContent = text;
    node.className = `snap-status ${error ? 'error' : ''}`;
  }

  function progress(card, text, pct) {
    const work = card?.querySelector('.snap-work');
    const label = card?.querySelector('.snap-progress-text');
    const meter = card?.querySelector('.snap-meter i');
    if (work) work.hidden = false;
    if (label) label.textContent = text;
    if (meter) meter.style.width = `${Math.max(8, Math.min(100, Number(pct) || 8))}%`;
  }

  function showPreview(card, file) {
    const preview = card?.querySelector('.snap-preview');
    if (!preview) return;
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.onload = () => URL.revokeObjectURL(url);
  }

  async function scanBarcode(file) {
    if (!('BarcodeDetector' in window)) return '';
    const supported = await BarcodeDetector.getSupportedFormats?.() || [];
    const wanted = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf'];
    const formats = wanted.filter((format) => !supported.length || supported.includes(format));
    const detector = new BarcodeDetector(formats.length ? { formats } : undefined);
    const bitmap = await createImageBitmap(file);
    try {
      const results = await detector.detect(bitmap);
      const hit = results.find((row) => /\d{8,14}/.test(row.rawValue || '')) || results[0];
      return String(hit?.rawValue || '').replace(/\s/g, '');
    } finally {
      bitmap.close?.();
    }
  }

  async function serverResolve(barcode, text) {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return { candidates: [] };
    const { data, error } = await supabaseClient.functions.invoke('snap-resolve', {
      body: { barcode: barcode || null, text: text || null }
    });
    if (error) throw error;
    return data || { candidates: [] };
  }

  function imageElement(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image could not be decoded')); };
      image.src = url;
    });
  }

  async function prepareAnalysisImage(file) {
    let source;
    let width;
    let height;
    let close = () => {};

    try {
      const bitmap = await createImageBitmap(file);
      source = bitmap;
      width = bitmap.width;
      height = bitmap.height;
      close = () => bitmap.close?.();
    } catch {
      const image = await imageElement(file);
      source = image;
      width = image.naturalWidth || image.width;
      height = image.naturalHeight || image.height;
    }

    try {
      const scale = Math.min(1, MAX_ANALYSIS_EDGE / Math.max(width, height));
      const outputWidth = Math.max(1, Math.round(width * scale));
      const outputHeight = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.drawImage(source, 0, 0, outputWidth, outputHeight);
      return canvas.toDataURL('image/jpeg', 0.82);
    } finally {
      close();
    }
  }

  async function aiIdentify(file, barcode) {
    const image = await prepareAnalysisImage(file);
    const response = await fetch('/api/photo-identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ image, barcode: barcode || null })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `AI vision failed (${response.status})`);
    if (!data?.identity) throw new Error('AI vision returned no product identity');
    return data.identity;
  }

  function identityCandidate(identity, alternative = false) {
    const title = clean(identity.product_name || identity.category || '');
    return {
      title,
      brand: clean(identity.brand || '', 100),
      model: clean(identity.model || '', 120),
      variant: clean(identity.variant || '', 120),
      category: clean(identity.category || '', 120),
      image_url: null,
      source_url: null,
      source_label: alternative ? 'AI vision alternative' : 'AI vision match',
      price: null,
      currency: null,
      retailer: null,
      confidence: Math.max(0, Math.min(100, Math.round(Number(identity.confidence) || 0))),
      exactness: identity.exactness || 'uncertain',
      search_query: clean(identity.search_query || title, 220),
      evidence: Array.isArray(identity.evidence) ? identity.evidence.map((x) => clean(x, 180)).filter(Boolean).slice(0, 4) : [],
      visual_only: true,
    };
  }

  function tokens(value) {
    const stop = new Set(['the', 'and', 'with', 'for', 'from', 'edition', 'product']);
    return [...new Set(String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length >= 3 && !stop.has(x)))];
  }

  function catalogueScore(row, identity) {
    const hay = `${row?.brand || ''} ${row?.title || ''}`.toLowerCase();
    const brand = clean(identity.brand || '').toLowerCase();
    let score = brand && hay.includes(brand) ? 5 : 0;
    for (const token of tokens(identity.search_query || identity.product_name)) if (hay.includes(token)) score += token.length >= 6 ? 2 : 1;
    return score;
  }

  function enrich(primary, catalogueRows, identity) {
    const ranked = (catalogueRows || []).map((row) => ({ row, score: catalogueScore(row, identity) })).sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best || best.score < 3) return primary;
    return {
      ...primary,
      image_url: best.row.image_url || primary.image_url,
      source_url: best.row.source_url || primary.source_url,
      price: best.row.price != null ? best.row.price : primary.price,
      currency: best.row.currency || primary.currency,
      retailer: best.row.retailer || primary.retailer,
      barcode: best.row.barcode || primary.barcode,
      source_label: 'AI vision + catalogue match',
    };
  }

  function exactnessLabel(value) {
    if (value === 'exact') return 'strong exact match';
    if (value === 'probable') return 'likely match';
    if (value === 'category_only') return 'product type only';
    return 'uncertain match';
  }

  function choose(candidate, fromHome) {
    if (fromHome || !document.getElementById('assessment')) {
      sessionStorage.setItem(SNAP_KEY, JSON.stringify(candidate));
      location.href = 'assess.html?snap=1';
      return;
    }

    const set = (id, value) => {
      const node = document.getElementById(id);
      if (node && value != null) node.value = value;
    };
    set('item', candidate.title || '');
    set('brand', candidate.brand || '');
    set('retailer', candidate.retailer || '');
    if (candidate.price != null) set('price', Number(candidate.price).toFixed(2));
    set('productUrl', candidate.source_url || '');
    set('canonicalUrl', candidate.source_url || '');
    set('imageUrl', candidate.image_url || '');
    if (candidate.currency) set('currency', candidate.currency);

    const card = document.querySelector('[data-snap-card]');
    status(card, `Using ${candidate.title}. Confirm the exact item, variant and price below before calculating.`);
    document.getElementById('item')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderBarcode(card, rows, fromHome) {
    const mount = card?.querySelector('.snap-candidates');
    if (!mount) return;
    const candidates = rows.slice(0, 4);
    status(card, 'Barcode matched. Confirm the exact product below.');
    mount.innerHTML = `<div class="snap-match-head"><strong>Barcode match</strong><span>Fastest exact-match route.</span></div><div class="snap-match-list">${candidates.map((c, index) => `
      <article class="snap-match">
        ${c.image_url ? `<img src="${esc(c.image_url)}" alt="" referrerpolicy="no-referrer">` : '<div class="snap-match-placeholder">✓</div>'}
        <div><small>${esc(c.brand || c.source_label || 'Barcode match')}</small><strong>${esc(c.title || 'Product')}</strong><span>${esc(c.category || 'Confirm the exact variant')}</span></div>
        <button class="secondary-button barcode-use" data-index="${index}" type="button">Use this</button>
      </article>`).join('')}</div>`;
    mount.querySelectorAll('.barcode-use').forEach((button) => button.addEventListener('click', () => choose(candidates[Number(button.dataset.index)], fromHome)));
  }

  function renderAi(card, primary, alternatives, fromHome) {
    const mount = card?.querySelector('.snap-candidates');
    if (!mount) return;
    const rows = [primary, ...alternatives].filter((row, index, all) => row?.title && all.findIndex((x) => x?.title?.toLowerCase() === row.title.toLowerCase()) === index).slice(0, 4);

    if (!rows.length) {
      status(card, 'The photo did not contain enough detail for a reliable product identification. Try another angle showing the front, logo or model label.', true);
      mount.innerHTML = `<a class="secondary-button" href="assess.html">Continue manually</a>`;
      return;
    }

    const strong = primary.exactness === 'exact' && primary.confidence >= 80;
    const categoryOnly = primary.exactness === 'category_only';
    status(card, strong
      ? 'AI found a strong product match. Confirm it before TruWorth uses it.'
      : categoryOnly
        ? 'AI could identify the product type, but not a defensible exact model. Confirm or search manually.'
        : 'AI identified the most likely product. Check the match before continuing.');

    mount.innerHTML = `<div class="snap-match-head"><strong>AI visual identification</strong><span>${strong ? 'High-confidence visual match.' : 'Evidence-based match — confirmation required.'}</span></div><div class="snap-match-list">${rows.map((row, index) => {
      const detail = [row.category, row.evidence?.[0]].filter(Boolean).join(' · ') || 'Confirm against the item in front of you.';
      return `<article class="snap-match">
        ${row.image_url ? `<img src="${esc(row.image_url)}" alt="" referrerpolicy="no-referrer">` : '<div class="snap-match-placeholder">AI</div>'}
        <div><small>${index === 0 ? 'Best match' : 'Alternative'} · ${row.confidence}% · ${esc(exactnessLabel(row.exactness))}</small><strong>${esc(row.title)}</strong><span>${esc(detail)}</span></div>
        <button class="secondary-button ai-use" data-index="${index}" type="button">${categoryOnly && index === 0 ? 'Use this type' : 'Use this'}</button>
      </article>`;
    }).join('')}</div>`;

    mount.querySelectorAll('.ai-use').forEach((button) => button.addEventListener('click', () => choose(rows[Number(button.dataset.index)], fromHome)));
  }

  async function identify(file, card, fromHome) {
    if (!file.type.startsWith('image/')) return status(card, 'Choose an image file.', true);
    if (file.size > MAX_UPLOAD_BYTES) return status(card, 'That photo is too large. Try one under 12 MB.', true);

    showPreview(card, file);
    status(card, '');
    progress(card, 'Checking for a barcode on your device…', 12);

    let barcode = '';
    try { barcode = await scanBarcode(file); } catch (error) { console.debug('Barcode scan unavailable', error); }

    if (barcode) {
      progress(card, `Barcode ${barcode} found. Checking the product catalogue…`, 38);
      try {
        const resolved = await serverResolve(barcode, '');
        const rows = resolved?.candidates || [];
        if (rows.length) {
          progress(card, 'Barcode match ready.', 100);
          renderBarcode(card, rows, fromHome);
          return;
        }
      } catch (error) {
        console.warn('Barcode catalogue lookup failed', error);
      }
    }

    progress(card, 'Preparing a privacy-reduced copy for AI vision…', 48);
    let identity;
    try {
      progress(card, 'AI is reading the product, branding and model clues…', 64);
      identity = await aiIdentify(file, barcode);
    } catch (error) {
      console.error('AI product identification failed', error);
      progress(card, 'AI recognition could not finish.', 100);
      status(card, error?.message || 'AI recognition could not finish. Try another angle or continue manually.', true);
      const mount = card?.querySelector('.snap-candidates');
      if (mount) mount.innerHTML = `<a class="secondary-button" href="assess.html">Continue manually</a>`;
      return;
    }

    let primary = identityCandidate(identity, false);
    const alternatives = (identity.alternatives || []).map((row) => identityCandidate(row, true)).filter((row) => row.confidence >= 25);

    const query = clean(identity.search_query || identity.product_name, 220);
    if (query) {
      progress(card, 'AI match found. Checking the catalogue for supporting product data…', 84);
      try {
        const catalogueRows = (await serverResolve('', query))?.candidates || [];
        primary = enrich(primary, catalogueRows, identity);
      } catch (error) {
        console.warn('AI catalogue enrichment failed', error);
      }
    }

    progress(card, 'Product identification ready.', 100);
    renderAi(card, primary, alternatives, fromHome);
  }

  // Capture phase prevents the legacy OCR-only handler from processing the same photo.
  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains('snap-file-input')) return;
    const file = input.files?.[0];
    if (!file) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const { card, fromHome } = getCard(input);
    identify(file, card, fromHome).catch((error) => {
      console.error('Snap & Assess v20 failed', error);
      progress(card, 'Recognition could not finish.', 100);
      status(card, 'Recognition could not finish. Try another product photo or continue manually.', true);
    });
  }, true);
})();
