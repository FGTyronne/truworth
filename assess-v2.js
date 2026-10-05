function homePage() {
  const top = sortedRecords().slice(0, 4);
  layout('', '', `
    <section class="home-hero">
      <div class="home-hero-copy">
        <span class="eyebrow">Buy with more confidence</span>
        <h1>Know what a purchase is worth <em>to you</em>.</h1>
        <p>Paste a product link or assess something manually. TruWorth turns cost, likely use and satisfaction into one clear personal score.</p>
        <div class="hero-actions"><a class="primary-button" href="assess.html">Assess a product</a><a class="text-button" href="watchlist.html">View saved products</a></div>
      </div>
      <div class="hero-preview" aria-hidden="true">
        <div class="preview-search">${icon('search')}<span>Paste a product link...</span></div>
        <div class="preview-product"><div class="preview-image"></div><div><small>TRUWORTH SCORE</small><strong>82</strong><span>Strong fit</span></div></div>
      </div>
    </section>
    ${summaryStrip()}
    <section class="section-block">
      <div class="section-heading"><div><p class="kicker">Your library</p><h2>${records.length ? 'Best matches so far' : 'Start your product library'}</h2></div>${records.length ? '<a href="watchlist.html">See all</a>' : ''}</div>
      ${records.length ? `<div class="product-list">${top.map((r, i) => productRow(r, i + 1)).join('')}</div>` : `<div class="empty-state"><h3>No products saved yet</h3><p>Your ranked product history will appear here after your first assessment.</p><a class="secondary-button" href="assess.html">Assess your first product</a></div>`}
    </section>`, { compact: true });
}

function assessmentForm() {
  return `<section class="assessment-layout">
    <form id="assessment" class="assessment-form" novalidate>
      <div class="import-card">
        <label for="productUrl">Start with a product link</label>
        <div class="import-row"><input id="productUrl" name="source_url" type="url" inputmode="url" placeholder="https://retailer.com/product"><button class="secondary-button" id="importProduct" type="button">Import</button></div>
        <p id="importStatus" class="field-hint">${user ? 'We will pull the product name, image and price when available.' : 'Sign in to import product details automatically. You can still assess manually.'}</p>
      </div>

      <div class="form-section"><div class="form-section-heading"><span>Product</span><small>What are you considering?</small></div>
        <div class="form-grid two"><label class="field span-2"><span>Product name</span><input id="item" name="item" required maxlength="200" placeholder="e.g. Sony WH-1000XM6"></label>
        <label class="field"><span>Brand</span><input id="brand" name="brand" maxlength="120" placeholder="Optional"></label>
        <label class="field"><span>Retailer</span><input id="retailer" name="retailer" maxlength="120" placeholder="Optional"></label>
        <label class="field"><span>Price</span><div class="money-input"><span>£</span><input id="price" name="price" required type="number" min="0" max="10000000" step="0.01" placeholder="0.00"></div></label>
        <label class="field"><span>Extra lifetime costs</span><div class="money-input"><span>£</span><input id="upkeep" name="upkeep" required type="number" min="0" max="10000000" step="0.01" value="0"></div></label></div>
      </div>

      <div class="form-section"><div class="form-section-heading"><span>Real-life use</span><small>Be realistic, not optimistic.</small></div>
        <div class="form-grid two"><label class="field"><span>Expected uses</span><input id="uses" name="uses" required type="number" min="1" max="1000000" step="1" placeholder="50"></label>
        <label class="field"><span>Setup & upkeep hours</span><input id="effort" name="effort" required type="number" min="0" max="100000" step="0.25" value="0"></label>
        <label class="field span-2"><span>Enjoyment after the novelty wears off</span><div class="range-row"><input id="joy" name="joy" type="range" min="1" max="10" value="5"><output id="joyout" for="joy">5/10</output></div></label>
        <label class="field"><span>Minutes saved per use</span><input id="minutes" name="minutes" required type="number" min="0" max="10000" step="1" value="0"></label>
        <label class="field"><span>Value of an hour to you</span><div class="money-input"><span>£</span><input id="hourValue" name="hourValue" required type="number" min="0" max="100000" step="1" value="15"></div></label></div>
      </div>

      <div class="form-section"><div class="form-section-heading"><span>Motivation</span><small>What is really driving this purchase?</small></div>
        <div class="choice-grid" role="radiogroup" aria-label="Primary motivation">
          <label><input type="radio" name="motive" value="need" checked><span><strong>Useful</strong><small>It solves a real problem.</small></span></label>
          <label><input type="radio" name="motive" value="joy"><span><strong>Enjoyment</strong><small>I expect lasting pleasure from it.</small></span></label>
          <label><input type="radio" name="motive" value="image"><span><strong>Impulse</strong><small>Status, trend or a quick want.</small></span></label>
        </div>
        <label class="field"><span>Alternative you already have</span><input id="alternative" name="alternative" maxlength="160" placeholder="Optional"></label>
      </div>

      <input id="imageUrl" name="image_url" type="hidden"><input id="canonicalUrl" name="canonical_url" type="hidden"><input id="currency" name="currency" type="hidden" value="GBP">
      <p id="formError" class="form-message error" role="alert"></p>
      <button class="primary-button submit-button" type="submit">See my TruWorth score</button>
    </form>

    <aside class="assessment-aside"><div class="sticky-card"><p class="kicker">What TruWorth looks at</p><h2>Cost only matters in context.</h2><ul><li>How often you will actually use it</li><li>How much lasting enjoyment it creates</li><li>The friction and upkeep it adds</li><li>The real cost per use over time</li></ul><p class="aside-note">You can revise assumptions later and compare products side by side.</p></div></aside>
  </section>`;
}

function assessPage() {
  layout('Assess a product', 'A quick reality check before you spend.', assessmentForm(), { kicker: 'New assessment' });
  $('joy').addEventListener('input', () => { $('joyout').value = `${$('joy').value}/10`; });
  $('importProduct').addEventListener('click', importProductFromUrl);
  $('assessment').addEventListener('submit', saveAssessment);
}

async function importProductFromUrl() {
  const status = $('importStatus');
  const url = $('productUrl').value.trim();
  if (!url) { status.textContent = 'Paste a product link first.'; return; }
  if (!user || !supabaseClient) { status.innerHTML = 'Sign in to import details automatically. <a href="account.html">Sign in</a>'; return; }
  status.textContent = 'Importing product details...';
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
    status.textContent = data?.title ? 'Product details imported. Check the fields before scoring.' : 'We found the page but could not identify enough product details. Add them manually.';
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
    errorBox.textContent = String(error.message || '').includes('storage limit') ? 'You have reached the 10-product Free limit. Remove a saved product or upgrade to TruWorth+.' : (error.message || 'We could not save this assessment.');
    button.disabled = false;
  }
}
