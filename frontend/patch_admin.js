const fs = require('fs');
const path = require('path');

const ADMIN_DIR = 'app/admin';
const files = fs.readdirSync(ADMIN_DIR).filter(f => f.endsWith('.tsx'));

function patchFile(filename) {
  const filePath = path.join(ADMIN_DIR, filename);
  let content = fs.readFileSync(filePath, 'utf8');

  // Change cards to RADIUS.xxl
  content = content.replace(/borderRadius:\s*(?:12|16|RADIUS\.lg|RADIUS\.xl)/g, 'borderRadius: RADIUS.xxl');

  // Also replace any specific card that might use 8 for border radius
  // content = content.replace(/borderRadius:\s*8/g, 'borderRadius: RADIUS.md');

  // Standardize topBarTitle typography
  content = content.replace(/topBarTitle:\s*\{[^}]*\},/g, `topBarTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textMain },`);

  fs.writeFileSync(filePath, content);
  console.log('Patched', filename);
}

files.forEach(patchFile);
