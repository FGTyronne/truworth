import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const warnings = [];
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const rootFiles = fs.readdirSync(root, { withFileTypes: true }).filter((x) => x.isFile()).map((x) => x.name);
const htmlFiles = rootFiles.filter((x) => x.endsWith('.html'));

function fail(message) { failures.push(message); }
function warn(message) { warnings.push(message); }
function cleanLocalRef(ref) {
  if (!ref || /^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(ref)) return null;
  const clean = ref.split('#')[0].split('?')[0].replace(/^\.\//, '').replace(/^\//, '');
  if (!clean || clean.includes('${') || clean.includes('<%')) return null;
  return decodeURIComponent(clean);
}

for (const file of htmlFiles) {
  const text = read(file);
  const refs = [...text.matchAll(/(?:href|src)=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const ref of refs) {
    const local = cleanLocalRef(ref);
    if (!local) continue;
    if (!exists(local)) fail(`${file}: missing local reference ${ref}`);
  }

  const canonical = text.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
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
  const scripts = [...block.matchAll(/["']([^"']+\.js)["']/g)].map((m) => m[1]);
  if (!scripts.length) fail('app.js: could not resolve release script list');
  for (const script of scripts) if (!exists(script)) fail(`app.js: release script missing: ${script}`);
} else fail('app.js is missing');

if (exists('sitemap.xml')) {
  const sitemap = read('sitemap.xml');
  if (/truworth\.vercel\.app/i.test(sitemap)) fail('sitemap.xml contains legacy Vercel URL');
  const locs = [...sitemap.matchAll(/<loc>https:\/\/truworth-web\.onrender\.com\/?([^<]*)<\/loc>/g)].map((m) => m[1]);
  if (!locs.length) fail('sitemap.xml contains no Render production URLs');
  for (const loc of locs) {
    const local = (loc || '').split('?')[0].split('#')[0];
    if (local && !exists(local)) fail(`sitemap.xml: URL target missing from repo: ${local}`);
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

const legacyLimitFiles = ['account-v2.js','billing-v15.js','release-v6.js','library-v2.js'].filter(exists);
for (const file of legacyLimitFiles) {
  const text = read(file);
  if (/of 10 products saved|Save up to 10 products|of 10 saved on Free/i.test(text)) warn(`${file}: still contains superseded 10-product Free copy; final v27 overrides it, but source should be normalised`);
}

console.log(`Checked ${htmlFiles.length} root HTML pages.`);
for (const message of warnings) console.warn(`WARN: ${message}`);
if (failures.length) {
  for (const message of failures) console.error(`FAIL: ${message}`);
  console.error(`\n${failures.length} static launch check(s) failed.`);
  process.exit(1);
}
console.log(`Static launch smoke checks passed${warnings.length ? ` with ${warnings.length} warning(s)` : ''}.`);
