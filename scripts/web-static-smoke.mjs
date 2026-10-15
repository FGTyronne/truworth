import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const warnings = [];
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const rootFiles = fs.readdirSync(root, { withFileTypes: true }).filter((x) => x.isFile()).map((x) => x.name);
const htmlFiles = rootFiles.filter((x) => x.endsWith('.html'));
let releaseScripts = [];

function fail(message) { failures.push(message); }
function warn(message) { warnings.push(message); }
function cleanLocalRef(ref) {
  if (!ref || /^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(ref)) return null;
  const clean = ref.split('#')[0].split('?')[0].replace(/^\.\//, '').replace(/^\//, '');
  if (!clean || clean.includes('${') || clean.includes('<%')) return null;
  return decodeURIComponent(clean);
}
function canonicalFrom(text) {
  return text.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1]
    || text.match(/<link\s+href=["']([^"']+)["']\s+rel=["']canonical["']/i)?.[1]
    || null;
}

for (const file of htmlFiles) {
  const text = read(file);
  const refs = [...text.matchAll(/(?:href|src)=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const ref of refs) {
    const local = cleanLocalRef(ref);
    if (!local) continue;
    if (!exists(local)) fail(`${file}: missing local reference ${ref}`);
  }

  const canonical = canonicalFrom(text);
  if (canonical && !canonical.startsWith('https://truworth-web.onrender.com/')) {
    fail(`${file}: canonical is not on the Render production host: ${canonical}`);
  }
  if (/truworth\.vercel\.app/i.test(text)) fail(`${file}: contains legacy Vercel public URL`);
  if (/href=["']benefits\.html/i.test(text)) fail(`${file}: references removed benefits.html instead of member-benefits.html`);
}

const privatePages = ['account.html','auth.html','admin-vouchers.html','result.html','settings.html','watchlist.html','owned.html','insights.html','compare.html','member-benefits.html'];
for (const file of privatePages) {
  if (!exists(file)) { fail(`Expected private page missing: ${file}`); continue; }
  const text = read(file);
  if (!/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(text)) {
    fail(`${file}: private/app page is missing a noindex robots directive`);
  }
}

if (exists('account.html')) {
  const accountHtml = read('account.html');
  if (!/src=["']auth-overrides\.js(?:\?[^"']*)?["']/i.test(accountHtml)) fail('account.html: auth-overrides.js safety layer is not loaded');
}
if (exists('account-v2.js')) {
  const accountSource = read('account-v2.js');
  if (!/emailRedirectTo:\s*`\$\{location\.origin\}\/auth\.html`/i.test(accountSource)) fail('account-v2.js: signup does not target the hardened auth callback');
  if (!/resetPasswordForEmail\([\s\S]*?redirectTo:\s*`\$\{location\.origin\}\/auth\.html`/i.test(accountSource)) fail('account-v2.js: password reset does not target the hardened auth callback');
}
if (exists('auth-overrides.js') && !/AUTH_REDIRECT\s*=\s*`\$\{location\.origin\}\/auth\.html`/i.test(read('auth-overrides.js'))) {
  fail('auth-overrides.js: callback target is not /auth.html');
}

if (exists('app.css')) {
  const css = read('app.css');
  for (const match of css.matchAll(/@import\s+url\(["']?([^"')]+)["']?\)/gi)) {
    const local = cleanLocalRef(match[1]);
    if (local && !exists(local)) fail(`app.css: missing imported stylesheet ${match[1]}`);
  }
} else fail('app.css is missing');

if (exists('app.js')) {
  const app = read('app.js');
  const block = app.match(/const\s+files\s*=\s*\[([\s\S]*?)\];/m)?.[1] || '';
  releaseScripts = [...block.matchAll(/["']([^"']+\.js)["']/g)].map((m) => m[1]);
  if (!releaseScripts.length) fail('app.js: could not resolve release script list');
  for (const script of releaseScripts) if (!exists(script)) fail(`app.js: release script missing: ${script}`);
} else fail('app.js is missing');

const shippedBrowserScripts = [...new Set([...releaseScripts, 'app.js', 'auth-callback.js', 'auth-overrides.js'].filter(exists))];
for (const file of shippedBrowserScripts) {
  if (/truworth\.vercel\.app/i.test(read(file))) fail(`${file}: shipped browser script contains legacy Vercel production URL`);
}

if (exists('sitemap.xml')) {
  const sitemap = read('sitemap.xml');
  if (/truworth\.vercel\.app/i.test(sitemap)) fail('sitemap.xml contains legacy Vercel URL');
  const urls = [...sitemap.matchAll(/<loc>(https:\/\/truworth-web\.onrender\.com\/?([^<]*))<\/loc>/g)].map((m) => ({ url: m[1], path: m[2] || '' }));
  if (!urls.length) fail('sitemap.xml contains no Render production URLs');
  for (const entry of urls) {
    const localPath = entry.path.split('?')[0].split('#')[0];
    const file = localPath || 'index.html';
    if (!exists(file)) {
      fail(`sitemap.xml: URL target missing from repo: ${file}`);
      continue;
    }
    if (!file.endsWith('.html')) continue;
    const canonical = canonicalFrom(read(file));
    if (!canonical) fail(`${file}: sitemap page is missing a canonical URL`);
    else if (canonical !== entry.url) fail(`${file}: canonical ${canonical} does not match sitemap URL ${entry.url}`);
  }
} else fail('sitemap.xml is missing');

if (exists('robots.txt')) {
  const robots = read('robots.txt');
  if (!/Sitemap:\s*https:\/\/truworth-web\.onrender\.com\/sitemap\.xml/i.test(robots)) fail('robots.txt: production sitemap declaration is missing');
  if (/truworth\.vercel\.app/i.test(robots)) fail('robots.txt contains legacy Vercel URL');
} else fail('robots.txt is missing');

for (const securityPath of ['security.txt', '.well-known/security.txt']) {
  if (!exists(securityPath)) { fail(`${securityPath} is missing`); continue; }
  const text = read(securityPath);
  if (!/Canonical:\s*https:\/\/truworth-web\.onrender\.com\//i.test(text)) fail(`${securityPath}: missing Render canonical`);
  if (/truworth\.vercel\.app/i.test(text)) fail(`${securityPath}: contains legacy Vercel URL`);
}

const legacyLimitPattern = /of\s+10\s+products?\s+saved|save\s+up\s+to\s+10\s+(?:products?|assessments?)|of\s+10\s+saved\s+on\s+free|10-product\s+free\s+limit/i;
for (const file of releaseScripts.filter(exists)) {
  const text = read(file);
  if (legacyLimitPattern.test(text)) fail(`${file}: contains superseded 10-product Free entitlement copy`);
}

if (exists('storage-v21.js')) {
  const storageSource = read('storage-v21.js');
  if (/slice\(0,\s*10\)/.test(storageSource)) fail('storage-v21.js: guest-to-account migration can exceed the current five-product Free capacity');
  if (!/localStorage\.removeItem\(key\)/.test(storageSource)) fail('storage-v21.js: legacy persistent guest state is not explicitly removed');
}
if (exists('guest-access-v27.js')) {
  const guestAccess = read('guest-access-v27.js');
  if (/localStorage\.setItem\(\s*LOCAL_KEY/.test(guestAccess)) fail('guest-access-v27.js: guest state must remain session-only after account migration');
  if (!/sessionStorage\.setItem\(\s*LOCAL_KEY/.test(guestAccess)) fail('guest-access-v27.js: cleared guest state is not written back to session storage after account migration');
  if (!/FREE_SAVED_LIMIT\s*=\s*5/.test(guestAccess)) fail('guest-access-v27.js: Free saved-product limit drifted from five');
  if (!/GUEST_DAILY_LIMIT\s*=\s*3/.test(guestAccess)) fail('guest-access-v27.js: guest daily assessment limit drifted from three');
}
if (exists('privacy.html')) {
  const privacy = read('privacy.html');
  if (!/one-way keyed hash/i.test(privacy) || !/raw IP address/i.test(privacy)) fail('privacy.html: guest quota hashing disclosure is missing or incomplete');
}
if (exists('cookies.html')) {
  const cookies = read('cookies.html');
  if (!/Temporary TruWorth guest storage/i.test(cookies) || !/session storage/i.test(cookies)) fail('cookies.html: current session-only guest storage is not described');
}

const activeFunctionSources = [
  'supabase/functions/stripe-checkout/index.ts',
  'supabase/functions/stripe-portal/index.ts',
  'supabase/functions/purchase-vote/index.ts',
  'supabase/functions/buyer-insights/index.ts',
  'supabase/functions/delete-account/index.ts',
  'supabase/functions/trial-action/index.ts',
  'supabase/functions/import-product/index.ts',
  'supabase/functions/lifecycle-email/index.ts',
].filter(exists);
for (const file of activeFunctionSources) {
  if (/truworth\.vercel\.app/i.test(read(file))) fail(`${file}: active function source contains legacy Vercel production URL`);
}

console.log(`Checked ${htmlFiles.length} root HTML pages.`);
for (const message of warnings) console.warn(`WARN: ${message}`);
if (failures.length) {
  for (const message of failures) console.error(`FAIL: ${message}`);
  console.error(`\n${failures.length} static launch check(s) failed.`);
  process.exit(1);
}
console.log(`Static launch smoke checks passed${warnings.length ? ` with ${warnings.length} warning(s)` : ''}.`);
