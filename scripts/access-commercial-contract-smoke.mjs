import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const guest = read('guest-access-v27.js');
assert(/GUEST_DAILY_LIMIT\s*=\s*3/.test(guest), 'Guest daily assessment limit must remain 3.');
assert(/FREE_SAVED_LIMIT\s*=\s*5/.test(guest), 'Free saved-product limit must remain 5.');
assert(/unlimited product assessments/i.test(guest), 'Free account copy must promise unlimited product assessments.');
assert(/temporary/i.test(guest) && /saved/i.test(guest), 'Free users at capacity must still receive a temporary assessment result.');

const freeMigration = read('supabase/migrations/20261014192406_free_saved_product_limit_five.sql');
assert(/stored_count\s*>=\s*5/.test(freeMigration), 'Database Free save cap must remain 5.');
assert(/before insert on public\.assessments/i.test(freeMigration), 'Free save cap must be enforced before assessment insert.');

const quota = read('supabase/functions/guest-assessment-quota/index.ts');
assert(/const LIMIT\s*=\s*3/.test(quota), 'Guest quota Edge Function must remain at 3.');
assert(/HMAC/.test(quota) && /SHA-256/.test(quota), 'Guest quota must derive a keyed hash rather than persist raw IP data.');
assert(/consume_guest_assessment/.test(quota), 'Guest quota must use the atomic database RPC.');

const decision = read('supabase/functions/purchase-vote/index.ts');
assert(/tier==='plus'|tier\s*===\s*'plus'/.test(decision), 'Formal personalised recommendation must remain Plus-gated.');
assert(/requires_price/.test(decision), 'Formal recommendation must block missing price.');
assert(/requires_currency_confirmation/.test(decision), 'Formal recommendation must block currency mismatch.');
assert(/BUY/.test(decision) && /WAIT/.test(decision) && /SKIP/.test(decision), 'Formal recommendation outcomes must remain explicit.');

const importer = read('supabase/functions/import-product/index.ts');
for (const priceType of ['exact','starting','sale','monthly','unknown']) {
  assert(importer.includes(`'${priceType}'`), `Importer must retain ${priceType} price classification.`);
}
assert(/validatePublicUrl/.test(importer) && /Private network URLs are not supported/.test(importer), 'Importer must retain SSRF/private-network protection.');
assert(/MAX_BYTES/.test(importer) && /MAX_REDIRECTS/.test(importer), 'Importer must keep response-size and redirect limits.');

const adspace = read('adspace-v26.js');
assert(/isPlus\(\)/.test(adspace) && /removeSlots\(\)/.test(adspace), 'TruWorth+ must remain ad-free.');
assert(/settings','account','plans','assess/.test(adspace), 'Ads must remain excluded from settings, account, plans and assess pages.');
assert(/insertAdjacentHTML\('afterend'/.test(adspace), 'Result/compare commercial placement must remain after the decision surface.');

const commercial = read('commercial-v32.js');
assert(/allows\?\.\('marketing'\)/.test(commercial), 'Commercial event measurement must require marketing consent.');
assert(/commercial relationships never affect truworth scores or recommendations/i.test(commercial), 'Commercial content must preserve recommendation-independence disclosure.');
assert(/isPlus\(\)/.test(commercial), 'Commercial campaign hydration must not run for Plus users.');

const partner = read('supabase/functions/partner-enquiry/index.ts');
assert(/company_fax/.test(partner), 'Partner enquiry must retain honeypot protection.');
assert(/since15/.test(partner) && /since24/.test(partner), 'Partner enquiry must retain short-window and daily rate limits.');
assert(/HMAC/.test(partner) && /ip_hash/.test(partner), 'Partner enquiry abuse controls must not require storing raw IP addresses.');

const privacy = read('privacy.html');
assert(/Guest quota information/i.test(privacy), 'Privacy notice must describe guest quota information.');
assert(/Partnership enquiries/i.test(privacy), 'Privacy notice must describe partnership enquiry processing.');
assert(/Optional analytics\/marketing/i.test(privacy), 'Privacy notice must describe optional commercial measurement.');
assert(/Commercial &amp; Affiliate Disclosure/i.test(privacy), 'Privacy notice must link the commercial disclosure.');

const config = read('supabase/config.toml');
assert(/\[functions\.guest-assessment-quota\][\s\S]*?verify_jwt\s*=\s*false/.test(config), 'Guest quota must remain callable without an account.');
assert(/\[functions\.partner-enquiry\][\s\S]*?verify_jwt\s*=\s*false/.test(config), 'Partner enquiry must remain callable without an account.');
assert(/\[functions\.commercial-content\][\s\S]*?verify_jwt\s*=\s*false/.test(config), 'Commercial content must remain available to guests.');
assert(/\[functions\.commercial-event\][\s\S]*?verify_jwt\s*=\s*false/.test(config), 'Consent-gated commercial measurement must remain available to guests.');
assert(/\[functions\.purchase-vote\][\s\S]*?verify_jwt\s*=\s*true/.test(config), 'Purchase-vote must remain JWT-protected.');
assert(/\[functions\.stripe-checkout\][\s\S]*?verify_jwt\s*=\s*true/.test(config), 'Stripe checkout must remain JWT-protected.');

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  console.error(`\n${failures.length} access/commercial contract check(s) failed.`);
  process.exit(1);
}
console.log('Access, recommendation, importer and commercial contract checks passed.');
