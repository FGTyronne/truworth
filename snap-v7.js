(() => {
  const SNAP_KEY = 'truworth_snap_candidate_v1';
  const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';

  const plusActive = () => Boolean(user && subscription?.tier === 'plus' && ['active', 'trialing'].includes(subscription?.status));
  const el = (tag, className, html = '') => { const node = document.createElement(tag); if (className) node.className = className; node.innerHTML = html; return node; };

  function snapCard(compact = false) {
    return `<section class="snap-card ${compact ? 'compact' : ''}" data-snap-card>
      <div class="snap-copy"><span class="snap-icon" aria-hidden="true">◉</span><div><p class="kicker">Snap & Assess</p><h2>${compact ? 'See it. Snap it. Reality-check it.' : 'Take a picture of what you are thinking about buying.'}</h2><p>TruWorth looks for a barcode first, then reads visible product text on your device. Your raw photo is not uploaded or stored.</p></div></div>
      <div class="snap-actions"><label class="primary-button snap-camera-button">Take a picture<input class="snap-file-input" type="file" accept="image/*" capture="environment" hidden></label><label class="secondary-button snap-upload-button">Choose photo<input class="snap-file-input" type="file" accept="image/*" hidden></label></div>
      <div class="snap-work" hidden><img class="snap-preview" alt="Photo selected for product identification"><div class="snap-progress"><strong>Looking for the product…</strong><span class="snap-progress-text">Checking the image locally.</span><div class="snap-meter"><i></i></div></div></div>
      <p class="snap-status" role="status"></p><div class="snap-candidates"></div>
    </section>`;
  }

  const baseHomePage = homePage;
  homePage = function() {
    baseHomePage();
    const actions = document.querySelector('.home-primary-actions');
    if (actions && !actions.querySelector('.snap-home-action')) {
      const label = document.createElement('label');
      label.className = 'secondary-button snap-home-action';
      label.innerHTML = `📷 Snap & Assess<input class="snap-file-input" type="file" accept="image/*" capture="environment" hidden>`;
      actions.appendChild(label);
      bindSnapInput(label.querySelector('.snap-file-input'), null, true);
    }
    const paths = document.querySelector('.home-paths');
    if (paths && !paths.querySelector('.path-snap')) {
      const card = el('div', 'home-path path-snap', `<span>04</span><strong>Snap what you see</strong><small>In a shop? Photograph the product and TruWorth will try to identify it before you assess it.</small><label class="text-button">Open camera<input class="snap-file-input" type="file" accept="image/*" capture="environment" hidden></label>`);
      paths.appendChild(card);
      bindSnapInput(card.querySelector('.snap-file-input'), null, true);
    }
  };

  const baseAssessPage = assessPage;
  assessPage = function() {
    baseAssessPage();
    const form = $('assessment');
    if (form && !document.querySelector('[data-snap-card]')) {
      form.insertAdjacentHTML('afterbegin', snapCard(false));
      bindSnapCard(document.querySelector('[data-snap-card]'));
    }
    const saved = sessionStorage.getItem(SNAP_KEY);
    if (saved) {
      try { applyCandidate(JSON.parse(saved)); sessionStorage.removeItem(SNAP_KEY); } catch {}
    }
  };

  function bindSnapCard(card) {
    card.querySelectorAll('.snap-file-input').forEach((input) => bindSnapInput(input, card, false));
  }

  function bindSnapInput(input, card, fromHome) {
    input?.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) return showSnapStatus(card, 'Choose an image file.', true);
      if (file.size > 12 * 1024 * 1024) return showSnapStatus(card, 'That photo is too large. Try one under 12 MB.', true);
      if (fromHome) {
        sessionStorage.setItem('truworth_snap_pending', '1');
        const holder = document.createElement('section');
        holder.className = 'snap-modal-shell';
        holder.innerHTML = `<button class="snap-modal-close" aria-label="Close">×</button>${snapCard(true)}`;
        document.body.appendChild(holder);
        const modalCard = holder.querySelector('[data-snap-card]');
        holder.querySelector('.snap-modal-close').addEventListener('click', () => holder.remove());
        await identifyPhoto(file, modalCard, true);
        return;
      }
      await identifyPhoto(file, card, false);
    });
  }

  function showSnapStatus(card, message, error = false) {
    const target = card?.querySelector('.snap-status');
    if (!target) return;
    target.textContent = message;
    target.className = `snap-status ${error ? 'error' : ''}`;
  }

  function updateProgress(card, text, pct) {
    const work = card?.querySelector('.snap-work');
    const label = card?.querySelector('.snap-progress-text');
    const meter = card?.querySelector('.snap-meter i');
    if (work) work.hidden = false;
    if (label) label.textContent = text;
    if (meter) meter.style.width = `${Math.max(8, Math.min(100, pct || 8))}%`;
  }

  async function identifyPhoto(file, card, fromHome) {
    const preview = card?.querySelector('.snap-preview');
    const localUrl = URL.createObjectURL(file);
    if (preview) { preview.src = localUrl; preview.onload = () => URL.revokeObjectURL(localUrl); }
    showSnapStatus(card, '');
    updateProgress(card, 'Checking for a barcode…', 18);

    let barcode = '';
    try { barcode = await scanBarcode(file); } catch (error) { console.debug('Barcode scan unavailable', error); }

    let text = '';
    if (!barcode) {
      updateProgress(card, 'No barcode found. Reading visible product text on your device…', 42);
      try {
        text = await scanText(file, (pct) => updateProgress(card, 'Reading visible product text on your device…', 42 + pct * 35));
      } catch (error) {
        console.warn('OCR unavailable', error);
      }
    }

    const query = usefulOcrQuery(text);
    if (!barcode && !query) {
      updateProgress(card, 'We need a clearer label, barcode or model name.', 100);
      showSnapStatus(card, 'We could not identify enough from that image. Try the packaging/barcode, or continue by searching manually.', true);
      const candidates = card?.querySelector('.snap-candidates');
      if (candidates) candidates.innerHTML = `<a class="secondary-button" href="assess.html">Continue manually</a>`;
      return;
    }

    updateProgress(card, barcode ? `Barcode found: ${barcode}. Resolving product…` : `Text found: “${query.slice(0, 70)}”. Resolving product…`, 82);
    try {
      const data = await resolveProduct(barcode, query);
      updateProgress(card, 'Product matches ready.', 100);
      renderCandidates(card, data?.candidates || [], { barcode, query, fromHome });
    } catch (error) {
      console.error(error);
      updateProgress(card, 'Product lookup could not finish.', 100);
      showSnapStatus(card, 'We read the image, but the product database did not return a reliable match. You can use the detected text to continue searching.', true);
      const mount = card?.querySelector('.snap-candidates');
      if (mount) mount.innerHTML = `<a class="secondary-button" href="assess.html?q=${encodeURIComponent(query || barcode)}">Search “${esc((query || barcode).slice(0,60))}”</a>`;
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

  async function scanText(file, onProgress) {
    await loadTesseract();
    const worker = await window.Tesseract.createWorker('eng', 1, {
      logger: (m) => { if (m.status === 'recognizing text') onProgress?.(Number(m.progress || 0)); }
    });
    try {
      const result = await worker.recognize(file);
      return result?.data?.text || '';
    } finally { await worker.terminate(); }
  }

  function usefulOcrQuery(raw) {
    const stop = /^(warning|caution|made in|serial|s\/n|model|barcode|www\.|http|ce\b|recycle|recycling|keep away|instructions)/i;
    const lines = String(raw || '').split(/\n+/).map((x) => x.replace(/[^\p{L}\p{N}\-+&.'\/ ]/gu, ' ').replace(/\s+/g, ' ').trim()).filter((x) => x.length >= 3 && x.length <= 80 && !stop.test(x));
    const interesting = lines.sort((a,b) => (/\d/.test(b) - /\d/.test(a)) || b.length - a.length).slice(0, 3);
    return interesting.join(' ').slice(0, 150);
  }

  async function resolveProduct(barcode, text) {
    if (!supabaseClient) throw new Error('Product lookup unavailable');
    const { data, error } = await supabaseClient.functions.invoke('snap-resolve', { body: { barcode: barcode || null, text: text || null } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  function renderCandidates(card, candidates, context) {
    const mount = card?.querySelector('.snap-candidates');
    if (!mount) return;
    if (!candidates.length) {
      showSnapStatus(card, 'No confident product match came back. Try another angle or continue with the detected text.', true);
      mount.innerHTML = `<a class="secondary-button" href="assess.html?q=${encodeURIComponent(context.query || context.barcode || '')}">Continue with search</a>`;
      return;
    }
    showSnapStatus(card, context.barcode ? 'Barcode matched. Confirm the exact product below.' : 'Possible matches found. Confirm the exact product before TruWorth uses it.');
    mount.innerHTML = `<div class="snap-match-head"><strong>${context.barcode ? 'Barcode match' : 'Possible matches'}</strong><span>We never silently guess the variant.</span></div><div class="snap-match-list">${candidates.slice(0,4).map((c, i) => `
      <article class="snap-match" data-candidate-index="${i}">
        ${c.image_url ? `<img src="${esc(c.image_url)}" alt="" referrerpolicy="no-referrer">` : '<div class="snap-match-placeholder">?</div>'}
        <div><small>${esc(c.brand || c.source_label || 'Product match')}</small><strong>${esc(c.title || 'Unknown product')}</strong><span>${[c.category, c.price != null ? `${c.currency === 'GBP' ? '£' : ''}${Number(c.price).toFixed(2)}` : 'Price to confirm'].filter(Boolean).map(esc).join(' · ')}</span></div>
        <button class="secondary-button snap-use-match" type="button">Use this</button>
      </article>`).join('')}</div>`;
    mount.querySelectorAll('.snap-use-match').forEach((button, index) => button.addEventListener('click', () => chooseCandidate(candidates[index], context.fromHome)));
  }

  function chooseCandidate(candidate, fromHome) {
    if (fromHome || !$('assessment')) {
      sessionStorage.setItem(SNAP_KEY, JSON.stringify(candidate));
      location.href = 'assess.html?snap=1';
      return;
    }
    applyCandidate(candidate);
  }

  function applyCandidate(candidate) {
    if (!$('assessment')) return;
    if ($('item')) $('item').value = candidate.title || '';
    if ($('brand')) $('brand').value = candidate.brand || '';
    if ($('retailer')) $('retailer').value = candidate.retailer || '';
    if ($('price') && candidate.price != null) $('price').value = Number(candidate.price).toFixed(2);
    if ($('productUrl')) $('productUrl').value = candidate.source_url || '';
    if ($('canonicalUrl')) $('canonicalUrl').value = candidate.source_url || '';
    if ($('imageUrl')) $('imageUrl').value = candidate.image_url || '';
    if ($('currency') && candidate.currency) $('currency').value = candidate.currency;
    const card = document.querySelector('[data-snap-card]');
    showSnapStatus(card, `Using ${candidate.title}. Check the price and assumptions below before calculating.`);
    const mount = card?.querySelector('.snap-candidates');
    if (mount) mount.innerHTML = `<div class="snap-selected"><div><span>Selected product</span><strong>${esc(candidate.title || '')}</strong></div><div class="snap-selected-actions"><button class="text-button snap-nearby" type="button">Find nearby sellers</button>${plusActive() ? '<button class="text-button snap-quick-vote" type="button">Get TruWorth+ quick vote</button>' : '<a class="text-button" href="plans.html">Unlock BUY / DON\'T BUY vote</a>'}</div><p>Nearby results use Google Maps and do not confirm store stock.</p></div>`;
    mount?.querySelector('.snap-nearby')?.addEventListener('click', () => openNearby(candidate));
    mount?.querySelector('.snap-quick-vote')?.addEventListener('click', () => quickVote(candidate, mount));
    $('item')?.scrollIntoView({ behavior: local.settings?.motion === false ? 'auto' : 'smooth', block: 'center' });
  }

  function openNearby(candidate) {
    const queryBase = `${candidate.title || candidate.brand || 'product'} retailer`;
    const open = (lat, lng) => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${queryBase} near ${lat},${lng}`)}`, '_blank', 'noopener,noreferrer');
    if (!navigator.geolocation) { open('me', ''); return; }
    navigator.geolocation.getCurrentPosition((pos) => open(pos.coords.latitude.toFixed(5), pos.coords.longitude.toFixed(5)), () => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${queryBase} near me`)}`, '_blank', 'noopener,noreferrer'), { enableHighAccuracy:false, timeout:7000, maximumAge:300000 });
  }

  async function quickVote(candidate, mount) {
    if (!plusActive() || !user || !supabaseClient) return;
    const button = mount.querySelector('.snap-quick-vote');
    if (button) { button.disabled = true; button.textContent = 'Voting…'; }
    try {
      const { data, error } = await supabaseClient.functions.invoke('purchase-vote', { body: { snapshot: { title: candidate.title, brand: candidate.brand, category: candidate.category, price: candidate.price, currency: candidate.currency || 'GBP' } } });
      if (error) throw error;
      if (data?.requires_financial_profile) {
        mount.insertAdjacentHTML('beforeend', `<div class="quick-vote-note"><strong>Add your financial context first</strong><span>TruWorth+ needs your private financial profile to give an instant in-shop vote.</span><a href="account.html#financial-profile">Add financial profile</a></div>`);
        return;
      }
      if (data?.requires_price) {
        mount.insertAdjacentHTML('beforeend', `<div class="quick-vote-note"><strong>Price needed for an instant vote</strong><span>Confirm the shop price in the assessor, then TruWorth+ can weigh it against your finances.</span></div>`);
        return;
      }
      renderVoteBubble(mount, data, true);
    } catch (error) {
      console.error(error);
      mount.insertAdjacentHTML('beforeend', '<div class="quick-vote-note error"><strong>Quick vote unavailable</strong><span>Complete the normal assessment and TruWorth+ will vote on the result.</span></div>');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Get TruWorth+ quick vote'; }
    }
  }

  const baseResultPageV7 = resultPage;
  resultPage = function() {
    baseResultPageV7();
    const record = findRecord();
    if (!record) return;
    injectPurchaseVote(record);
  };

  async function injectPurchaseVote(record) {
    const resultLayout = document.querySelector('.result-layout');
    if (!resultLayout || document.getElementById('purchaseVoteMount')) return;
    const mount = el('section', `purchase-vote-mount ${plusActive() ? 'premium-open' : 'premium-locked-vote'}`);
    mount.id = 'purchaseVoteMount';
    const financial = document.getElementById('financialFitMount');
    (financial || resultLayout.firstElementChild)?.insertAdjacentElement(financial ? 'afterend' : 'afterend', mount);

    if (!plusActive()) {
      mount.innerHTML = `<div class="vote-frost"><div class="vote-ghost"><span></span><strong></strong><p></p></div><div class="vote-lock-copy"><small>TruWorth+ decision vote</small><h2>Should you actually buy it?</h2><p>Subscribers get a private BUY / DON’T BUY vote using the score, financial fit and their real buying history.</p><a class="primary-button" href="plans.html">Unlock the vote</a></div></div>`;
      return;
    }
    mount.innerHTML = `<div class="vote-loading"><span></span><div><strong>TruWorth+ is voting…</strong><small>Value fit + financial fit + your buying behaviour</small></div></div>`;
    try {
      const { data, error } = await supabaseClient.functions.invoke('purchase-vote', { body: { assessment_id: record.id } });
      if (error) throw error;
      if (!data?.premium) throw new Error('Premium entitlement unavailable');
      renderVoteBubble(mount, data, false);
    } catch (error) {
      console.error(error);
      mount.innerHTML = `<div class="quick-vote-note error"><strong>Vote unavailable right now</strong><span>Your normal TruWorth assessment is still valid. We could not load the subscriber decision layer.</span></div>`;
    }
  }

  function renderVoteBubble(mount, data, quick) {
    const buy = data.vote === 'BUY';
    const factors = data.factors || [];
    mount.innerHTML = `<article class="decision-vote ${buy ? 'buy' : 'dont-buy'}">
      <div class="decision-orb"><small>${quick ? 'Quick vote' : 'TruWorth+ vote'}</small><strong>${esc(data.vote || '')}</strong><span>${Number(data.confidence || 0)}% confidence</span></div>
      <div class="decision-vote-copy"><p class="kicker">Based on what TruWorth knows about you</p><h2>${esc(data.headline || (buy ? 'This gets our vote.' : 'We would leave this one.'))}</h2><p>${esc(data.reason || '')}</p>${factors.length ? `<div class="vote-factors">${factors.map((f) => `<span><small>${esc(f.label)}</small><strong>${esc(f.value)}</strong></span>`).join('')}</div>` : ''}<details><summary>Why this vote?</summary><p>${esc(data.explanation || data.reason || '')}</p></details><small class="decision-support-note">Personalised decision support, not financial advice. You remain in control of the purchase.</small></div>
    </article>`;
  }
})();
