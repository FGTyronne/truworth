import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const app = read('app.js');
const appCss = read('app.css');
const popup = read('newsletter-v38.js');
const unsubscribePage = read('unsubscribe.html');
const unsubscribeJs = read('unsubscribe.js');
const subscribeFn = read('supabase/functions/newsletter-subscribe/index.ts');
const unsubscribeFn = read('supabase/functions/newsletter-unsubscribe/index.ts');
const config = read('supabase/config.toml');
const privacy = read('privacy.html');
const cookies = read('cookies.html');

const hasGlobalUnsubscribedFlag = (source, value) => new RegExp(`(?:^|[,{]\\s*)unsubscribed\\s*:\\s*${value}\\b`, 'm').test(source);

assert(app.includes("'newsletter-v38.js'"), 'Newsletter popup must be loaded by app.js.');
assert(appCss.includes('theme-v38.css'), 'Newsletter styles must be loaded by app.css.');
assert(/Our web address will change in the coming months/.test(popup), 'Popup must explain the upcoming domain change.');
assert(/new benefits, specials, news and useful updates/i.test(popup), 'Popup must explain what subscribers will receive.');
assert(/Occasional emails only\. Unsubscribe whenever you want\./.test(popup), 'Popup must clearly state unsubscribe availability.');
assert(/DISMISS_DAYS = 14/.test(popup), 'Dismissed newsletter popup must not reappear immediately.');
assert(/newsletter-subscribe/.test(popup), 'Popup must submit through the protected newsletter function.');

assert(/Confirm unsubscribe/.test(unsubscribePage), 'Unsubscribe page must require an explicit confirmation.');
assert(/name="reason"/.test(unsubscribePage), 'Unsubscribe page must collect an opt-out reason.');
assert(/Necessary account and transactional emails are separate/.test(unsubscribePage), 'Unsubscribe page must distinguish newsletter from transactional email.');
assert(/newsletter-unsubscribe/.test(unsubscribeJs), 'Unsubscribe page must call the newsletter unsubscribe function.');

assert(/newsletter_subscribers/.test(subscribeFn), 'Subscribe function must keep a backend consent record.');
assert(/newsletter_subscription_events/.test(subscribeFn), 'Subscribe function must keep an event ledger.');
assert(/unsubscribe_token/.test(subscribeFn), 'Subscribe function must create/sync a branded unsubscribe token.');
assert(/segments: \[\{ id: SEGMENT_ID \}\]/.test(subscribeFn), 'Subscribe function must add contacts to the newsletter segment.');
assert(/subscription: 'opt_in'/.test(subscribeFn), 'Subscribe function must explicitly opt contacts into the newsletter topic.');
assert(/company_website/.test(subscribeFn), 'Subscribe form must retain a honeypot field.');
assert(/SHORT_WINDOW_LIMIT/.test(subscribeFn) && /DAILY_LIMIT/.test(subscribeFn), 'Subscribe endpoint must retain abuse limits.');
assert(!hasGlobalUnsubscribedFlag(subscribeFn, 'false'), 'Newsletter subscription must not globally change a Resend contact suppression state.');

assert(/subscription: 'opt_out'/.test(unsubscribeFn), 'Unsubscribe function must opt the newsletter topic out.');
assert(/segments\.remove/.test(unsubscribeFn), 'Unsubscribe function must remove contacts from the newsletter segment.');
assert(!hasGlobalUnsubscribedFlag(unsubscribeFn, 'true'), 'Newsletter opt-out must not globally suppress unrelated Resend mailings.');
assert(/unsubscribe_reason/.test(unsubscribeFn), 'Unsubscribe function must store the selected reason.');
assert(/Account and transactional emails are unaffected/.test(unsubscribeFn), 'Unsubscribe response must distinguish transactional email.');

assert(/\[functions\.newsletter-subscribe\][\s\S]*verify_jwt = false/.test(config), 'Newsletter subscribe function must use custom public-form protection rather than JWT gating.');
assert(/\[functions\.newsletter-unsubscribe\][\s\S]*verify_jwt = false/.test(config), 'Newsletter unsubscribe function must be reachable from email links and authenticate with its token.');
assert(/Newsletter subscription/.test(privacy) && /unsubscribe at any time/.test(privacy), 'Privacy Notice must cover newsletter consent and unsubscribe rights.');
assert(/newsletter signup is a separate email-marketing choice|Newsletter subscription is separate/i.test(cookies), 'Cookie Policy must keep newsletter consent separate from cookie consent.');

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  console.error(`\n${failures.length} newsletter contract check(s) failed.`);
  process.exit(1);
}
console.log('Newsletter subscription and unsubscribe contract checks passed.');
