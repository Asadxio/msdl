const fs = require('fs');
const path = require('path');

const FILES = [
  'app/course/[id].tsx',
  'app/teacher/[id].tsx',
  'app/book/[id].tsx',
  'app/payment.tsx',
  'app/payment-history.tsx'
];

function patchFile(filename) {
  const filePath = path.join(filename);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Change generic borderRadii (like 12 or 16) to RADIUS.xxl for cards
  content = content.replace(/borderRadius:\s*(?:12|16|18|RADIUS\.lg|RADIUS\.xl)/g, 'borderRadius: RADIUS.xxl');

  fs.writeFileSync(filePath, content);
  console.log('Patched', filename);
}

FILES.forEach(patchFile);
