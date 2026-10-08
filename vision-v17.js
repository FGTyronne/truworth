(() => {
  const MODEL_SRC = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm';
  const MODEL_ID = 'onnx-community/mobilenetv4_conv_small.e2400_r224_in1k';
  const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
  const SNAP_KEY = 'truworth_snap_candidate_v1';
  let classifierPromise = null;

  const esc = (value = '') => String(value).replace(/[&<>'"]/g, (m) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[m]));
  const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

  const FRIENDLY = [
    [/saltshaker|salt shaker/i, 'Salt / pepper grinder or shaker'],
    [/pepper mill|pepper grinder/i, 'Salt / pepper grinder'],
    [/soap dispenser/i, 'Soap dispenser'],
    [/water bottle/i, 'Water bottle'],
    [/coffee mug|cup/i, 'Mug or cup'],
    [/espresso maker/i, 'Coffee / espresso maker'],
    [/vacuum|vacuum cleaner/i, 'Vacuum cleaner'],
    [/hair dryer|blow dryer|hand blower/i, 'Hair dryer'],
    [/remote control/i, 'Remote control'],
    [/computer keyboard|keyboard/i, 'Computer keyboard'],
    [/computer mouse|mouse/i, 'Computer mouse'],
    [/notebook computer|laptop/i, 'Laptop'],
    [/cellular telephone|cell phone|mobile phone/i, 'Mobile phone'],
    [/running shoe/i, 'Running shoe'],
    [/sunglass|sunglasses/i, 'Sunglasses'],
    [/backpack|rucksack/i, 'Backpack'],
    [/handbag|purse/i, 'Handbag'],
    [/watch/i, 'Watch'],
    [/camera/i, 'Camera'],
    [/speaker|loudspeaker/i, 'Speaker'],
    [/headphone/i, 'Headphones'],
    [/electric fan|fan/i, 'Fan'],
    [/toaster/i, 'Toaster'],
    [/microwave/i, 'Microwave'],
    [/refrigerator/i, 'Refrigerator'],
    [/washer|washing machine/i, 'Washing machine'],
    [/iron/i, 'Iron'],
    [/scale|weighing machine/i, 'Scale'],
    [/perfume/i, 'Perfume'],
    [/lipstick/i, 'Lipstick'],
    [/electric guitar|acoustic guitar|guitar/i, 'Guitar'],
    [/television|tv/i, 'Television'],
  ];

  function friendlyLabel(raw) {
    const label = String(raw || '').split(',')[0].trim();
    for (const [pattern, friendly] of FRIENDLY) if (pattern.test(label)) return friendly;
    return titleCase(label);
  }

  function productish(raw) {
    const bad = /^(person|man|woman|boy|girl|dog|cat|bird|fish|insect|spider|snake|lizard|frog|flower|tree|fungus|mushroom|mountain|cliff|valley|seashore|coral|volcano|geyser|alp|promontory|sandbar|lakeside|breakwater|dam|castle|palace|monastery|church|mosque|restaurant|library|prison|school bus)$/i;
    const label = String(raw || '').split(',')[0].trim();
    return label && !bad.test(label);
  }

  async function getClassifier() {
    if (!classifierPromise) classifierPromise = (async () => {
      const mod = await import(MODEL_SRC);
      const options = navigator.gpu ? { device: 'webgpu' } : {};
      return mod.pipeline('image-classification', MODEL_ID, options);
    })();
    return classifierPromise;
  }

  async function classify(file) {
    try {
      const classifier = await getClassifier();
      const rows = await classifier(file, { top_k: 8 });
      return (rows || [])
        .filter((r) => productish(r.label))
        .map((r) => ({ raw: r.label, title: friendlyLabel(r.label), score: Number(r.score || 0) }))
        .filter((r, i, arr) => r.title && arr.findIndex((x) => x.title === r.title) === i)
        .slice(0, 3);
    } catch (error) {
      console.warn('Local visual recognition unavailable', error);
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

  async function scanText(file) {
    await loadTesseract();
    const worker = await window.Tesseract.createWorker('eng');
    try {
      const result = await worker.recognize(file);
      return result?.data?.text || '';
    } finally { await worker.terminate(); }
  }

  function usefulOcrQuery(raw) {
    const stop = /^(warning|caution|made in|serial|s\/n|model|barcode|www\.|http|ce\b|recycle|recycling|keep away|instructions)/i;
    const lines = String(raw || '').split(/\n+/)
      .map((x) => x.replace(/[^\p{L}\p{N}\-+&.'\/ ]/gu, ' ').replace(/\s+/g, ' ').trim())
      .filter((x) => x.length >= 3 && x.length <= 70 && !stop.test(x));
    return lines.sort((a,b) => (/\d/.test(b) - /\d/.test(a)) || b.length - a.length).slice(0, 2).join(' ').slice(0, 110);
  }

  function getCard(input) {
    let card = input.closest('[data-snap-card]');
    if (card) return { card, fromHome: false, shell: null };
    const shell = document.createElement('section');
    shell.className = 'snap-modal-shell';
    shell.innerHTML = `<button class="snap-modal-close" aria-label="Close">×</button><section class="snap-card compact" data-snap-card><div class="snap-copy"><span class="snap-icon" aria-hidden="true">◉</span><div><p class="kicker">Snap & Assess</p><h2>Recognising what you photographed.</h2><p>TruWorth checks barcodes, visible text and the product's visual shape locally on your device. Your raw photo is not uploaded or stored.</p></div></div><div class="snap-work"><img class="snap-preview" alt="Photo selected for product identification"><div class="snap-progress"><strong>Looking for the product…</strong><span class="snap-progress-text">Checking the image locally.</span><div class="snap-meter"><i></i></div></div></div><p class="snap-status" role="status"></p><div class="snap-candidates"></div></section>`;
    document.body.appendChild(shell);
    shell.querySelector('.snap-modal-close')?.addEventListener('click', () => shell.remove());
    return { card: shell.querySelector('[data-snap-card]'), fromHome: true, shell };
  }

  function setProgress(card, text, pct) {
    const work = card?.querySelector('.snap-work');
    const label = card?.querySelector('.snap-progress-text');
    const meter = card?.querySelector('.snap-meter i');
    if (work) work.hidden = false;
    if (label) label.textContent = text;
    if (meter) meter.style.width = `${Math.max(8, Math.min(100, pct))}%`;
  }

  function status(card, text, error = false) {
    const p = card?.querySelector('.snap-status');
    if (!p) return;
    p.textContent = text;
    p.className = `snap-status ${error ? 'error' : ''}`;
  }

  async function serverResolve(barcode, text) {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return { candidates: [] };
    const { data, error } = await supabaseClient.functions.invoke('snap-resolve', { body: { barcode: barcode || null, text: text || null } });
    if (error) throw error;
    return data || { candidates: [] };
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
    const card = document.querySelector('[data-snap-card]');
    status(card, `Using ${candidate.title}. Confirm the exact item and price below before calculating.`);
    document.getElementById('item')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function visualCandidate(row) {
    return {
      title: row.title,
      brand: '',
      category: row.title,
      image_url: null,
      source_url: null,
      source_label: 'On-device visual recognition',
      price: null,
      currency: null,
      retailer: null,
      confidence: Math.round(row.score * 100),
      visual_only: true,
    };
  }

  function render(card, visualRows, catalogueRows, context) {
    const mount = card?.querySelector('.snap-candidates');
    if (!mount) return;
    const visual = visualRows.filter((r) => r.score >= 0.035).slice(0, 3);
    const visualWords = new Set(visual.flatMap((r) => r.title.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length >= 4)));
    const aligned = (catalogueRows || []).filter((c) => {
      const title = String(c.title || '').toLowerCase();
      return visualWords.size === 0 || [...visualWords].some((w) => title.includes(w));
    }).slice(0, 3);

    if (!visual.length && !aligned.length) {
      status(card, 'I could not identify this confidently. Try the label or barcode, or enter the item manually.', true);
      mount.innerHTML = `<a class="secondary-button" href="assess.html">Continue manually</a>`;
      return;
    }

    status(card, 'Confirm what you photographed. Visual guesses describe the product type; catalogue matches are only shown when they agree with the image.');
    let html = '';
    if (visual.length) {
      html += `<div class="snap-match-head"><strong>Visual recognition</strong><span>Runs on your device — no photo upload.</span></div><div class="snap-match-list">${visual.map((r, i) => `<article class="snap-match"><div class="snap-match-placeholder">◉</div><div><small>Product type · ${Math.round(r.score * 100)}% visual confidence</small><strong>${esc(r.title)}</strong><span>Use this when the exact brand or model is not visible.</span></div><button class="secondary-button vision-use" data-vision-index="${i}" type="button">Use this type</button></article>`).join('')}</div>`;
    }
    if (aligned.length) {
      html += `<div class="snap-match-head"><strong>Possible exact matches</strong><span>Only results consistent with the visual recognition are shown.</span></div><div class="snap-match-list">${aligned.map((c, i) => `<article class="snap-match"><div class="snap-match-placeholder">?</div><div><small>${esc(c.brand || c.source_label || 'Catalogue match')}</small><strong>${esc(c.title || 'Product')}</strong><span>${esc(c.category || 'Price to confirm')}</span></div><button class="secondary-button catalogue-use" data-catalogue-index="${i}" type="button">Use this</button></article>`).join('')}</div>`;
    }
    mount.innerHTML = html;
    mount.querySelectorAll('.vision-use').forEach((button) => button.addEventListener('click', () => choose(visualCandidate(visual[Number(button.dataset.visionIndex)]), context.fromHome)));
    mount.querySelectorAll('.catalogue-use').forEach((button) => button.addEventListener('click', () => choose(aligned[Number(button.dataset.catalogueIndex)], context.fromHome)));
  }

  async function identify(file, card, fromHome) {
    if (!file.type.startsWith('image/')) return status(card, 'Choose an image file.', true);
    if (file.size > 12 * 1024 * 1024) return status(card, 'That photo is too large. Try one under 12 MB.', true);

    const preview = card?.querySelector('.snap-preview');
    const localUrl = URL.createObjectURL(file);
    if (preview) { preview.src = localUrl; preview.onload = () => URL.revokeObjectURL(localUrl); }

    status(card, '');
    setProgress(card, 'Checking for a barcode…', 12);
    let barcode = '';
    try { barcode = await scanBarcode(file); } catch (e) { console.debug('Barcode unavailable', e); }

    if (barcode) {
      setProgress(card, `Barcode found: ${barcode}. Looking it up…`, 70);
      try {
        const data = await serverResolve(barcode, '');
        const rows = data?.candidates || [];
        setProgress(card, 'Product match ready.', 100);
        if (rows.length) return render(card, [], rows, { fromHome });
      } catch (e) { console.warn('Barcode lookup failed', e); }
    }

    setProgress(card, 'Recognising the product shape and any visible text locally…', 28);
    const [visualRows, text] = await Promise.all([
      classify(file),
      scanText(file).catch(() => ''),
    ]);
    const query = usefulOcrQuery(text);
    setProgress(card, 'Checking possible matches…', 78);

    let catalogueRows = [];
    if (query) {
      try { catalogueRows = (await serverResolve('', query))?.candidates || []; } catch (e) { console.warn('Catalogue lookup failed', e); }
    }

    setProgress(card, 'Recognition ready.', 100);
    render(card, visualRows, catalogueRows, { fromHome });
  }

  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains('snap-file-input')) return;
    const file = input.files?.[0];
    if (!file) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    const { card, fromHome } = getCard(input);
    identify(file, card, fromHome).catch((error) => {
      console.error('Visual recognition failed', error);
      status(card, 'Recognition could not finish. Try a clearer angle or continue manually.', true);
      const mount = card?.querySelector('.snap-candidates');
      if (mount) mount.innerHTML = '<a class="secondary-button" href="assess.html">Continue manually</a>';
    });
  }, true);
})();