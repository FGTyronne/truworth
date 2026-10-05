'use strict';

const SCORE_VERSION = 'truworth-v1.1';
const LOCAL_KEY = 'truworth_guest_v1';
const SUPABASE_URL = 'https://npfdkbqjoxolxxtmprmr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0Sohm-jtjfxMQ8fpM3zsAg_iF7oF1fo';
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js';

let supabaseClient = null;
let user = null;
let subscription = { tier: 'free', status: 'active' };
let records = [];
let purchases = {};
let local = loadLocal();
let authRecovery = false;

const $ = (id) => document.getElementById(id);
const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = (value, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
const dateText = (value) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const page = () => document.body.dataset.page || 'home';

function loadLocal() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      owned: parsed.owned && typeof parsed.owned === 'object' ? parsed.owned : {},
      settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : { motion: true }
    };
  } catch {
    return { records: [], owned: {}, settings: { motion: true } };
  }
}

function saveLocal() {
  local.records = records;
  local.owned = purchases;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
}

function icon(name) {
  const icons = {
    home: '<path d="M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5z"/><path d="M9 21v-7h6v7"/>',
    assess: '<path d="M12 3v18M3 12h18"/>',
    saved: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21l-7-4-7 4z"/>',
    compare: '<path d="M8 6h12M16 2l4 4-4 4M16 18H4M8 14l-4 4 4 4"/>',
    insights: '<path d="M4 20V10m6 10V4m6 16v-7m4 7V7"/>',
    owned: '<path d="m4 12 5 5L20 6"/>',
    account: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4.1 3.4-6 8-6s7.3 1.9 8 6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2.8 2.8-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.6V21h-4v-.1A1.8 1.8 0 0 0 8.8 19a1.8 1.8 0 0 0-2 .4l-.1.1-2.8-2.8.1-.1a1.8 1.8 0 0 0 .4-2A1.8 1.8 0 0 0 2.8 13H2v-4h.8a1.8 1.8 0 0 0 1.6-1.1 1.8 1.8 0 0 0-.4-2l-.1-.1L6.7 3l.1.1a1.8 1.8 0 0 0 2 .4A1.8 1.8 0 0 0 9.9 2H14v.1A1.8 1.8 0 0 0 15.1 4a1.8 1.8 0 0 0 2-.4l.1-.1L20 6.3l-.1.1a1.8 1.8 0 0 0-.4 2A1.8 1.8 0 0 0 21.2 10h.8v4h-.8a1.8 1.8 0 0 0-1.8 1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>'
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;
}

function score(input) {
  const price = Number(input.price || 0);
  const upkeep = Number(input.upkeep || 0);
  const uses = Number(input.uses || 0);
  const effort = Number(input.effort || 0);
  const joy = Number(input.joy || 0);
  const minutes = Number(input.minutes || 0);
  const hourValue = Number(input.hourValue || 0);
  if (!String(input.item || '').trim() || ![price, upkeep, uses, effort, joy, minutes, hourValue].every(Number.isFinite) || price < 0 || upkeep < 0 || uses < 1 || !Number.isInteger(uses) || effort < 0 || joy < 1 || joy > 10 || minutes < 0 || hourValue < 0 || !['need', 'joy', 'image'].includes(input.motive)) {
    throw new Error('Check the highlighted assumptions and try again.');
  }
  const total = price + upkeep;
  const perUse = total / uses;
  const friction = Math.max(0.25, effort);
  const valueIndex = uses * joy / friction;
  const timeValue = uses * minutes / 60 * hourValue;
  let value = Math.round(
    Math.min(26, Math.log2(uses + 1) * 3.9) +
    joy / 10 * 24 +
    25 / (1 + perUse / 18) +
    15 / (1 + effort / Math.max(1, uses) * 3) +
    Math.min(10, (minutes / 60 * hourValue) / 12 * 10) -
    (input.motive === 'image' ? 12 : 0)
  );
  value = Math.max(0, Math.min(100, value));
  return { score: value, total, perUse, valueIndex, timeValue, version: SCORE_VERSION };
}

function labelForScore(value) {
  if (value >= 80) return 'Excellent fit';
  if (value >= 68) return 'Strong fit';
  if (value >= 55) return 'Promising';
  if (value >= 42) return 'Think it through';
  return 'Low fit';
}

function normaliseGuestRecord(record) {
  if (record.title) return record;
  const s = record.scoreSnapshot || score(record.inputs || {});
  return {
    id: record.id,
    created_at: record.created || new Date().toISOString(),
    title: record.inputs?.item || 'Untitled product',
    brand: record.inputs?.brand || '',
    retailer: record.inputs?.retailer || '',
    source_url: record.inputs?.source_url || '',
    canonical_url: record.inputs?.canonical_url || '',
    image_url: record.inputs?.image_url || '',
    observed_price: Number(record.inputs?.price || 0),
    currency: record.inputs?.currency || 'GBP',
    score: Number(s.score || 0),
    score_version: s.version || SCORE_VERSION,
    inputs: record.inputs || {},
    status: purchases[record.id] ? 'purchased' : 'considering'
  };
}

async function loadSupabase() {
  if (window.supabase?.createClient) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SUPABASE_JS;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function initBackend() {
  try {
    await loadSupabase();
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    supabaseClient.auth.onAuthStateChange((event) => {
      authRecovery = event === 'PASSWORD_RECOVERY';
    });
    const { data } = await supabaseClient.auth.getSession();
    user = data.session?.user || null;
    if (user) await loadCloudData();
    else loadGuestData();
  } catch (error) {
    console.error('Backend unavailable', error);
    loadGuestData();
  }
}

function loadGuestData() {
  purchases = local.owned || {};
  records = (local.records || []).map(normaliseGuestRecord);
}

async function loadCloudData() {
  const [assessmentResult, purchaseResult, subscriptionResult] = await Promise.all([
    supabaseClient.from('assessments').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('purchase_tracking').select('*'),
    supabaseClient.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle()
  ]);
  if (assessmentResult.error) throw assessmentResult.error;
  if (purchaseResult.error) throw purchaseResult.error;
  records = assessmentResult.data || [];
  purchases = Object.fromEntries((purchaseResult.data || []).map((item) => [item.assessment_id, item]));
  if (subscriptionResult.data) subscription = subscriptionResult.data;
}

function navItems() {
  return [
    ['home', 'Home', 'index.html', 'home'],
    ['assess', 'Assess', 'assess.html', 'assess'],
    ['saved', 'Saved', 'watchlist.html', 'saved'],
    ['compare', 'Compare', 'compare.html', 'compare'],
    ['insights', 'Insights', 'insights.html', 'insights']
  ];
}

function layout(title, subtitle, body, options = {}) {
  const current = page() === 'watchlist' ? 'saved' : page();
  const accountLabel = user ? 'Account' : 'Sign in';
  document.body.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <a class="wordmark" href="index.html" aria-label="TruWorth home">TruWorth</a>
        <nav class="top-nav" aria-label="Primary navigation">
          ${navItems().map(([key, label, href]) => `<a class="${current === key ? 'active' : ''}" href="${href}" ${current === key ? 'aria-current="page"' : ''}>${label}</a>`).join('')}
        </nav>
        <a class="account-link ${page() === 'account' ? 'active' : ''}" href="account.html">${icon('account')}<span>${accountLabel}</span></a>
      </header>

      <main class="main-content" id="main-content">
        ${options.compact ? '' : `<section class="page-intro"><div><p class="kicker">${esc(options.kicker || 'TruWorth')}</p><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${options.action || ''}</section>`}
        ${body}
      </main>

      <footer class="site-footer"><a href="settings.html">Privacy & settings</a><a href="plans.html">Membership</a></footer>
    </div>
    <nav class="bottom-nav" aria-label="Mobile navigation">
      ${[
        ['home','Home','index.html','home'],
        ['assess','Assess','assess.html','assess'],
        ['saved','Saved','watchlist.html','saved'],
        ['owned','Owned','owned.html','owned'],
        ['account','Account','account.html','account']
      ].map(([key,label,href,iconName]) => `<a class="${current === key ? 'active' : ''}" href="${href}" ${current === key ? 'aria-current="page"' : ''}>${icon(iconName)}<span>${label}</span></a>`).join('')}
    </nav>`;
  applyMotionPreference();
}

function applyMotionPreference() {
  const reduced = local.settings?.motion === false || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.toggle('reduce-motion', reduced);
}

function productImage(record, size = 'large') {
  const title = esc(record.title || 'Product');
  if (record.image_url) return `<img class="product-image ${size}" src="${esc(record.image_url)}" alt="${title}" loading="lazy" referrerpolicy="no-referrer">`;
  const initial = esc((record.title || 'T').trim().charAt(0).toUpperCase());
  return `<div class="product-image placeholder ${size}" aria-hidden="true"><span>${initial}</span></div>`;
}

function scoreChip(value) {
  return `<span class="score-chip"><strong>${Number(value)}</strong><span>${labelForScore(Number(value))}</span></span>`;
}

function productRow(record, rank) {
  const price = record.observed_price != null ? money(record.observed_price, record.currency || 'GBP') : '';
  const meta = [record.brand, record.retailer, price].filter(Boolean).map(esc).join(' · ');
  return `<article class="product-row" data-search="${esc([record.title, record.brand, record.retailer, record.source_url].filter(Boolean).join(' ').toLowerCase())}" data-score="${record.score}" data-created="${new Date(record.created_at).getTime()}">
    <a class="product-row-main" href="result.html?id=${encodeURIComponent(record.id)}">
      <span class="rank">${rank}</span>
      ${productImage(record, 'thumb')}
      <span class="product-copy"><strong>${esc(record.title)}</strong><small>${meta || `Saved ${dateText(record.created_at)}`}</small></span>
      ${scoreChip(record.score)}
    </a>
    ${record.source_url ? `<a class="source-link" href="${esc(record.source_url)}" target="_blank" rel="noopener noreferrer" aria-label="Open retailer link">${icon('external')}</a>` : ''}
  </article>`;
}

function sortedRecords(source = records) {
  return [...source].sort((a, b) => Number(b.score) - Number(a.score) || new Date(b.created_at) - new Date(a.created_at));
}

function summaryStrip() {
  const top = sortedRecords()[0];
  const considering = records.filter((r) => r.status === 'considering').length;
  const purchased = records.filter((r) => r.status === 'purchased').length;
  return `<div class="summary-strip">
    <div><span>Saved</span><strong>${records.length}</strong></div>
    <div><span>Considering</span><strong>${considering}</strong></div>
    <div><span>Purchased</span><strong>${purchased}</strong></div>
    <div><span>Top score</span><strong>${top ? top.score : '—'}</strong></div>
  </div>`;
}
