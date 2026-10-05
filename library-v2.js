function findRecord() {
  const id = new URLSearchParams(location.search).get('id');
  return records.find((r) => r.id === id);
}

function resultPage() {
  const record = findRecord();
  if (!record) {
    layout('Product not found', 'It may have been removed or saved under another account.', `<div class="empty-state"><h3>No assessment here</h3><p>Return to your saved products or start a new assessment.</p><a class="secondary-button" href="watchlist.html">View saved products</a></div>`, { kicker: 'Assessment' });
    return;
  }
  const metrics = score({ ...record.inputs, item: record.title });
  const cautious = score({ ...record.inputs, item: record.title, uses: Math.max(1, Math.round(Number(record.inputs.uses) / 2)), joy: Math.max(1, Number(record.inputs.joy) - 2) });
  const bought = record.status === 'purchased' || Boolean(purchases[record.id]);
  layout(record.title, [record.brand, record.retailer].filter(Boolean).join(' · ') || 'Saved assessment', `
    <section class="result-layout">
      <div class="product-result-card">
        ${productImage(record, 'hero')}
        <div class="product-result-copy">
          <div class="result-score"><span>TruWorth score</span><strong>${record.score}</strong><small>${labelForScore(record.score)}</small></div>
          <div class="result-metrics"><div><span>Cost per use</span><strong>${money(metrics.perUse, record.currency || 'GBP')}</strong></div><div><span>Estimated total</span><strong>${money(metrics.total, record.currency || 'GBP')}</strong></div><div><span>Planned uses</span><strong>${Number(record.inputs.uses).toLocaleString('en-GB')}</strong></div><div><span>Enjoyment</span><strong>${record.inputs.joy}/10</strong></div></div>
          <div class="result-actions">${record.source_url ? `<a class="primary-button" href="${esc(record.source_url)}" target="_blank" rel="noopener noreferrer">View product ${icon('external')}</a>` : ''}${bought ? `<a class="secondary-button" href="owned.html?id=${encodeURIComponent(record.id)}">Update actual use</a>` : `<button class="secondary-button" id="markBought" type="button">I bought it</button>`}</div>
        </div>
      </div>
      <div class="analysis-grid"><section><p class="kicker">Stress test</p><h2>If the reality is less optimistic</h2><p>At half the expected usage and two points less enjoyment, this product would score <strong>${cautious.score}</strong>.</p></section><section><p class="kicker">Your assumptions</p><h2>${record.inputs.motive === 'need' ? 'Primarily useful' : record.inputs.motive === 'joy' ? 'Primarily for enjoyment' : 'Impulse or image led'}</h2><p>${record.inputs.alternative ? `Alternative considered: ${esc(record.inputs.alternative)}.` : 'No alternative was recorded.'}</p></section></div>
    </section>`, { kicker: 'Assessment result', action: `<a class="text-button" href="compare.html">Compare with another</a>` });
  if ($('markBought')) $('markBought').addEventListener('click', () => markPurchased(record));
}

async function markPurchased(record) {
  const button = $('markBought');
  button.disabled = true;
  try {
    if (user && supabaseClient) {
      const { error: trackingError } = await supabaseClient.from('purchase_tracking').insert({ assessment_id: record.id, user_id: user.id, actual_uses: 0 });
      if (trackingError) throw trackingError;
      const { error: assessmentError } = await supabaseClient.from('assessments').update({ status: 'purchased' }).eq('id', record.id);
      if (assessmentError) throw assessmentError;
    } else {
      purchases[record.id] = { assessment_id: record.id, purchased_at: new Date().toISOString(), actual_uses: 0, actual_joy: null };
      record.status = 'purchased';
      saveLocal();
    }
    location.href = `owned.html?id=${encodeURIComponent(record.id)}`;
  } catch (error) {
    console.error(error);
    button.disabled = false;
    button.textContent = 'Could not update';
  }
}

function savedPage() {
  const ranked = sortedRecords();
  const limitText = user && subscription.tier === 'free' ? `${records.length} of 10 saved on Free` : user ? 'Unlimited saved products' : `${records.length} saved on this device`;
  layout('Saved products', 'Search your product history and see your strongest matches first.', `
    <section class="library-toolbar"><label class="search-field">${icon('search')}<input id="librarySearch" type="search" placeholder="Search product, brand, retailer or link" autocomplete="off"></label><select id="librarySort" aria-label="Sort saved products"><option value="score">Best score</option><option value="newest">Newest</option><option value="price-low">Lowest price</option></select></section>
    <div class="library-meta"><span id="libraryCount">${records.length} products</span><span>${limitText}</span></div>
    <section class="section-block flush"><div id="productList" class="product-list">${ranked.length ? ranked.map((r, i) => productRow(r, i + 1)).join('') : `<div class="empty-state"><h3>Nothing saved yet</h3><p>Assess a product and it will appear here automatically.</p><a class="secondary-button" href="assess.html">Assess a product</a></div>`}</div></section>`, { kicker: 'Your product library', action: '<a class="primary-button small-button" href="assess.html">Add product</a>' });
  if (ranked.length) {
    $('librarySearch').addEventListener('input', renderLibrary);
    $('librarySort').addEventListener('change', renderLibrary);
  }
}

function renderLibrary() {
  const term = $('librarySearch').value.trim().toLowerCase();
  const sort = $('librarySort').value;
  let filtered = records.filter((r) => [r.title, r.brand, r.retailer, r.source_url].filter(Boolean).join(' ').toLowerCase().includes(term));
  if (sort === 'score') filtered.sort((a, b) => b.score - a.score);
  if (sort === 'newest') filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (sort === 'price-low') filtered.sort((a, b) => Number(a.observed_price ?? Infinity) - Number(b.observed_price ?? Infinity));
  $('productList').innerHTML = filtered.length ? filtered.map((r, i) => productRow(r, i + 1)).join('') : '<div class="empty-state"><h3>No matches</h3><p>Try another search term.</p></div>';
  $('libraryCount').textContent = `${filtered.length} product${filtered.length === 1 ? '' : 's'}`;
}

function comparePage() {
  if (records.length < 2) {
    layout('Compare products', 'See which purchase fits you better.', `<div class="empty-state"><h3>Save two products first</h3><p>Once you have two assessments, TruWorth can put them side by side.</p><a class="secondary-button" href="assess.html">Assess another product</a></div>`, { kicker: 'Comparison' });
    return;
  }
  const ranked = sortedRecords();
  layout('Compare products', 'Put two saved considerations side by side.', `<section class="compare-controls"><label class="field"><span>First product</span><select id="compareLeft">${ranked.map((r) => `<option value="${esc(r.id)}">${esc(r.title)}</option>`).join('')}</select></label><label class="field"><span>Second product</span><select id="compareRight">${ranked.map((r, i) => `<option value="${esc(r.id)}" ${i === 1 ? 'selected' : ''}>${esc(r.title)}</option>`).join('')}</select></label></section><div id="comparison"></div>`, { kicker: 'Comparison' });
  $('compareLeft').addEventListener('change', renderComparison);
  $('compareRight').addEventListener('change', renderComparison);
  renderComparison();
}

function renderComparison() {
  const left = records.find((r) => r.id === $('compareLeft').value);
  const right = records.find((r) => r.id === $('compareRight').value);
  if (!left || !right) return;
  const lm = score({ ...left.inputs, item: left.title });
  const rm = score({ ...right.inputs, item: right.title });
  $('comparison').innerHTML = `<section class="comparison-grid">${[ [left,lm], [right,rm] ].map(([r,m]) => `<article class="comparison-card">${productImage(r, 'compare')}<div class="comparison-title"><div><small>${esc(r.brand || r.retailer || 'Saved product')}</small><h2>${esc(r.title)}</h2></div>${scoreChip(r.score)}</div><dl><div><dt>Price</dt><dd>${money(r.observed_price, r.currency || 'GBP')}</dd></div><div><dt>Cost per use</dt><dd>${money(m.perUse, r.currency || 'GBP')}</dd></div><div><dt>Expected uses</dt><dd>${r.inputs.uses}</dd></div><div><dt>Enjoyment</dt><dd>${r.inputs.joy}/10</dd></div></dl><a class="text-button" href="result.html?id=${encodeURIComponent(r.id)}">Open assessment</a></article>`).join('')}</section>`;
}

function ownedPage() {
  const id = new URLSearchParams(location.search).get('id');
  const purchasedRecords = records.filter((r) => r.status === 'purchased' || purchases[r.id]);
  const current = id ? purchasedRecords.find((r) => r.id === id) : null;
  if (current) return ownedDetail(current);
  layout('Purchased', 'Track whether your purchases delivered the value you expected.', purchasedRecords.length ? `<div class="product-list">${sortedRecords(purchasedRecords).map((r, i) => productRow(r, i + 1)).join('')}</div>` : `<div class="empty-state"><h3>No purchased products yet</h3><p>Mark a saved consideration as purchased to start tracking real-world value.</p><a class="secondary-button" href="watchlist.html">View saved products</a></div>`, { kicker: 'Realised value' });
}

function ownedDetail(record) {
  const tracking = purchases[record.id] || { actual_uses: 0, actual_joy: null };
  layout(record.title, 'Update real usage to see how the purchase is performing.', `<section class="owned-detail"><div class="owned-summary">${productImage(record, 'hero')}<div><p class="kicker">Projected score</p><strong class="large-score">${record.score}</strong><p>${labelForScore(record.score)}</p></div></div><form id="checkinForm" class="checkin-form"><div class="form-grid two"><label class="field"><span>Total uses so far</span><input id="actualUses" type="number" min="0" step="1" required value="${Number(tracking.actual_uses || 0)}"></label><label class="field"><span>Enjoyment now</span><input id="actualJoy" type="number" min="1" max="10" step="0.5" value="${tracking.actual_joy || ''}" placeholder="1–10"></label></div><label class="field"><span>Optional note</span><textarea id="checkinNote" maxlength="1000" rows="3" placeholder="What changed since you bought it?"></textarea></label><p id="checkinStatus" class="form-message" role="status"></p><button class="primary-button" type="submit">Save update</button></form></section>`, { kicker: 'Purchased product' });
  $('checkinForm').addEventListener('submit', (e) => saveCheckin(e, record));
}

async function saveCheckin(event, record) {
  event.preventDefault();
  const uses = Number($('actualUses').value);
  const joy = $('actualJoy').value ? Number($('actualJoy').value) : null;
  const note = $('checkinNote').value.trim();
  const status = $('checkinStatus');
  try {
    if (user && supabaseClient) {
      const { error: updateError } = await supabaseClient.from('purchase_tracking').update({ actual_uses: uses, actual_joy: joy }).eq('assessment_id', record.id);
      if (updateError) throw updateError;
      const { error: checkinError } = await supabaseClient.from('checkins').insert({ user_id: user.id, assessment_id: record.id, actual_uses: uses, actual_joy: joy, note: note || null });
      if (checkinError) throw checkinError;
    } else {
      purchases[record.id] = { ...(purchases[record.id] || {}), assessment_id: record.id, actual_uses: uses, actual_joy: joy };
      saveLocal();
    }
    status.textContent = 'Update saved.';
    status.classList.add('success');
  } catch (error) {
    console.error(error);
    status.textContent = 'We could not save that update.';
    status.classList.add('error');
  }
}
