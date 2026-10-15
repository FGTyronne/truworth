import fs from 'node:fs';

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const importer = fs.readFileSync('supabase/functions/import-product/index.ts', 'utf8');
const frontend = fs.readFileSync('launch-hardening-v31.js', 'utf8');

for (const type of ['exact','starting','sale','monthly','unknown']) {
  expect(importer.includes(`'${type}'`), `Importer is missing ${type} price classification.`);
}
for (const field of ['price_type','price_confidence','price_source','price_url','variant']) {
  expect(importer.includes(field), `Importer response contract is missing ${field}.`);
  expect(frontend.includes(field), `Assessment frontend is not preserving ${field}.`);
}
expect(!/Access-Control-Allow-Origin['"]\s*:\s*['"]\*/.test(importer), 'Importer must not use wildcard browser CORS.');
expect(/Deno\.resolveDns/.test(importer) && /Private network URLs are not supported/.test(importer), 'Importer SSRF/private-network guard is missing.');
expect(/MAX_BYTES\s*=\s*3_000_000/.test(importer), 'Importer response size guard is missing.');
expect(/price_type\s*===\s*'monthly'/.test(frontend) && /price\.value\s*=\s*''/.test(frontend), 'Monthly pricing is not blocked from becoming a cash price.');
expect(/price_type\s*===\s*'starting'/.test(frontend), 'Starting-price warning is missing.');
expect(/price_type\s*===\s*'sale'/.test(frontend), 'Sale-price warning is missing.');
expect(/Product Importer\/1\.3/.test(importer), 'Importer runtime identity was not advanced with the price contract change.');

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  console.error(`\n${failures.length} importer contract check(s) failed.`);
  process.exit(1);
}
console.log('Importer contract checks passed.');
