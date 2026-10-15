import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const htmlFiles = fs.readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
  .map((entry) => entry.name);

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const canonicalFrom = (text) => text.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1]
  || text.match(/<link\s+href=["']([^"']+)["']\s+rel=["']canonical["']/i)?.[1]
  || null;

for (const file of htmlFiles) {
  const text = read(file);
  const noindex = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(text);
  if (noindex) continue;

  const canonical = canonicalFrom(text);
  if (!canonical) failures.push(`${file}: indexable page is missing a canonical URL`);
  else if (!canonical.startsWith('https://truworth-web.onrender.com/')) failures.push(`${file}: canonical is not on Render: ${canonical}`);

  if (!/<title>[^<]+<\/title>/i.test(text)) failures.push(`${file}: indexable page is missing a non-empty title`);
  if (!/<meta\s+name=["']description["']\s+content=["'][^"']{20,}["']/i.test(text)) failures.push(`${file}: indexable page is missing a useful meta description`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  console.error(`\n${failures.length} public SEO check(s) failed.`);
  process.exit(1);
}

console.log(`Public SEO smoke checks passed across ${htmlFiles.length} root HTML pages.`);
