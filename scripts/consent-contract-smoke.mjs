import fs from 'node:fs';

function read(path){ return fs.readFileSync(path,'utf8'); }
function fail(message){ console.error(`FAIL: ${message}`); process.exit(1); }

const main = read('consent-v25.js');
const route = read('consent-route-v25.js');
const mainVersion = main.match(/const\s+VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
if(!mainVersion) fail('Could not resolve consent-v25.js VERSION.');

if(!route.includes("window.TruWorthConsent?.get?.().version")) {
  const routeVersion = route.match(/VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
  if(routeVersion !== mainVersion) fail(`Consent version drift: main=${mainVersion}, route=${routeVersion || 'unknown'}.`);
}

if(!route.includes("truworth_consent_v1")) fail('Route consent layer no longer uses the canonical consent storage key.');
console.log(`Consent contract smoke passed for version ${mainVersion}.`);
