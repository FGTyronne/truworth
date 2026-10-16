import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const insights = read('insights-benefits-v36.js');
const benefits = read('benefits-v37.js');
const css = read('theme-v36.css');
const app = read('app.js');
const appCss = read('app.css');
const disclosure = read('commercial-disclosure.html');

assert(app.includes("'insights-benefits-v36.js'"), 'v36 Insights layer must be loaded by app.js.');
assert(app.includes("'benefits-v37.js'"), 'v37 Benefits copy layer must be loaded after v36.');
assert(appCss.includes('theme-v36.css'), 'v36 Insights/Benefits styles must be loaded by app.css.');

for (const signal of ['Evidence strength','Score discipline','Assumption sensitivity','Expectation calibration','Financial pressure','Next best move']) {
  assert(insights.includes(signal), `Insights must retain the ${signal} signal.`);
}
assert(/currencies are never silently combined|different currencies are not added together/i.test(insights), 'Insights must retain explicit currency-separation protection.');
assert(/Early signal/.test(insights) && /Stronger evidence/.test(insights), 'Insights must label evidence strength rather than overstate small samples.');
assert(/halving expected use/i.test(insights) || /Halve expected use/i.test(insights), 'Insights must retain the assumption stress test.');
assert(/actual_joy/.test(insights), 'Insights must use post-purchase enjoyment when available.');
assert(/financial_profiles/.test(insights), 'Plus insights must use the financial profile for money-context insight.');

assert(/Check back regularly/i.test(benefits), 'Member Benefits must explicitly tell members to check back for new partnerships.');
assert(/partnerships go live/i.test(benefits), 'Member Benefits must explain that new benefits appear as partnerships go live.');
assert(/The benefit/.test(benefits) && /Who can use it/.test(benefits) && /How long it lasts/.test(benefits) && /How to redeem it/.test(benefits), 'Partner benefit cards must retain practical offer details.');
assert(/Money Matters: The Financial Education You Should Have Been Taught/.test(benefits), 'Money Matters must remain in the financial-literacy shelf.');
assert(/The Cost of Owing: How to Clear Your Debt, Rebuild Your Finances and Reclaim Your Income/.test(benefits), 'The Cost of Owing must remain in the financial-literacy shelf.');
assert(/amazon\.co\.uk\/dp\/B0HJNJSSWJ/i.test(benefits), 'Money Matters must retain its Amazon UK destination.');
assert(/amazon\.co\.uk\/dp\/B0HLDL4PVJ/i.test(benefits), 'The Cost of Owing must retain its Amazon UK destination.');
assert(/written by TruWorth founder Tyronne T Ramella/i.test(benefits), 'The founder relationship must remain plainly disclosed under the books.');
assert(!/book royalties|author royalties/i.test(benefits), 'Member Benefits must not use unnecessary royalty disclaimer language.');
assert(!/Decision → Education → Benefit/.test(benefits), 'Member Benefits must not restore the removed slogan/disclaimer block.');
assert(!/independent decision/i.test(benefits), 'Partner benefit cards must not use unnecessary compliance-style independence copy.');
assert(/Founder books/.test(disclosure), 'Commercial disclosure must retain a concise founder-books section.');
assert(!/royalt/i.test(disclosure), 'Commercial disclosure must not over-explain founder book royalties.');

assert(/\.tw36-insights-hero/.test(css) && /\.tw36-benefits-hero/.test(css), 'v36 must retain dedicated Insights and Benefits presentation.');
assert(/@media\(max-width:760px\)/.test(css), 'v36 must retain mobile responsive rules.');

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  console.error(`\n${failures.length} Insights/Benefits contract check(s) failed.`);
  process.exit(1);
}
console.log('Insights and Member Benefits contract checks passed.');
