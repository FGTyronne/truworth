function help(text) {
  return `<span class="help-wrap" tabindex="0" aria-label="${esc(text)}"><span class="help-star" aria-hidden="true">✦</span><span class="help-tooltip" role="tooltip">${esc(text)}</span></span>`;
}

function homePage() {
  const ranked = sortedRecords().slice(0, 5);
  const purchasedCount = records.filter((r) => r.status === 'purchased' || purchases[r.id]).length;
  const best = ranked[0];
  layout('', '', `
    <section class="home-dashboard">
      <div class="home-intro">
        <h1>What are you thinking about buying?</h1>
        <p>Paste a link if you already found it, or type what you are looking for and TruWorth will help you move from search to assessment.</p>
        <form id="homeProductSearch" class="home-search-bar">
          ${icon('search')}
          <input id="homeProductUrl" type="search" placeholder="Paste a link or search for a product" aria-label="Product link or search">
          <button class="primary-button" type="submit">Continue</button>
        </form>
      </div>
      ${records.length ? `<div class="home-stats"><span><strong>${records.length}</strong> saved</span><span><strong>${purchasedCount}</strong> purchased</span>${best ? `<span><strong>${best.score}</strong> current best score</span>` : ''}</div>` : ''}
      <section class="home-library">
        <div class="home-library-head"><h2>${records.length ? 'Your saved products' : 'Your product history starts here'}</h2>${records.length ? '<a href="watchlist.html">View all</a>' : ''}</div>
        ${records.length ? `<div class="product-list">${ranked.map((r, i) => productRow(r, i + 1)).join('')}</div>` : `<div class="home-empty"><p>Assess a product you are considering and it will stay here with its original link and score.</p><a class="secondary-button" href="assess.html">Start without a link</a></div>`}
      </section>
    </section>`, { compact: true });
  $('homeProductSearch').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = $('homeProductUrl').value.trim();
    if (!value) { location.href = 'assess.html'; return; }
    try {
      const candidate = new URL(value);
      if (['http:', 'https:'].includes(candidate.protocol)) {
        location.href = `assess.html?url=${encodeURIComponent(candidate.toString())}`;
        return;
      }
    } catch {}
    location.href = `assess.html?q=${encodeURIComponent(value)}`;
  });
}

function assessmentForm() {
  return `<section class="assessment-layout">
    <form id="assessment" class="assessment-form" novalidate>
      <div class="discovery-card">
        <label for="discoveryQuery">Find a product</label>
        <div class="discovery-row"><input id="discoveryQuery" type="search" placeholder="e.g. Sony headphones or espresso machine"><button class="secondary-button search-handoff" id="searchGoogle" type="button">Search Google</button></div>
        <p id="discoveryStatus" class="discovery-note"><strong>How it works:</strong> Google opens in a new tab. Pick the product you want, copy its link and paste it into TruWorth below.</p>
      </div>

      <div class="import-card">
        <label for="productUrl">Product link ${help("Paste the retailer page for the product you are considering. TruWorth will try to pull the name, image, seller and price when the page exposes them.")}</label>
        <div class="import-row"><input id="productUrl" name="source_url" type="url" inputmode="url" placeholder="https://seller.com/product"><button class="secondary-button" id="importProduct" type="button">Import</button></div>
        <p id="importStatus" class="field-hint">${user ? 'We will fill in what the page exposes, then you can correct anything before scoring.' : 'Sign in to import details automatically, or continue manually.'}</p>
      </div>

      <div class="form-section"><div class="form-section-heading"><span>What are you considering?</span><small>Name, price and source</small></div>
        <div class="form-grid two"><label class="field span-2"><span>Product</span><input class="input" id="item" name="item" maxlength="200" required placeholder="e.g. Sony WH-1000XM6 or espresso machine"></label>
        <label class="field"><span>Brand</span><input class="input" id="brand" name="brand" maxlength="120" placeholder="Optional"></label>
        <label class="field"><span>Retailer or seller</span><input class="input" id="retailer" name="retailer" maxlength="120" placeholder="Optional"></label>
        <label class="field"><span>Price</span><div class="money-input"><span>£</span><input class="input" id="price" name="price" type="number" min="0" max="10000000" step="0.01" required placeholder="0.00"></div></label>
        <label class="field"><span>Extra lifetime costs ${help("Include spending after the initial price: accessories, refills, replacement parts, maintenance or servicing. Example: £8 per month for filters over two years is £192.")}</span><div class="money-input"><span>£</span><input class="input" id="upkeep" name="upkeep" type="number" min="0" max="10000000" step="0.01" value="0" required></div></label></div>
      </div>

      <div class="form-section"><div class="form-section-heading"><span>How you will use it</span><small>Your realistic estimate</small></div>
        <div class="form-grid two"><label class="field"><span>Expected uses ${help("Estimate how many times you will realistically use it before replacing it or losing interest. Example: 3 uses a week for 2 years is about 300 uses.")}</span><input class="input" id="uses" name="uses" type="number" min="1" max="1000000" step="1" required placeholder="50"></label>
        <label class="field"><span>Setup & upkeep hours ${help("Count the time spent assembling, learning, charging, cleaning or maintaining it over its useful life. If there is virtually none, enter 0.")}</span><input class="input" id="effort" name="effort" type="number" min="0" max="100000" step="0.25" value="0" required></label>
        <label class="field span-2"><span>Enjoyment after the novelty wears off ${help("Score the enjoyment you expect once the initial excitement fades. A 7 means you still expect to genuinely enjoy or appreciate it long term.")}</span><div class="range-row"><input id="joy" name="joy" type="range" min="1" max="10" value="5"><output id="joyout" for="joy">5/10</output></div></label>
        <label class="field"><span>Minutes saved per use ${help("How much time does this save compared with what you do now? Example: a robot vacuum that saves about 20 minutes each clean = 20. If it saves no time, enter 0.")}</span><input class="input" id="minutes" name="minutes" type="number" min="0" max="10000" step="1" value="0" required></label>
        <label class="field"><span>Value of an hour to you ${help("This is a rough personal value for your time, not necessarily your wage. It lets TruWorth value genuine time savings. If unsure, £15 is a reasonable neutral starting point.")}</span><div class="money-input"><span>£</span><input class="input" id="hourValue" name="hourValue" type="number" min="0" max="100000" step="1" value="15" required></div></label></div>
      </div>

      <div class="form-section"><div class="form-section-heading"><span>Why you want it</span><small>Pick the closest fit</small></div>
        <div class="choice-grid" role="radiogroup" aria-label="Primary motivation">
          <label><input type="radio" name="motive" value="need" checked><span><strong>Useful</strong><small>Solves a real problem</small></span></label>
          <label><input type="radio" name="motive" value="joy"><span><strong>Enjoyment</strong><small>Something you genuinely value</small></span></label>
          <label><input type="radio" name="motive" value="image"><span><strong>Impulse</strong><small>Trend, status or quick want</small></span></label>
        </div>
        <label class="field"><span>Alternative you already have ${help("What could do the same job without this purchase? Example: your current headphones, older phone, existing coffee machine or something you could borrow.")}</span><input class="input" id="alternative" name="alternative" maxlength="160" placeholder="Optional"></label>
      </div>

      <input id="imageUrl" name="image_url" type="hidden"><input id="canonicalUrl" name="canonical_url" type="hidden"><input id="currency" name="currency" type="hidden" value="GBP">
      <p class="error" id="formError" role="alert"></p>
      <button class="primary-button submit-button" type="submit">Calculate my score</button>
    </form>

    <aside class="assessment-aside"><div class="sticky-card"><span class="context-label">TruWorth score</span><strong class="context-score">0–100</strong><p>The score balances price with expected use, lasting enjoyment and the friction the purchase adds to your life.</p><div class="context-rule"></div><p class="aside-note">You can reopen it later, compare it with another option and update it if you actually buy it.</p></div></aside>
  </section>`;
}

function assessPage() {
  layout('Assess a product', 'Put the purchase through a quick check.', assessmentForm(), { kicker: 'New assessment' });
  $('joy').addEventListener('input', () => { $('joyout').value = `${$('joy').value}/10`; });
  $('searchGoogle').addEventListener('click', openGoogleSearch);
  $('discoveryQuery').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); openGoogleSearch(); } });
  $('importProduct').addEventListener('click', importProductFromUrl);
  $('assessment').addEventListener('submit', saveAssessment);
  const params = new URLSearchParams(location.search);
  const incomingUrl = params.get('url');
  const incomingQuery = params.get('q');
  if (incomingQuery) $('discoveryQuery').value = incomingQuery;
  if (incomingUrl) {
    $('productUrl').value = incomingUrl;
    if (user && supabaseClient) importProductFromUrl();
  }
}

function openGoogleSearch() {
  const query = $('discoveryQuery').value.trim();
  const status = $('discoveryStatus');
  if (!query) {
    status.textContent = 'Type what you want to find first.';
    return;
  }
  const target = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  window.open(target, '_blank', 'noopener,noreferrer');
  status.innerHTML = '<strong>Google is open.</strong> Choose the product, copy its page link, then paste it into the field below.';
}

async function importProductFromUrl() {
  const status = $('importStatus');
  const url = $('productUrl').value.trim();
  if (!url) { status.textContent = 'Paste a product link first.'; return; }
  if (!user || !supabaseClient) { status.innerHTML = 'Sign in to import details automatically. <a href="account.html">Sign in</a>'; return; }
  status.textContent = 'Importing page details...';
  $('importProduct').disabled = true;
  try {
    const { data, error } = await supabaseClient.functions.invoke('import-product', { body: { url } });
    if (error) throw error;
    if (data?.title) $('item').value = data.title;
    if (data?.brand) $('brand').value = data.brand;
    if (data?.retailer) $('retailer').value = data.retailer;
    if (data?.price != null) $('price').value = data.price;
    if (data?.image_url) $('imageUrl').value = data.image_url;
    if (data?.canonical_url) $('canonicalUrl').value = data.canonical_url;
    if (data?.currency) $('currency').value = data.currency;
    status.textContent = data?.title ? 'Details imported. Check them before scoring.' : 'We reached the page but could not identify enough structured data. Add the missing details manually.';
  } catch (error) {
    console.error(error);
    status.textContent = 'We could not import that page. You can still complete the assessment manually.';
  } finally {
    $('importProduct').disabled = false;
  }
}

function formValues() {
  const form = new FormData($('assessment'));
  const values = Object.fromEntries(form.entries());
  return {
    item: values.item.trim(), brand: values.brand.trim(), retailer: values.retailer.trim(),
    price: Number(values.price), upkeep: Number(values.upkeep), uses: Number(values.uses), effort: Number(values.effort),
    joy: Number(values.joy), minutes: Number(values.minutes), hourValue: Number(values.hourValue), motive: values.motive,
    alternative: values.alternative.trim(), source_url: values.source_url.trim(), canonical_url: values.canonical_url.trim(),
    image_url: values.image_url.trim(), currency: values.currency || 'GBP'
  };
}

async function saveAssessment(event) {
  event.preventDefault();
  const form = $('assessment');
  const errorBox = $('formError');
  if (!form.reportValidity()) return;
  errorBox.textContent = '';
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const inputs = formValues();
    const result = score(inputs);
    if (user && supabaseClient) {
      const { data, error } = await supabaseClient.from('assessments').insert({
        user_id: user.id,
        title: inputs.item,
        brand: inputs.brand || null,
        retailer: inputs.retailer || null,
        source_url: inputs.source_url || null,
        canonical_url: inputs.canonical_url || null,
        image_url: inputs.image_url || null,
        observed_price: inputs.price,
        currency: inputs.currency,
        score: result.score,
        score_version: result.version,
        inputs,
        status: 'considering'
      }).select('*').single();
      if (error) throw error;
      location.href = `result.html?id=${encodeURIComponent(data.id)}`;
      return;
    }
    const record = {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      created_at: new Date().toISOString(), title: inputs.item, brand: inputs.brand, retailer: inputs.retailer,
      source_url: inputs.source_url, canonical_url: inputs.canonical_url, image_url: inputs.image_url,
      observed_price: inputs.price, currency: inputs.currency, score: result.score, score_version: result.version,
      inputs, status: 'considering'
    };
    records.push(record);
    saveLocal();
    location.href = `result.html?id=${encodeURIComponent(record.id)}`;
  } catch (error) {
    console.error(error);
    errorBox.textContent = String(error.message || '').includes('storage limit') ? 'You have reached the 10-product Free limit. Remove a saved item or upgrade to TruWorth+.' : (error.message || 'We could not save this assessment.');
    button.disabled = false;
  }
}