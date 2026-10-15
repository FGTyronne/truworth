import fs from 'node:fs';
import vm from 'node:vm';

const sourcePath = 'decision-engine-v24.js';
let source = fs.readFileSync(sourcePath, 'utf8');
const boot = "  addStyles();window.addEventListener('truworth:routed',()=>{enhanceImport();injectProfile();});setTimeout(()=>{if(window.__TRUWORTH_ROUTED__){enhanceImport();injectProfile();}},0);";
if (!source.includes(boot)) throw new Error('Decision engine boot signature changed; update the regression harness.');
source = source.replace(boot, '  globalThis.__winner = winner;');

const sandbox = {
  user: null,
  subscription: null,
  comparePage() {},
  renderComparison() {},
  setTimeout() {},
  console,
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: sourcePath });
const winner = sandbox.__winner;
if (typeof winner !== 'function') throw new Error('Could not expose decision winner function.');

const left = { id: 'A', title: 'Product A' };
const right = { id: 'B', title: 'Product B' };
const vote = (outcome, index) => ({ vote: outcome, decision_index: index, confidence: 80, discipline: 5 });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let result = winner(left, right, vote('BUY', 74), vote('WAIT', 73));
assert(result.label === 'BUY' && result.record?.id === 'A', 'BUY must beat WAIT regardless of a narrow score gap.');

result = winner(left, right, vote('SKIP', 90), vote('WAIT', 60));
assert(result.label === 'WAIT' && result.record?.id === 'B', 'WAIT must beat a higher-index SKIP caused by a categorical override.');

result = winner(left, right, vote('SKIP', 80), vote('SKIP', 40));
assert(result.label === 'NEITHER' && result.record === null, 'Two SKIP outcomes must combine to NEITHER.');

result = winner(left, right, vote('WAIT', 65), vote('WAIT', 63));
assert(result.label === 'WAIT' && result.record === null, 'Two close WAIT outcomes should recommend waiting without inventing a winner.');

result = winner(left, right, vote('WAIT', 70), vote('WAIT', 58));
assert(result.label === 'WAIT' && result.record?.id === 'A', 'Two separated WAIT outcomes may identify the stronger option while preserving WAIT.');

result = winner(left, right, vote('BUY', 76), vote('BUY', 84));
assert(result.label === 'BUY' && result.record?.id === 'B', 'Within the same BUY category, the higher decision index should win.');

console.log('Decision outcome combiner checks passed.');
