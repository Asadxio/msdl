const fs = require('fs');
const f = 'app/book/[id].tsx';
let content = fs.readFileSync(f, 'utf8');

content = content.replace(
  "import { COLORS, SPACING, RADIUS } from '@/constants/theme';",
  "import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';"
);

content = content.replace(
  "<Ionicons name={iconName} size={84} color={catColor.text} />",
  "<Ionicons name={iconName as any} size={84} color={catColor.text} />"
);

fs.writeFileSync(f, content);
console.log('book ts fixed');
