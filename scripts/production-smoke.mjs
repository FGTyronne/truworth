const BASE = 'https://truworth-web.onrender.com';
const EXPECTED_SHA = process.env.EXPECTED_SHA || '';
const failures = [];
const warnings = [];

async function fetchChecked(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${BASE}${path}`, { redirect: 'follow', signal: controller.signal, ...options });
    return response;
  } catch (error) {
    failures.push(`${path}: request failed (${error instanceof Error ? error.message : String(error)})`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function html(path, expectedText) {
  const response = await fetchChecked(path);
  if (!response) return;
  if (!response.ok) { failures.push(`${path}: HTTP ${response.status}`); return; }
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) failures.push(`${path}: expected text/html, got ${type || 'no content-type'}`);
  const body = await response.text();
  if (expectedText && !body.includes(expectedText)) failures.push(`${path}: expected marker not found: ${expectedText}`);
  if (/truworth\.vercel\.app/i.test(body)) failures.push(`${path}: legacy Vercel production URL found in live HTML`);
}

await Promise.all([
  html('/', 'TruWorth'),
  html('/assess.html', 'TruWorth'),
  html('/plans.html', 'TruWorth'),
  html('/privacy.html', 'Privacy Notice'),
  html('/terms.html', 'Terms'),
  html('/cookies.html', 'Cookie'),
  html('/security.html', 'Security'),
  html('/decision-support.html', 'TruWorth'),
  html('/partner-with-truworth.html', 'Partner with TruWorth'),
  html('/commercial-disclosure.html', 'Commercial'),
  html('/member-benefits.html', 'TruWorth')
]);

for (const asset of ['/app.js', '/app.css', '/favicon.svg', '/robots.txt', '/sitemap.xml', '/security.txt', '/.well-known/security.txt']) {
  const response = await fetchChecked(asset);
  if (response && !response.ok) failures.push(`${asset}: HTTP ${response.status}`);
}

const release = await fetchChecked('/release.txt', { cache: 'no-store' });
if (release?.ok) {
  const liveSha = (await release.text()).trim();
  if (!/^[0-9a-f]{40}$/i.test(liveSha)) failures.push(`release.txt: invalid commit marker ${JSON.stringify(liveSha)}`);
  if (EXPECTED_SHA && liveSha !== EXPECTED_SHA) failures.push(`production drift: Render=${liveSha}, expected=${EXPECTED_SHA}`);
} else if (release) failures.push(`/release.txt: HTTP ${release.status}`);

const robots = await fetchChecked('/robots.txt');
if (robots?.ok) {
  const text = await robots.text();
  if (!text.includes(`${BASE}/sitemap.xml`)) failures.push('robots.txt: production sitemap declaration missing');
}

const standardSecurity = await fetchChecked('/.well-known/security.txt');
if (standardSecurity?.ok) {
  const text = await standardSecurity.text();
  if (!text.includes(`Canonical: ${BASE}/.well-known/security.txt`)) failures.push('.well-known/security.txt: canonical is incorrect');
  if (!text.includes('Contact: mailto:')) warnings.push('.well-known/security.txt: no mailto contact found');
}

for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  console.error(`\n${failures.length} production smoke check(s) failed.`);
  process.exit(1);
}
console.log(`Production smoke passed for ${EXPECTED_SHA || 'current live release'}.`);
