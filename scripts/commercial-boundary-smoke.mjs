import fs from 'node:fs';

const failures = [];
const read = (file) => fs.readFileSync(file, 'utf8');
const expect = (condition, message) => { if (!condition) failures.push(message); };

const partnerPage = read('partner-with-truworth.html');
const partnerClient = read('partner-enquiry.js');
const partnerFunction = read('supabase/functions/partner-enquiry/index.ts');
const commercialClient = read('commercial-v32.js');
const commercialContent = read('supabase/functions/commercial-content/index.ts');
const commercialEvent = read('supabase/functions/commercial-event/index.ts');
const purchaseVote = read('supabase/functions/purchase-vote/index.ts');
const decisionEngine = read('decision-engine-v24.js');
const config = read('supabase/config.toml');
const migration = read('supabase/migrations/20261015124901_partner_commercial_infrastructure.sql');

expect(/id=["']partnerEnquiryForm["']/.test(partnerPage), 'Partner page is missing the structured enquiry form.');
expect(/partner-enquiry\.js/.test(partnerPage), 'Partner page is not loading the enquiry client.');
expect(/privacy_acknowledged/.test(partnerPage) && /privacy\.html/.test(partnerPage), 'Partner form is missing the privacy acknowledgement.');
expect(/company_fax/.test(partnerPage) && /company_fax/.test(partnerFunction), 'Partner form honeypot is not wired end-to-end.');
expect(/15\*60\*1000/.test(partnerFunction) && /24\*60\*60\*1000/.test(partnerFunction), 'Partner enquiry rate limiting is missing.');
expect(/HMAC/.test(partnerFunction) && /ip_hash/.test(partnerFunction), 'Partner enquiry anti-abuse hashing is missing.');
expect(!/SUPABASE_SERVICE_ROLE_KEY/.test(partnerClient), 'Partner browser client must not contain service-role credentials.');

expect(/TruWorthConsent\?\.allows\?\.\('marketing'\)/.test(commercialClient), 'Commercial measurement is not gated by marketing consent.');
expect(/commercial-content/.test(commercialClient) && /commercial-event/.test(commercialClient), 'Commercial browser layer is not using the controlled APIs.');
expect(/Commercial relationships never affect TruWorth scores or recommendations/.test(commercialClient), 'Commercial disclosure was removed from campaign rendering.');

for (const [name, source] of [['purchase-vote', purchaseVote], ['decision-engine', decisionEngine]]) {
  expect(!/ad_campaigns|ad_events|partner_relationships|member_benefits|commercial-content|commercial-event/i.test(source), `${name} must remain isolated from commercial tables and APIs.`);
}
for (const [name, source] of [['commercial-content', commercialContent], ['commercial-event', commercialEvent]]) {
  expect(!/financial_profiles|decision_profile|purchase-vote|buyer-insights/i.test(source), `${name} must not read personalised recommendation data.`);
}

expect(/\[functions\.partner-enquiry\][\s\S]*?verify_jwt\s*=\s*false/.test(config), 'partner-enquiry function configuration is missing.');
expect(/\[functions\.commercial-content\][\s\S]*?verify_jwt\s*=\s*false/.test(config), 'commercial-content function configuration is missing.');
expect(/\[functions\.commercial-event\][\s\S]*?verify_jwt\s*=\s*false/.test(config), 'commercial-event function configuration is missing.');

for (const table of ['partner_enquiries','partner_relationships','member_benefits','ad_campaigns','ad_events']) {
  expect(new RegExp(`alter table public\\.${table} enable row level security`, 'i').test(migration), `${table} is missing RLS enablement in the canonical migration.`);
}
expect(/revoke all on table public\.partner_enquiries from anon, authenticated/i.test(migration), 'Partner enquiries are not explicitly revoked from normal client roles.');
expect(/revoke all on table public\.ad_campaigns from anon, authenticated/i.test(migration), 'Campaign table is not explicitly revoked from normal client roles.');
expect(!/insert\s+into\s+public\.ad_campaigns/i.test(migration), 'Canonical migration must not seed a live commercial campaign.');

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  console.error(`\n${failures.length} commercial boundary check(s) failed.`);
  process.exit(1);
}
console.log('Commercial boundary checks passed.');
