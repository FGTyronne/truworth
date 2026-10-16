import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const experience = read('experience-v23.js');
const insights = read('insights-benefits-v36.js');
const benefits = read('benefits-v37.js');
const app = read('app.js');
const disclosure = read('commercial-disclosure.html');

assert(/Check if it’s worth it for you/i.test(experience), 'Homepage must keep the core worth-it-for-you promise.');
assert(/Check before you buy/.test(experience), 'Homepage must show the check-before-buying step.');
assert(/Record what you did/.test(experience), 'Homepage must connect decisions to real outcomes.');
assert(/See your patterns/.test(experience), 'Homepage must show the longer-term value of history.');
assert(/One check helps now\. Your history helps next time\./.test(experience), 'Homepage must explain why repeated use becomes more valuable.');
assert(!/Wants Me|Real Buyer Me|Wants Self|Real Buyer/i.test(experience), 'Homepage value proposition must not use persona jargon.');
assert(!/MutationObserver/.test(experience), 'Value proposition layer must not use a whole-page MutationObserver.');

for (const signal of ['How often you buy','What gets your attention','Do stronger scores win?','Reality check','Did it live up to expectations?','Financial fit']) {
  assert(insights.includes(signal), `Insights must retain the ${signal} signal.`);
}
assert(/Your purchase history should make the next decision easier/.test(insights), 'Insights must connect history to the next purchase.');
assert(/Just getting started/.test(insights) && /Strong history/.test(insights), 'Insights must qualify how much history exists.');
assert(/actual_joy/.test(insights), 'Insights must use post-purchase enjoyment when available.');
assert(/financial_profiles/.test(insights), 'Plus Insights must use the financial profile for money context.');
assert(!/Decision intelligence|No personality theatre|The insight worth coming back for/i.test(insights), 'Insights must avoid dense or AI-like marketing language.');

assert(/Check back regularly/i.test(benefits), 'Member Benefits must tell users to check back for new partnerships.');
assert(/If you decide to buy, check here before you pay/i.test(benefits), 'Member Benefits must feel like a natural post-decision step.');
assert(/What you get/.test(benefits) && /Who can use it/.test(benefits) && /When it ends/.test(benefits) && /How to use it/.test(benefits), 'Partner offers must keep practical details.');
assert(/Money Matters: The Financial Education You Should Have Been Taught/.test(benefits), 'Money Matters must remain in the financial-literacy shelf.');
assert(/The Cost of Owing: How to Clear Your Debt, Rebuild Your Finances and Reclaim Your Income/.test(benefits), 'The Cost of Owing must remain in the financial-literacy shelf.');
assert(/amazon\.co\.uk\/dp\/B0HJNJSSWJ/i.test(benefits), 'Money Matters must retain its Amazon UK destination.');
assert(/amazon\.co\.uk\/dp\/B0HLDL4PVJ/i.test(benefits), 'The Cost of Owing must retain its Amazon UK destination.');
assert(!/book royalties|author royalties|Decision → Education → Benefit|independent decision/i.test(benefits), 'Member Benefits must stay free of unnecessary compliance-style copy.');
assert(/Founder books/.test(disclosure), 'Commercial disclosure must retain the concise founder-books section.');

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  console.error(`\n${failures.length} value proposition check(s) failed.`);
  process.exit(1);
}
console.log('TruWorth value proposition checks passed.');
