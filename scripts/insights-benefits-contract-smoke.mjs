import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const experience = read('insights-benefits-v36.js');
const css = read('theme-v36.css');
const app = read('app.js');
const appCss = read('app.css');
const disclosure = read('commercial-disclosure.html');

assert(app.includes("'insights-benefits-v36.js'"), 'v36 Insights/Benefits layer must be loaded by app.js.');
assert(appCss.includes('theme-v36.css'), 'v36 Insights/Benefits styles must be loaded by app.css.');

for (const signal of ['Evidence strength','Score discipline','Assumption sensitivity','Expectation calibration','Financial pressure','Next best move']) {
  assert(experience.includes(signal), `Insights must retain the ${signal} signal.`);
}
assert(/currencies are never silently combined|different currencies are not added together/i.test(experience), 'Insights must retain explicit currency-separation protection.');
assert(/Early signal/.test(experience) && /Stronger evidence/.test(experience), 'Insights must label evidence strength rather than overstate small samples.');
assert(/halving expected use/i.test(experience) || /Halve expected use/i.test(experience), 'Insights must retain the assumption stress test.');
assert(/actual_joy/.test(experience), 'Insights must use post-purchase enjoyment when available.');
assert(/financial_profiles/.test(experience), 'Plus insights must use the financial profile for money-context insight.');

assert(/living benefit hub/i.test(experience), 'Member Benefits must clearly identify the catalogue as living/growing.');
assert(/Check back regularly/i.test(experience), 'Member Benefits must explicitly tell members to check back for new partnerships.');
assert(/signed, verified and activated/i.test(experience), 'Partner benefit copy must explain that new benefits appear as partnerships activate.');
assert(/Exact benefit/.test(experience) && /Who qualifies/.test(experience) && /Validity/.test(experience) && /How to redeem/.test(experience), 'Partner benefit standard must disclose practical redemption information.');
assert(/commercial relationship/i.test(experience), 'Partner Benefits must preserve commercial relationship disclosure.');

assert(/Money Matters: The Financial Education You Should Have Been Taught/.test(experience), 'Money Matters must remain in the financial-literacy shelf.');
assert(/The Cost of Owing: How to Clear Your Debt, Rebuild Your Finances and Reclaim Your Income/.test(experience), 'The Cost of Owing must remain in the financial-literacy shelf.');
assert(/amazon\.co\.uk\/dp\/B0HJNJSSWJ/i.test(experience), 'Money Matters must retain its Amazon UK destination.');
assert(/amazon\.co\.uk\/dp\/B0HLDL4PVJ/i.test(experience), 'The Cost of Owing must retain its Amazon UK destination.');
assert(/author royalties/i.test(experience), 'Founder-book area must disclose potential author royalties.');
assert(/cannot change your TruWorth score|cannot increase a TruWorth score/i.test(experience), 'Books and benefits must remain explicitly independent from recommendations.');
assert(/Founder-authored books and educational resources/i.test(disclosure), 'Commercial disclosure must cover founder-authored books.');
assert(/author may receive royalties/i.test(disclosure), 'Commercial disclosure must disclose author royalties.');

assert(/\.tw36-insights-hero/.test(css) && /\.tw36-benefits-hero/.test(css), 'v36 must retain dedicated Insights and Benefits presentation.');
assert(/@media\(max-width:760px\)/.test(css), 'v36 must retain mobile responsive rules.');

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  console.error(`\n${failures.length} Insights/Benefits contract check(s) failed.`);
  process.exit(1);
}
console.log('Insights and Member Benefits contract checks passed.');
