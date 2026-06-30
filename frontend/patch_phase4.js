const fs = require('fs');
const path = require('path');

const APP_DIR = 'app';

function walkSync(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      filelist = walkSync(filepath, filelist);
    } else {
      if (filepath.endsWith('.tsx') || filepath.endsWith('.ts') || filepath.endsWith('.js')) {
        filelist.push(filepath);
      }
    }
  }
  return filelist;
}

const files = walkSync(APP_DIR);
let patchedFiles = 0;

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // 1. Standardize Empty States
  const standardEmptyText = `{
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
  }`;
  content = content.replace(/emptyText:\s*\{[^}]+\}/g, `emptyText: ${standardEmptyText}`);
  content = content.replace(/emptySubText:\s*\{[^}]+\}/g, `emptySubText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: 4 }`);

  // 2. Accessibility: Minimum touch targets (48dp)
  // Many backBtns use 42x42 or 40x40. We standardize them to 48x48.
  content = content.replace(/width:\s*42,\s*height:\s*42,\s*borderRadius:\s*21/g, 'width: 48, height: 48, borderRadius: 24');
  content = content.replace(/width:\s*40,\s*height:\s*40,\s*borderRadius:\s*20/g, 'width: 48, height: 48, borderRadius: 24');
  
  // Icon Buttons might be styled as iconBtn
  content = content.replace(/iconBtn:\s*\{\s*(.*?)width:\s*32,\s*height:\s*32(.*?)\}/g, 'iconBtn: { $1width: 48, height: 48$2 }');

  // 3. Loading UX: ActivityIndicator color standardization
  // Find <ActivityIndicator color="..." and change to color={COLORS.primary}
  // Wait, if it's already using COLORS.primary, it will be skipped or replaced identical
  content = content.replace(/<ActivityIndicator([^>]*?)color="[^"]+"/g, '<ActivityIndicator$1color={COLORS.primary}');
  content = content.replace(/<ActivityIndicator([^>]*?)color=\{['"][^'"]+['"]\}/g, '<ActivityIndicator$1color={COLORS.primary}');

  if (content !== originalContent) {
    if (!content.includes('COLORS')) {
      content = content.replace(/import \{ RADIUS/, "import { COLORS, RADIUS");
    }
    fs.writeFileSync(filePath, content);
    console.log('Patched', filePath);
    patchedFiles++;
  }
}

files.forEach(patchFile);
console.log('Total patched:', patchedFiles);
