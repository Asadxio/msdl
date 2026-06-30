const fs = require('fs');

const f = 'app/admin/security.tsx';
let content = fs.readFileSync(f, 'utf8');

if (!content.includes('@/constants/theme')) {
  // Find the last import and add it after
  const lines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) {
      lastImportIdx = i;
    }
  }
  
  if (lastImportIdx !== -1) {
    lines.splice(lastImportIdx + 1, 0, "import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';");
    fs.writeFileSync(f, lines.join('\n'));
    console.log('Fixed imports in', f);
  }
}
