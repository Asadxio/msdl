const fs = require('fs');
const path = require('path');

const SECRET_PATTERNS = [
  /rzp_live_[A-Za-z0-9]+/i,
  /rzp_test_[A-Za-z0-9]{14,}/i,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY/,
  /\"private_key\"\s*:\s*\"-----BEGIN/
];

const IGNORE_DIRS = new Set(['node_modules', '.git', 'lib', '.expo', 'artifacts', 'artifacts_final', 'brain']);

let found = [];

function scan(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(fullPath);
    } else if (/\.(ts|tsx|js|json|py|env|rules)$/i.test(entry.name)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const pattern of SECRET_PATTERNS) {
          if (pattern.test(content)) {
            if (content.includes('rzp_test_XXXXXX') || fullPath.includes('secret_scan.js')) continue;
            found.push({ file: fullPath, pattern: pattern.toString() });
          }
        }
      } catch (e) {}
    }
  }
}

scan('C:\\Users\\xioas\\.gemini\\antigravity\\scratch\\msdl');
console.log('Secret Scan Results count:', found.length);
if (found.length > 0) {
  console.log(found);
}
