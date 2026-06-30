const fs = require('fs');

const files = [
  'app/admin/moderation.tsx',
  'app/admin/security.tsx',
  'app/admin/send-push.tsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (!content.includes('@/constants/theme')) {
    content = content.replace(/import \{ db \} from '@\/lib\/firebase';/, "import { db } from '@/lib/firebase';\nimport { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';");
    fs.writeFileSync(f, content);
    console.log('Fixed imports in', f);
  }
});
